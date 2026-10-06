import { TRPCError } from "@trpc/server";
import { count, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";

import { user } from "@/lib/db/schema/auth";

import {
  workspace,
} from "@/lib/db/schema/workspace";

import {
  workspaceMember,
} from "@/lib/db/schema/workspace-member";

import {
  workspaceSubscription,
} from "@/lib/db/schema/billing";

const FREE_WORKSPACE_LIMIT = 3;
const FREE_TRIAL_DAYS = 10;

function isSubscriptionActive(
  status: string
): boolean {
  return (
    status === "ACTIVE" ||
    status === "TRIALING"
  );
}

function isWithinFreeTrial(
  createdAt: Date
): boolean {
  const trialEndsAt =
    createdAt.getTime() +
    FREE_TRIAL_DAYS *
      24 *
      60 *
      60 *
      1000;

  return Date.now() < trialEndsAt;
}

function getTrialEndsAt(
  createdAt: Date
): Date {
  return new Date(
    createdAt.getTime() +
      FREE_TRIAL_DAYS *
        24 *
        60 *
        60 *
        1000
  );
}

export class WorkspaceService {
  static async create({
    userId,
    name,
  }: {
    userId: string;
    name: string;
  }) {
    return db.transaction(async (tx) => {
      const account =
        await tx.query.user.findFirst({
          where: eq(user.id, userId),
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

      const subscriptions =
        await tx
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
            subscription.plan === "PRO" &&
            isSubscriptionActive(
              subscription.status
            )
        );

      if (!hasActivePro) {
        const trialActive =
          isWithinFreeTrial(
            account.createdAt
          );

        if (!trialActive) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Your 10-day free trial has expired. Upgrade to PRO to create more workspaces.",
          });
        }

        const [workspaceCount] =
          await tx
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

        if (
          (workspaceCount?.count ?? 0) >=
          FREE_WORKSPACE_LIMIT
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "FREE accounts can create up to 3 workspaces. Upgrade to PRO for unlimited workspaces.",
          });
        }
      }

      const workspaceId =
        randomUUID();

      const slug = name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");

      await tx
        .insert(workspace)
        .values({
          id: workspaceId,
          name,
          slug,
          ownerId: userId,
        });

      await tx
        .insert(workspaceMember)
        .values({
          workspaceId,
          userId,
          role: "OWNER",
        });

      const created =
        await tx.query.workspace.findFirst({
          where: (
            workspaceRecord,
            { eq }
          ) =>
            eq(
              workspaceRecord.id,
              workspaceId
            ),
        });

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Workspace could not be created.",
        });
      }

      return {
        ...created,
        membership: {
          plan: hasActivePro
            ? "PRO"
            : "FREE",
          trialEndsAt:
            hasActivePro
              ? null
              : getTrialEndsAt(
                  account.createdAt
                ),
        },
      };
    });
  }
}