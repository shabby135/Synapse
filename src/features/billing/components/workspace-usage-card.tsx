"use client";

import {
  CreditCard,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
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

type WorkspaceUsageCardProps = {
  workspaceId: string;
};

type UsageMeterProps = {
  label: string;
  value: number;
  limit: number;
};

const numberFormatter =
  new Intl.NumberFormat("en-US");

function UsageMeter({
  label,
  value,
  limit,
}: UsageMeterProps) {
  const percentage =
    limit > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (value / limit) * 100
          )
        )
      : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium">
          {label}
        </span>

        <span className="text-muted-foreground">
          {numberFormatter.format(value)}
          {" / "}
          {numberFormatter.format(limit)}
        </span>
      </div>

      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={value}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={
            percentage >= 90
              ? "h-full rounded-full bg-destructive transition-all"
              : percentage >= 75
                ? "h-full rounded-full bg-amber-500 transition-all"
                : "h-full rounded-full bg-primary transition-all"
          }
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

export function WorkspaceUsageCard({
  workspaceId,
}: WorkspaceUsageCardProps) {
  const trpc = useTRPC();
  const queryClient =
    useQueryClient();

  const workspace = useQuery(
    trpc.workspace.getById.queryOptions({
      id: workspaceId,
    })
  );

  const canReadBilling =
    workspace.isSuccess &&
    hasWorkspacePermission(
      workspace.data.role,
      "billing:read"
    );

  const canManageBilling =
    workspace.isSuccess &&
    hasWorkspacePermission(
      workspace.data.role,
      "billing:manage"
    );

  const usageQueryOptions =
    trpc.billing.getUsage.queryOptions({
      workspaceId,
    });

  const usage = useQuery({
    ...usageQueryOptions,
    enabled: canReadBilling,
  });

  const checkout = useMutation(
    trpc.billing
      .createCheckoutSession
      .mutationOptions({
        onSuccess: (result) => {
          window.location.assign(
            result.url
          );
        },
      })
  );

  const synchronize =
    useMutation(
      trpc.billing
        .syncSubscription
        .mutationOptions({
          onSuccess: async () => {
            await queryClient.invalidateQueries(
              {
                queryKey:
                  usageQueryOptions.queryKey,
              }
            );
          },
        })
    );

  if (workspace.isPending) {
    return (
      <Card>
        <CardContent className="flex min-h-40 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (
    workspace.isError ||
    !canReadBilling
  ) {
    return null;
  }

  if (usage.isPending) {
    return (
      <Card>
        <CardContent className="flex min-h-40 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (usage.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            Usage and billing
          </CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-sm font-medium text-destructive">
            {usage.error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalAiTokens =
    usage.data.usage.aiTokens;

  const isBillingActionPending =
    checkout.isPending ||
    synchronize.isPending;

const canSynchronize =
  usage.data.plan === "FREE" &&
  canManageBilling &&
  Boolean(usage.data.subscription);


  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-5" />

              <CardTitle>
                Usage and billing
              </CardTitle>
            </div>

            <CardDescription className="mt-1">
              Usage for{" "}
              {new Date(
                usage.data.periodStart
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
          </div>

          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {usage.data.plan}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <UsageMeter
          label="Workflow runs"
          value={
            usage.data.usage
              .workflowRuns
          }
          limit={
            usage.data.limits
              .workflowRunsPerMonth
          }
        />

        <UsageMeter
          label="Action executions"
          value={
            usage.data.usage
              .actionExecutions
          }
          limit={
            usage.data.limits
              .actionExecutionsPerMonth
          }
        />

        <UsageMeter
          label="AI tokens"
          value={totalAiTokens}
          limit={
            usage.data.limits
              .aiTokensPerMonth
          }
        />

        {usage.data.subscription && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">
              Subscription status:{" "}
              {
                usage.data.subscription
                  .status
              }
            </p>

            {usage.data.subscription
              .currentPeriodEnd && (
              <p className="mt-1 text-muted-foreground">
                Current period ends{" "}
                {new Date(
                  usage.data.subscription
                    .currentPeriodEnd
                ).toLocaleDateString(
                  "en-US",
                  {
                    timeZone: "UTC",
                  }
                )}
                .
              </p>
            )}

            {usage.data.subscription
              .cancelAtPeriodEnd && (
              <p className="mt-1 text-amber-700">
                This subscription will
                cancel at the end of the
                current period.
              </p>
            )}
          </div>
        )}

        {usage.data.plan === "FREE" &&
          canManageBilling && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={
                    isBillingActionPending
                  }
                  onClick={() => {
                    synchronize.reset();
                    checkout.mutate({
                      workspaceId,
                    });
                  }}
                >
                  {checkout.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CreditCard className="size-4" />
                  )}

                  Upgrade to PRO
                </Button>

                {canSynchronize && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      isBillingActionPending
                    }
                    onClick={() => {
                      checkout.reset();
                      synchronize.mutate({
                        workspaceId,
                      });
                    }}
                  >
                    {synchronize.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}

                    Synchronize subscription
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Checkout runs in Stripe
                test mode during local
                development.
              </p>
            </div>
          )}

        {synchronize.isSuccess && (
          <p className="text-sm font-medium text-green-600">
            Subscription synchronized successfully.
          </p>
        )}

        {checkout.error && (
          <p className="text-sm font-medium text-destructive">
            {checkout.error.message}
          </p>
        )}

        {synchronize.error && (
          <p className="text-sm font-medium text-destructive">
            {synchronize.error.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}