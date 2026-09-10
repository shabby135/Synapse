"use client";

import Link from "next/link";
import {
  Activity,
  CircleCheckBig,
  CircleX,
  Clock3,
  Loader2,
} from "lucide-react";
import {
  useQuery,
} from "@tanstack/react-query";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  hasWorkspacePermission,
} from "@/features/workspace/permissions";
import { useTRPC } from "@/trpc/react";

type WorkspaceMonitoringCardProps = {
  workspaceId: string;
};

type MetricProps = {
  label: string;
  value: string | number;
  icon: React.ReactNode;
};

function Metric({
  label,
  value,
  icon,
}: MetricProps) {
  return (
    <div className="rounded-md border p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>

      <p className="mt-2 text-2xl font-semibold">
        {value}
      </p>
    </div>
  );
}

export function WorkspaceMonitoringCard({
  workspaceId,
}: WorkspaceMonitoringCardProps) {
  const trpc = useTRPC();

  const workspace = useQuery(
    trpc.workspace.getById.queryOptions({
      id: workspaceId,
    })
  );

  const canReadWorkflows =
    workspace.isSuccess &&
    hasWorkspacePermission(
      workspace.data.role,
      "workflow:read"
    );

  const summary = useQuery({
    ...trpc.monitoring
      .getSummary
      .queryOptions({
        workspaceId,
      }),
    enabled: canReadWorkflows,
  });

  if (
    workspace.isPending ||
    summary.isPending
  ) {
    return (
      <Card>
        <CardContent className="flex min-h-48 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (
    workspace.isError ||
    !canReadWorkflows
  ) {
    return null;
  }

  if (summary.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            Execution monitoring
          </CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-sm font-medium text-destructive">
            {summary.error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="size-5" />

          <CardTitle>
            Execution monitoring
          </CardTitle>
        </div>

        <CardDescription>
          Workflow activity for{" "}
          {new Date(
            summary.data.periodStart
          ).toLocaleDateString(
            "en-US",
            {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }
          )}
          .
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Total runs"
            value={
              summary.data.totalRuns
            }
            icon={
              <Activity className="size-4" />
            }
          />

          <Metric
            label="Success rate"
            value={
              summary.data.successRate ===
              null
                ? "—"
                : `${summary.data.successRate}%`
            }
            icon={
              <CircleCheckBig className="size-4 text-green-600" />
            }
          />

          <Metric
            label="Failed"
            value={
              summary.data.statuses
                .FAILED
            }
            icon={
              <CircleX className="size-4 text-destructive" />
            }
          />

          <Metric
            label="In progress"
            value={
              summary.data.statuses
                .PENDING +
              summary.data.statuses
                .RUNNING
            }
            icon={
              <Clock3 className="size-4 text-amber-600" />
            }
          />
        </div>

        <div>
          <h3 className="font-medium">
            Recent failures
          </h3>

          {summary.data.recentFailures
            .length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No failed workflow runs.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {summary.data.recentFailures.map(
                (failure) => (
                  <Link
                    key={failure.id}
                    href={`/workspaces/${workspaceId}/workflows/${failure.workflowId}`}
                    className="block rounded-md border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {
                          failure.workflowName
                        }
                      </p>

                      <time className="text-xs text-muted-foreground">
                        {new Date(
                          failure.createdAt
                        ).toLocaleString(
                          "en-US",
                          {
                            timeZone:
                              "UTC",
                          }
                        )}
                      </time>
                    </div>

                    <p className="mt-1 text-sm text-destructive">
                      {failure.error ??
                        "Workflow execution failed."}
                    </p>
                  </Link>
                )
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}