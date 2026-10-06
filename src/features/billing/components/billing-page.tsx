"use client";

import { useState } from "react";
import Link from "next/link";
import Script from "next/script";
import {
  Check,
  CreditCard,
  Loader2,
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
import { useTRPC } from "@/trpc/react";

type RazorpayCheckoutOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  theme?: {
    color?: string;
  };
  handler?: () => void;
  modal?: {
    ondismiss?: () => void;
  };
};

type RazorpayInstance = {
  open: () => void;
};

type RazorpayConstructor = new (
  options: RazorpayCheckoutOptions
) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

const FREE_LIMITS = {
  workflowRuns: "100 / month",
  actionExecutions: "500 / month",
  aiTokens: "100K / month",
};

const PRO_LIMITS = {
  workflowRuns: "10,000 / month",
  actionExecutions: "50,000 / month",
  aiTokens: "5M / month",
};

export function BillingPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const membershipQuery = useQuery(
    trpc.billing.getMembership.queryOptions()
  );

  const workspaceQuery = useQuery(
    trpc.workspace.list.queryOptions()
  );

  const ownedWorkspaces =
    (workspaceQuery.data ?? []).filter(
      (workspace) =>
        workspace.role === "OWNER"
    );

  const [
    selectedWorkspaceId,
    setSelectedWorkspaceId,
  ] = useState<string | null>(null);

  const selectedWorkspace =
    ownedWorkspaces.find(
      (workspace) =>
        workspace.id ===
        selectedWorkspaceId
    ) ?? ownedWorkspaces[0];

  const checkout = useMutation(
    trpc.billing.createCheckoutSession.mutationOptions(
      {
        onSuccess: (result) => {
          if (!window.Razorpay) {
            checkout.reset();
            return;
          }

          const razorpay =
            new window.Razorpay({
              key: result.keyId,
              subscription_id:
                result.subscriptionId,
              name: "Synapse",
              description:
                "Synapse PRO subscription",
              theme: {
                color: "#000000",
              },
              handler: () => {
                void queryClient.invalidateQueries(
                  {
                    queryKey:
                      trpc.billing.getMembership.queryKey(),
                  }
                );

                void membershipQuery.refetch();

                void workspaceQuery.refetch();
              },
              modal: {
                ondismiss: () => {
                  checkout.reset();
                },
              },
            });

          razorpay.open();
        },
      }
    )
  );

  const membership =
    membershipQuery.data;

  const isPro =
    membership?.plan === "PRO";

  const isLoading =
    membershipQuery.isPending ||
    workspaceQuery.isPending;

  const handleWorkspaceChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setSelectedWorkspaceId(
      event.target.value
    );
  };

  const handleUpgrade = () => {
    if (!selectedWorkspace) {
      return;
    }

    checkout.mutate({
      workspaceId:
        selectedWorkspace.id,
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (
    membershipQuery.isError ||
    workspaceQuery.isError
  ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            Membership and billing
          </CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-sm font-medium text-destructive">
            {membershipQuery.error?.message ??
              workspaceQuery.error?.message ??
              "Unable to load billing information."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />

      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="size-5" />

            <h1 className="text-2xl font-semibold tracking-tight">
              Membership and billing
            </h1>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage your Synapse membership,
            workspace limits, and subscription.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>
                  Current membership
                </CardTitle>

                <CardDescription className="mt-1">
                  Your account-level Synapse
                  membership.
                </CardDescription>
              </div>

              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {isPro ? "PRO" : "FREE"}
              </span>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {isPro ? (
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="font-medium">
                  Synapse PRO is active.
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  You have unlimited workspaces
                  and the higher PRO usage limits.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {membership?.trialActive
                        ? "Free trial"
                        : "Free trial expired"}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {membership?.trialActive
                        ? `${membership.trialDaysRemaining} day${
                            membership.trialDaysRemaining ===
                            1
                              ? ""
                              : "s"
                          } remaining`
                        : "Upgrade to PRO to continue with full access."}
                    </p>
                  </div>

                  <span className="text-sm font-medium">
                    {membership?.workspaceCount ?? 0}/
                    {membership?.workspaceLimit ?? 3}{" "}
                    workspaces
                  </span>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <LimitItem
                label="Workflow runs"
                value={
                  isPro
                    ? PRO_LIMITS.workflowRuns
                    : FREE_LIMITS.workflowRuns
                }
              />

              <LimitItem
                label="Action executions"
                value={
                  isPro
                    ? PRO_LIMITS.actionExecutions
                    : FREE_LIMITS.actionExecutions
                }
              />

              <LimitItem
                label="AI tokens"
                value={
                  isPro
                    ? PRO_LIMITS.aiTokens
                    : FREE_LIMITS.aiTokens
                }
              />
            </div>
          </CardContent>
        </Card>

        {!isPro && (
          <Card className="border-primary/30">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-5" />

                    <CardTitle>
                      Upgrade to PRO
                    </CardTitle>
                  </div>

                  <CardDescription className="mt-1">
                    Unlock unlimited workspaces
                    and higher automation limits.
                  </CardDescription>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-semibold">
                    ₹599
                  </p>

                  <p className="text-xs text-muted-foreground">
                    per month
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Feature text="Unlimited workspaces" />
                <Feature text="10,000 workflow runs/month" />
                <Feature text="50,000 action executions/month" />
                <Feature text="5M AI tokens/month" />
              </div>

              {!selectedWorkspace &&
              ownedWorkspaces.length === 0 ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-sm font-medium">
                    Create a workspace before
                    upgrading.
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Your PRO subscription needs to
                    be associated with a workspace.
                  </p>

                  <Button
                    className="mt-3"
                    render={
                      <Link href="/workspaces" />
                    }
                  >
                    Go to workspaces
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {ownedWorkspaces.length > 1 && (
                    <div className="space-y-2">
                      <label
                        htmlFor="billing-workspace"
                        className="text-sm font-medium"
                      >
                        Subscription workspace
                      </label>

                      <select
                        id="billing-workspace"
                        value={
                          selectedWorkspace?.id ??
                          ""
                        }
                        onChange={
                          handleWorkspaceChange
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {ownedWorkspaces.map(
                          (workspace) => (
                            <option
                              key={
                                workspace.id
                              }
                              value={
                                workspace.id
                              }
                            >
                              {workspace.name}
                            </option>
                          )
                        )}
                      </select>

                      <p className="text-xs text-muted-foreground">
                        The subscription will be
                        associated with the selected
                        workspace.
                      </p>
                    </div>
                  )}

                  {selectedWorkspace && (
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <p className="text-xs font-medium text-muted-foreground">
                        Billing workspace
                      </p>

                      <p className="mt-1 font-medium">
                        {selectedWorkspace.name}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        You are the owner of this
                        workspace.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <Button
                      type="button"
                      size="lg"
                      disabled={
                        checkout.isPending ||
                        !selectedWorkspace
                      }
                      onClick={
                        handleUpgrade
                      }
                    >
                      {checkout.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CreditCard className="size-4" />
                      )}

                      Upgrade to PRO · ₹599/month
                    </Button>

                    <p className="text-xs text-muted-foreground">
                      Secure payment is provided by
                      Razorpay. Your subscription status
                      is confirmed through the Synapse
                      billing webhook.
                    </p>
                  </div>
                </div>
              )}

              {checkout.error && (
                <p className="text-sm font-medium text-destructive">
                  {checkout.error.message}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {isPro && (
          <Card>
            <CardHeader>
              <CardTitle>
                PRO membership
              </CardTitle>

              <CardDescription>
                Your account currently has an
                active PRO membership.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <Feature text="Unlimited workspaces" />
                <Feature text="10,000 workflow runs/month" />
                <Feature text="50,000 action executions/month" />
                <Feature text="5M AI tokens/month" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function LimitItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs font-medium text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold">
        {value}
      </p>
    </div>
  );
}

function Feature({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Check className="size-3" />
      </span>

      <span>{text}</span>
    </div>
  );
}