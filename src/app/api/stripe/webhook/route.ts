import Stripe from "stripe";

import { db } from "@/lib/db";
import {
  workspaceSubscription,
} from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StoredSubscriptionStatus =
  (typeof workspaceSubscription.$inferInsert)["status"];

function getWebhookSecret(): string {
  const webhookSecret =
    process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not configured."
    );
  }

  return webhookSecret;
}

function getProPriceId(): string {
  const priceId =
    process.env.STRIPE_PRO_PRICE_ID;

  if (!priceId) {
    throw new Error(
      "STRIPE_PRO_PRICE_ID is not configured."
    );
  }

  return priceId;
}

function mapSubscriptionStatus(
  status: Stripe.Subscription.Status
): StoredSubscriptionStatus {
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
      throw new Error(
        `Unsupported Stripe subscription status: ${status}.`
      );
  }
}

async function synchronizeSubscription(
  subscription: Stripe.Subscription
) {
  const workspaceId =
    subscription.metadata.workspaceId;

  if (!workspaceId) {
    throw new Error(
      "Stripe subscription is missing its workspace ID."
    );
  }

  const subscriptionItem =
    subscription.items.data[0];

  if (!subscriptionItem) {
    throw new Error(
      "Stripe subscription has no subscription item."
    );
  }

  const priceId =
    subscriptionItem.price.id;

  if (priceId !== getProPriceId()) {
    throw new Error(
      "Stripe subscription uses an unsupported price."
    );
  }

  const customerId =
    typeof subscription.customer ===
    "string"
      ? subscription.customer
      : subscription.customer.id;

  const currentPeriodStart =
    new Date(
      subscriptionItem
        .current_period_start *
        1_000
    );

  const currentPeriodEnd =
    new Date(
      subscriptionItem
        .current_period_end *
        1_000
    );

  await db
    .insert(workspaceSubscription)
    .values({
      id: crypto.randomUUID(),
      workspaceId,
      plan: "PRO",
      status:
        mapSubscriptionStatus(
          subscription.status
        ),
      stripeCustomerId:
        customerId,
      stripeSubscriptionId:
        subscription.id,
      stripePriceId: priceId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd:
        subscription
          .cancel_at_period_end,
    })
    .onConflictDoUpdate({
      target:
        workspaceSubscription
          .workspaceId,
      set: {
        plan: "PRO",
        status:
          mapSubscriptionStatus(
            subscription.status
          ),
        stripeCustomerId:
          customerId,
        stripeSubscriptionId:
          subscription.id,
        stripePriceId: priceId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd:
          subscription
            .cancel_at_period_end,
        updatedAt: new Date(),
      },
    });
}

function getSubscriptionId(
  subscription:
    | string
    | Stripe.Subscription
    | null
): string | null {
  if (!subscription) {
    return null;
  }

  return typeof subscription ===
    "string"
    ? subscription
    : subscription.id;
}

export async function POST(
  request: Request
) {
  const signature =
    request.headers.get(
      "stripe-signature"
    );

  if (!signature) {
    return Response.json(
      {
        error:
          "Stripe signature is missing.",
      },
      {
        status: 400,
      }
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = getStripe()
      .webhooks.constructEvent(
        rawBody,
        signature,
        getWebhookSecret()
      );
  } catch {
    return Response.json(
      {
        error:
          "Stripe signature is invalid.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session =
          event.data.object;

        if (
          session.mode !==
          "subscription"
        ) {
          break;
        }

        const subscriptionId =
          getSubscriptionId(
            session.subscription
          );

        if (!subscriptionId) {
          throw new Error(
            "Completed Stripe Checkout session has no subscription."
          );
        }

        const subscription =
          await getStripe()
            .subscriptions.retrieve(
              subscriptionId
            );

        await synchronizeSubscription(
          subscription
        );

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const eventSubscription =
          event.data.object;

        /*
         * Retrieve the latest Stripe state
         * instead of trusting an older event
         * snapshot. This also makes repeated
         * webhook delivery idempotent.
         */
        const subscription =
          await getStripe()
            .subscriptions.retrieve(
              eventSubscription.id
            );

        await synchronizeSubscription(
          subscription
        );

        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error(
      "Stripe webhook processing failed.",
      error
    );

    return Response.json(
      {
        error:
          "Stripe webhook processing failed.",
      },
      {
        status: 500,
      }
    );
  }

  return Response.json({
    received: true,
  });
}