import {
  and,
  count,
  desc,
  eq,
  gte,
} from "drizzle-orm";

import {
  getUsagePeriodStart,
} from "@/features/billing/usage";
import {
  requireWorkspacePermission,
} from "@/features/workspace/authorization";
import {
  workflow,
  workflowRun,
} from "@/lib/db/schema";

import {
  protectedProcedure,
  router,
} from "../init";
import {
  workspaceBillingSchema,
} from "@/features/billing/validator";

export const monitoringRouter =
  router({
    getSummary: protectedProcedure
      .input(workspaceBillingSchema)
      .query(
        async ({ ctx, input }) => {
          await requireWorkspacePermission({
            database: ctx.db,
            workspaceId:
              input.workspaceId,
            userId:
              ctx.session.user.id,
            permission:
              "workflow:read",
          });

          const periodStart =
            getUsagePeriodStart();

          const [
            statusRows,
            recentFailures,
          ] = await Promise.all([
            ctx.db
              .select({
                status:
                  workflowRun.status,
                total: count(),
              })
              .from(workflowRun)
              .innerJoin(
                workflow,
                eq(
                  workflowRun.workflowId,
                  workflow.id
                )
              )
              .where(
                and(
                  eq(
                    workflow.workspaceId,
                    input.workspaceId
                  ),
                  gte(
                    workflowRun.createdAt,
                    periodStart
                  )
                )
              )
              .groupBy(
                workflowRun.status
              ),

            ctx.db
              .select({
                id: workflowRun.id,
                workflowId:
                  workflowRun.workflowId,
                workflowName:
                  workflow.name,
                error:
                  workflowRun.error,
                createdAt:
                  workflowRun.createdAt,
                completedAt:
                  workflowRun.completedAt,
              })
              .from(workflowRun)
              .innerJoin(
                workflow,
                eq(
                  workflowRun.workflowId,
                  workflow.id
                )
              )
              .where(
                and(
                  eq(
                    workflow.workspaceId,
                    input.workspaceId
                  ),
                  eq(
                    workflowRun.status,
                    "FAILED"
                  )
                )
              )
              .orderBy(
                desc(
                  workflowRun.createdAt
                )
              )
              .limit(5),
          ]);

          const statusCounts = {
            PENDING: 0,
            RUNNING: 0,
            SUCCESS: 0,
            FAILED: 0,
            CANCELLED: 0,
          };

          for (
            const row of statusRows
          ) {
            statusCounts[row.status] =
              Number(row.total);
          }

          const totalRuns =
            Object.values(
              statusCounts
            ).reduce(
              (total, value) =>
                total + value,
              0
            );

          const completedRuns =
            statusCounts.SUCCESS +
            statusCounts.FAILED;

          const successRate =
            completedRuns > 0
              ? Math.round(
                  (
                    statusCounts.SUCCESS /
                    completedRuns
                  ) *
                    10_000
                ) / 100
              : null;

          return {
            periodStart,
            totalRuns,
            successRate,
            statuses: statusCounts,
            recentFailures,
          };
        }
      ),
  });
  