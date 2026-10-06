import { TRPCError } from "@trpc/server";

import {
  count,
  eq,
} from "drizzle-orm";

import {
  isSubscriptionActive,
} from "@/features/billing/plans";

import {
  getWorkspaceUsage,
} from "@/features/billing/usage";

import {
  workspaceBillingSchema,
} from "@/features/billing/validator";

import {
  requireWorkspacePermission,
} from "@/features/workspace/authorization";

import {
  user,
  workspace,
  workspaceSubscription,
} from "@/lib/db/schema";

import { getRazorpay } from "@/lib/razorpay";
import { getStripe } from "@/lib/stripe";

import {
  protectedProcedure,
  router,
} from "../init";

type SubscriptionStatus =
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED"
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "PAUSED";

function getRazorpayPlanId(): string {
  const planId =
    process.env.RAZORPAY_PLAN_ID;

  if (!planId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "RAZORPAY_PLAN_ID is not configured.",
    });
  }

  return planId;
}

function mapStripeSubscriptionStatus(
  status: string
): SubscriptionStatus {
  switch (status) {
    case "incomplete":
      return "INCOMPLETE";

    case "incomplete_expired":
      return "INCOMPLETE_EXPIRED";

    case "trialing":
      return "TRIALING";

    case "active":
      return "ACTIVE";

    case "past_due":
      return "PAST_DUE";

    case "canceled":
      return "CANCELED";

    case "unpaid":
      return "UNPAID";

    case "paused":
      return "PAUSED";

    default:
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Unsupported Stripe subscription status: ${status}.`,
      });
  }
}

async function findActiveProSubscriptions({
  customerId,
  priceId,
}: {
  customerId: string;
  priceId: string;
}) {
  const stripe = getStripe();

  const subscriptions =
    await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    });

  return subscriptions.data
    .filter((subscription) => {
      const hasProPrice =
        subscription.items.data.some(
          (item) =>
            item.price.id === priceId
        );

      return (
        hasProPrice &&
        (
          subscription.status ===
            "active" ||
          subscription.status ===
            "trialing"
        )
      );
    })
    .sort(
      (first, second) =>
        second.created -
        first.created
    );
}

export const billingRouter = router({
  getMembership:
    protectedProcedure.query(
      async ({ ctx }) => {
        const userId =
          ctx.session.user.id;

        const account =
          await ctx.db.query.user.findFirst({
            where: eq(
              user.id,
              userId
            ),
            columns: {
              id: true,
              createdAt: true,
            },
          });

        if (!account) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message:
              "Your account could not be found.",
          });
        }

        const [workspaceCount] =
          await ctx.db
            .select({
              count: count(),
            })
            .from(workspace)
            .where(
              eq(
                workspace.ownerId,
                userId
              )
            );

        const subscriptions =
          await ctx.db
            .select({
              plan:
                workspaceSubscription.plan,
              status:
                workspaceSubscription.status,
            })
            .from(
              workspaceSubscription
            )
            .innerJoin(
              workspace,
              eq(
                workspaceSubscription.workspaceId,
                workspace.id
              )
            )
            .where(
              eq(
                workspace.ownerId,
                userId
              )
            );

        const hasActivePro =
          subscriptions.some(
            (subscription) =>
              subscription.plan ===
                "PRO" &&
              isSubscriptionActive(
                subscription.status
              )
          );

        const trialEndsAt =
          new Date(
            account.createdAt.getTime() +
              10 *
                24 *
                60 *
                60 *
                1000
          );

        const trialActive =
          Date.now() <
          trialEndsAt.getTime();

        const trialDaysRemaining =
          Math.max(
            0,
            Math.ceil(
              (
                trialEndsAt.getTime() -
                Date.now()
              ) /
                (
                  24 *
                  60 *
                  60 *
                  1000
                )
            )
          );

        return {
          plan: hasActivePro
            ? "PRO"
            : "FREE",

          status: hasActivePro
            ? "ACTIVE"
            : "TRIALING",

          workspaceCount:
            workspaceCount?.count ?? 0,

          workspaceLimit:
            hasActivePro
              ? null
              : 3,

          trialEndsAt:
            hasActivePro
              ? null
              : trialEndsAt,

          trialDaysRemaining:
            hasActivePro
              ? null
              : trialDaysRemaining,

          trialActive:
            hasActivePro
              ? false
              : trialActive,
        };
      }
    ),

  getUsage:
    protectedProcedure
      .input(workspaceBillingSchema)
      .query(async ({ ctx, input }) => {
        await requireWorkspacePermission({
          database: ctx.db,
          workspaceId:
            input.workspaceId,
          userId:
            ctx.session.user.id,
          permission:
            "billing:read",
        });

        return getWorkspaceUsage(
          input.workspaceId
        );
      }),

  /*
   * Legacy Stripe synchronization.
   *
   * Kept temporarily so existing Stripe
   * subscriptions can still be synchronized
   * during the Razorpay migration.
   */
  syncSubscription:
    protectedProcedure
      .input(workspaceBillingSchema)
      .mutation(
        async ({ ctx, input }) => {
          await requireWorkspacePermission({
            database: ctx.db,
            workspaceId:
              input.workspaceId,
            userId:
              ctx.session.user.id,
            permission:
              "billing:manage",
          });

          const [
            existingSubscription,
          ] = await ctx.db
            .select()
            .from(
              workspaceSubscription
            )
            .where(
              eq(
                workspaceSubscription.workspaceId,
                input.workspaceId
              )
            )
            .limit(1);

          if (
            !existingSubscription
          ) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message:
                "No Stripe subscription record exists for this workspace.",
            });
          }

          const customerId =
            existingSubscription
              .stripeCustomerId;

          if (!customerId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "This workspace does not have a Stripe customer ID.",
            });
          }

          const priceId =
            process.env
              .STRIPE_PRO_PRICE_ID;

          if (!priceId) {
            throw new TRPCError({
              code:
                "INTERNAL_SERVER_ERROR",
              message:
                "STRIPE_PRO_PRICE_ID is not configured.",
            });
          }

          const activeSubscriptions =
            await findActiveProSubscriptions({
              customerId,
              priceId,
            });

          if (
            activeSubscriptions.length ===
            0
          ) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message:
                "No active Synapse PRO subscription was found in Stripe.",
            });
          }

          if (
            activeSubscriptions.length >
            1
          ) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "Multiple active PRO subscriptions were found. Cancel the duplicate subscription in Stripe first.",
            });
          }

          const stripeSubscription =
            activeSubscriptions[0];

          if (!stripeSubscription) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message:
                "No active Synapse PRO subscription was found.",
            });
          }

          const subscriptionItem =
            stripeSubscription.items.data.find(
              (item) =>
                item.price.id ===
                priceId
            );

          if (!subscriptionItem) {
            throw new TRPCError({
              code:
                "INTERNAL_SERVER_ERROR",
              message:
                "The Stripe subscription does not contain the configured PRO price.",
            });
          }

          const status =
            mapStripeSubscriptionStatus(
              stripeSubscription.status
            );

          await ctx.db
            .update(
              workspaceSubscription
            )
            .set({
              plan: "PRO",
              status,

              stripeCustomerId:
                customerId,

              stripeSubscriptionId:
                stripeSubscription.id,

              stripePriceId:
                subscriptionItem.price.id,

              currentPeriodStart:
                new Date(
                  subscriptionItem
                    .current_period_start *
                    1000
                ),

              currentPeriodEnd:
                new Date(
                  subscriptionItem
                    .current_period_end *
                    1000
                ),

              cancelAtPeriodEnd:
                stripeSubscription
                  .cancel_at_period_end,

              updatedAt:
                new Date(),
            })
            .where(
              eq(
                workspaceSubscription.workspaceId,
                input.workspaceId
              )
            );

          return {
            success: true,
            plan: "PRO" as const,
            status,

            stripeSubscriptionId:
              stripeSubscription.id,
          };
        }
      ),

  /*
   * Create a Razorpay PRO subscription.
   *
   * The frontend will use the returned
   * subscriptionId with Razorpay Checkout.
   */
  createCheckoutSession:
    protectedProcedure
      .input(workspaceBillingSchema)
      .mutation(
        async ({ ctx, input }) => {
          await requireWorkspacePermission({
            database: ctx.db,
            workspaceId:
              input.workspaceId,
            userId:
              ctx.session.user.id,
            permission:
              "billing:manage",
          });

          const [
            existingWorkspace,
          ] = await ctx.db
            .select({
              id: workspace.id,
              name: workspace.name,
              ownerId:
                workspace.ownerId,
            })
            .from(workspace)
            .where(
              eq(
                workspace.id,
                input.workspaceId
              )
            )
            .limit(1);

          if (
            !existingWorkspace
          ) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message:
                "Workspace not found.",
            });
          }

          /*
           * Billing subscriptions are account-level
           * purchases associated with a workspace.
           *
           * Only the workspace owner is allowed to
           * create the subscription from the billing
           * page. Do not rely only on the frontend
           * OWNER filter because the client cannot be
           * trusted.
           */
          if (
            existingWorkspace.ownerId !==
            ctx.session.user.id
          ) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "Only the workspace owner can manage the subscription.",
            });
          }

          const [
            existingSubscription,
          ] = await ctx.db
            .select()
            .from(
              workspaceSubscription
            )
            .where(
              eq(
                workspaceSubscription.workspaceId,
                input.workspaceId
              )
            )
            .limit(1);

          if (
            existingSubscription?.plan ===
              "PRO" &&
            isSubscriptionActive(
              existingSubscription.status
            )
          ) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "This workspace already has an active PRO subscription.",
            });
          }

          /*
           * Prevent creating another Razorpay
           * subscription when one is already
           * pending authorization.
           */
          if (
            existingSubscription
              ?.razorpaySubscriptionId &&
            existingSubscription.status ===
              "INCOMPLETE"
          ) {
            return {
              subscriptionId:
                existingSubscription
                  .razorpaySubscriptionId,

              keyId:
                process.env
                  .RAZORPAY_KEY_ID ?? "",
            };
          }

          const razorpayPlanId =
            getRazorpayPlanId();

          const razorpay =
            getRazorpay();

          /*
           * Razorpay requires total_count.
           *
           * 120 monthly cycles = 10 years.
           * This gives Synapse long-lived recurring
           * billing without inventing an unsupported
           * "unlimited" value.
           */
          const subscription =
            await razorpay.subscriptions.create(
              {
                plan_id:
                  razorpayPlanId,

                total_count: 120,

                quantity: 1,

                customer_notify: true,

                notes: {
                  workspaceId:
                    input.workspaceId,

                  userId:
                    ctx.session.user.id,

                  workspaceName:
                    existingWorkspace.name,

                  plan: "PRO",
                },
              }
            );

          if (!subscription.id) {
            throw new TRPCError({
              code:
                "INTERNAL_SERVER_ERROR",
              message:
                "Razorpay did not return a subscription ID.",
            });
          }

          await ctx.db
            .insert(
              workspaceSubscription
            )
            .values({
              id: crypto.randomUUID(),

              workspaceId:
                input.workspaceId,

              plan: "PRO",

              status: "INCOMPLETE",

              razorpaySubscriptionId:
                subscription.id,

              razorpayPlanId:
                razorpayPlanId,

              cancelAtPeriodEnd:
                false,
            })
            .onConflictDoUpdate({
              target:
                workspaceSubscription.workspaceId,

              set: {
                plan: "PRO",

                status:
                  "INCOMPLETE",

                razorpaySubscriptionId:
                  subscription.id,

                razorpayPlanId:
                  razorpayPlanId,

                cancelAtPeriodEnd:
                  false,

                updatedAt:
                  new Date(),
              },
            });

          return {
            subscriptionId:
              subscription.id,

            keyId:
              process.env
                .RAZORPAY_KEY_ID ?? "",
          };
        }
      ),
});