import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

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
  workspace,
  workspaceSubscription,
} from "@/lib/db/schema";
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

function getApplicationUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL;

  if (!configuredUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "NEXT_PUBLIC_APP_URL is not configured.",
    });
  }

  let url: URL;

  try {
    url = new URL(configuredUrl);
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "NEXT_PUBLIC_APP_URL is invalid.",
    });
  }

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "NEXT_PUBLIC_APP_URL must use HTTP or HTTPS.",
    });
  }

  return url.origin;
}

function getProPriceId(): string {
  const priceId =
    process.env.STRIPE_PRO_PRICE_ID;

  if (!priceId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "STRIPE_PRO_PRICE_ID is not configured.",
    });
  }

  return priceId;
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
        second.created - first.created
    );
}

export const billingRouter = router({
  getUsage: protectedProcedure
    .input(workspaceBillingSchema)
    .query(async ({ ctx, input }) => {
      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId:
          input.workspaceId,
        userId:
          ctx.session.user.id,
        permission: "billing:read",
      });

      return getWorkspaceUsage(
        input.workspaceId
      );
    }),

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
                workspaceSubscription
                  .workspaceId,
                input.workspaceId
              )
            )
            .limit(1);

          if (!existingSubscription) {
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
            getProPriceId();

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
            activeSubscriptions.length > 1
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
                item.price.id === priceId
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
              updatedAt: new Date(),
            })
            .where(
              eq(
                workspaceSubscription
                  .workspaceId,
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
            })
            .from(workspace)
            .where(
              eq(
                workspace.id,
                input.workspaceId
              )
            )
            .limit(1);

          if (!existingWorkspace) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message:
                "Workspace not found.",
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
                workspaceSubscription
                  .workspaceId,
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

          const stripe = getStripe();
          const priceId =
            getProPriceId();

          let customerId =
            existingSubscription
              ?.stripeCustomerId;

          if (customerId) {
            const activeSubscriptions =
              await findActiveProSubscriptions({
                customerId,
                priceId,
              });

            if (
              activeSubscriptions.length >
              0
            ) {
              throw new TRPCError({
                code: "CONFLICT",
                message:
                  "Stripe already has an active PRO subscription for this workspace. Synchronize the subscription instead of creating another checkout.",
              });
            }
          }

          if (!customerId) {
            const customer =
              await stripe.customers.create({
                email:
                  ctx.session.user.email,
                name:
                  existingWorkspace.name,
                metadata: {
                  workspaceId:
                    input.workspaceId,
                  userId:
                    ctx.session.user.id,
                },
              });

            customerId = customer.id;

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
                stripeCustomerId:
                  customerId,
              })
              .onConflictDoUpdate({
                target:
                  workspaceSubscription
                    .workspaceId,
                set: {
                  plan: "PRO",
                  status: "INCOMPLETE",
                  stripeCustomerId:
                    customerId,
                  updatedAt: new Date(),
                },
              });
          }

          const applicationUrl =
            getApplicationUrl();

          const checkoutSession =
            await stripe.checkout.sessions.create(
              {
                mode: "subscription",
                customer: customerId,
                line_items: [
                  {
                    price: priceId,
                    quantity: 1,
                  },
                ],
                allow_promotion_codes:
                  true,
                client_reference_id:
                  input.workspaceId,
                metadata: {
                  workspaceId:
                    input.workspaceId,
                  userId:
                    ctx.session.user.id,
                },
                subscription_data: {
                  metadata: {
                    workspaceId:
                      input.workspaceId,
                  },
                },
                success_url:
                  `${applicationUrl}/workspaces/${input.workspaceId}` +
                  "?checkout=success",
                cancel_url:
                  `${applicationUrl}/workspaces/${input.workspaceId}` +
                  "?checkout=cancelled",
              }
            );

          if (!checkoutSession.url) {
            throw new TRPCError({
              code:
                "INTERNAL_SERVER_ERROR",
              message:
                "Stripe did not return a checkout URL.",
            });
          }

          return {
            url: checkoutSession.url,
          };
        }
      ),
});