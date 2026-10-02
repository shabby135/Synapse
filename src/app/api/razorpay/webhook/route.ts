import "server-only";

import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  workspaceSubscription,
} from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RazorpaySubscription = {
  id?: string;
  plan_id?: string;
  status?: string;
  current_start?: number | null;
  current_end?: number | null;
  ended_at?: number | null;
  notes?: Record<string, string>;
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    subscription?: {
      entity?: RazorpaySubscription;
    };
  };
};

function getWebhookSecret(): string {
  const secret =
    process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      "RAZORPAY_WEBHOOK_SECRET is not configured."
    );
  }

  return secret;
}

function verifySignature({
  rawBody,
  signature,
  secret,
}: {
  rawBody: string;
  signature: string;
  secret: string;
}): boolean {
  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(rawBody)
      .digest("hex");

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "utf8"
    );

  const receivedBuffer =
    Buffer.from(
      signature,
      "utf8"
    );

  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
}

function mapRazorpayStatus(
  status: string | undefined
) {
  switch (status) {
    case "active":
      return {
        plan: "PRO" as const,
        status: "ACTIVE" as const,
        cancelAtPeriodEnd: false,
      };

    case "pending":
      return {
        plan: "PRO" as const,
        status: "INCOMPLETE" as const,
        cancelAtPeriodEnd: false,
      };

    case "halted":
      return {
        plan: "PRO" as const,
        status: "PAUSED" as const,
        cancelAtPeriodEnd: false,
      };

    case "paused":
      return {
        plan: "PRO" as const,
        status: "PAUSED" as const,
        cancelAtPeriodEnd: false,
      };

    case "cancelled":
      return {
        plan: "FREE" as const,
        status: "CANCELED" as const,
        cancelAtPeriodEnd: false,
      };

    case "completed":
      return {
        plan: "FREE" as const,
        status: "CANCELED" as const,
        cancelAtPeriodEnd: false,
      };

    default:
      return null;
  }
}

export async function POST(
  request: Request
) {
  try {
    const rawBody =
      await request.text();

    const signature =
      request.headers.get(
        "x-razorpay-signature"
      );

    if (!signature) {
      return NextResponse.json(
        {
          error:
            "Missing Razorpay signature.",
        },
        {
          status: 400,
        }
      );
    }

    const isValid =
      verifySignature({
        rawBody,
        signature,
        secret:
          getWebhookSecret(),
      });

    if (!isValid) {
      return NextResponse.json(
        {
          error:
            "Invalid Razorpay signature.",
        },
        {
          status: 400,
        }
      );
    }

    let payload:
      | RazorpayWebhookPayload;

    try {
      payload =
        JSON.parse(rawBody) as RazorpayWebhookPayload;
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid JSON payload.",
        },
        {
          status: 400,
        }
      );
    }

    const event =
      payload.event;

    const subscription =
      payload.payload?.subscription
        ?.entity;

    if (
      !event ||
      !subscription?.id
    ) {
      return NextResponse.json({
        received: true,
        ignored: true,
      });
    }

    const supportedEvents =
      new Set([
        "subscription.authenticated",
        "subscription.activated",
        "subscription.charged",
        "subscription.completed",
        "subscription.updated",
        "subscription.pending",
        "subscription.halted",
        "subscription.paused",
        "subscription.resumed",
        "subscription.cancelled",
      ]);

    if (
      !supportedEvents.has(event)
    ) {
      return NextResponse.json({
        received: true,
        ignored: true,
      });
    }

    const subscriptionId =
      subscription.id;

    const [
      existingSubscription,
    ] = await db
      .select()
      .from(
        workspaceSubscription
      )
      .where(
        eq(
          workspaceSubscription
            .razorpaySubscriptionId,
          subscriptionId
        )
      )
      .limit(1);

    if (!existingSubscription) {
      /*
       * Do not create a subscription record
       * from an unrecognized Razorpay subscription.
       *
       * The subscription must have been created
       * through Synapse first.
       */
      return NextResponse.json({
        received: true,
        ignored: true,
      });
    }

    const mappedStatus =
      mapRazorpayStatus(
        subscription.status
      );

    if (!mappedStatus) {
      return NextResponse.json({
        received: true,
        ignored: true,
      });
    }

    const currentPeriodStart =
      subscription.current_start
        ? new Date(
            subscription.current_start *
              1000
          )
        : null;

    const currentPeriodEnd =
      subscription.current_end
        ? new Date(
            subscription.current_end *
              1000
          )
        : null;

    await db
      .update(
        workspaceSubscription
      )
      .set({
        plan:
          mappedStatus.plan,

        status:
          mappedStatus.status,

        razorpaySubscriptionId:
          subscriptionId,

        razorpayPlanId:
          subscription.plan_id ??
          existingSubscription
            .razorpayPlanId,

        currentPeriodStart,

        currentPeriodEnd,

        cancelAtPeriodEnd:
          mappedStatus.cancelAtPeriodEnd,

        updatedAt:
          new Date(),
      })
      .where(
        eq(
          workspaceSubscription
            .id,
          existingSubscription.id
        )
      );

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error(
      "Razorpay webhook error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Webhook processing failed.",
      },
      {
        status: 500,
      }
    );
  }
}

export function GET() {
  return NextResponse.json(
    {
      error:
        "Method not allowed.",
    },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    }
  );
}