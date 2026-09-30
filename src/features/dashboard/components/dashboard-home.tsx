"use client";

import {
  type FormEvent,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  useRouter,
} from "next/navigation";
import {
  useQuery,
} from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Clock3,
  History,
  LayoutTemplate,
  Loader2,
  PlugZap,
  Sparkles,
  Star,
  Workflow,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/react";

const promptSuggestions = [
  "Summarize workflow input with AI and send it to Slack",
  "Classify a support request and create a GitHub issue",
  "Extract important details from input and add them to Google Sheets",
] as const;

const quickActions = [
  {
    title: "Blank workflow",
    description:
      "Build an automation from an empty canvas.",
    href: "/workspaces",
    icon: Workflow,
  },
  {
    title: "Use a template",
    description:
      "Start with a ready-made workflow structure.",
    href: "/templates",
    icon: LayoutTemplate,
  },
  {
    title: "Connect an app",
    description:
      "Add Google, Slack and other integrations.",
    href:
      "/workspaces?section=connections",
    icon: PlugZap,
  },
  {
    title: "View run history",
    description:
      "Inspect recent executions and failures.",
    href:
      "/workspaces?section=runs",
    icon: History,
  },
] as const;

function formatRelativeTime(
  value: Date | string
): string {
  const date = new Date(value);
  const now = Date.now();

  const difference =
    now - date.getTime();

  if (
    !Number.isFinite(difference)
  ) {
    return "Unknown";
  }

  if (difference < 60_000) {
    return "Just now";
  }

  const minutes = Math.floor(
    difference / 60_000
  );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(
    hours / 24
  );

  if (days < 7) {
    return `${days}d ago`;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      day: "numeric",
      month: "short",
    }
  ).format(date);
}

function getRunStatusIcon(
  status: string
) {
  switch (status) {
    case "SUCCESS":
      return (
        <CheckCircle2 className="size-4 text-emerald-600" />
      );

    case "FAILED":
      return (
        <AlertCircle className="size-4 text-destructive" />
      );

    case "RUNNING":
      return (
        <Loader2 className="size-4 animate-spin text-blue-600" />
      );

    default:
      return (
        <Clock3 className="size-4 text-amber-600" />
      );
  }
}

function getRunStatusClassName(
  status: string
): string {
  switch (status) {
    case "SUCCESS":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

    case "FAILED":
      return "border-destructive/20 bg-destructive/10 text-destructive";

    case "RUNNING":
      return "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300";

    default:
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
}

function getWorkflowStatusClassName(
  status: string
): string {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

    case "DRAFT":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";

    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function DashboardHome() {
  const router = useRouter();
  const trpc = useTRPC();

  const [
    prompt,
    setPrompt,
  ] = useState("");

  const workflows = useQuery(
    trpc.workflow.listAll.queryOptions({
      includeArchived: true,
      favoritesOnly: false,
    })
  );

  const runs = useQuery(
    trpc.workflow.listAllRuns.queryOptions({
      limit: 24,
    })
  );

  const workflowRows = useMemo(
    () => workflows.data ?? [],
    [workflows.data]
  );

  const runRows = useMemo(
    () => runs.data ?? [],
    [runs.data]
  );

  const statistics = useMemo(() => {
    const nonArchived =
      workflowRows.filter(
        (workflowItem) =>
          workflowItem.status !==
          "ARCHIVED"
      );

    const active =
      workflowRows.filter(
        (workflowItem) =>
          workflowItem.status ===
          "ACTIVE"
      ).length;

    const failedRuns =
      runRows.filter(
        (run) =>
          run.status === "FAILED"
      ).length;

    return {
      workflows:
        nonArchived.length,
      active,
      runs: runRows.length,
      failedRuns,
    };
  }, [
    runRows,
    workflowRows,
  ]);

  const recentWorkflows =
    useMemo(() => {
      return [...workflowRows]
        .filter(
          (workflowItem) =>
            workflowItem.status !==
            "ARCHIVED"
        )
        .sort((a, b) => {
          if (
            a.isFavorite !==
            b.isFavorite
          ) {
            return a.isFavorite
              ? -1
              : 1;
          }

          return (
            new Date(
              b.updatedAt
            ).getTime() -
            new Date(
              a.updatedAt
            ).getTime()
          );
        })
        .slice(0, 5);
    }, [workflowRows]);

  const recentRuns =
    useMemo(
      () => runRows.slice(0, 5),
      [runRows]
    );

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const normalizedPrompt =
      prompt.trim();

    if (
      normalizedPrompt.length < 10
    ) {
      return;
    }

    window.sessionStorage.setItem(
      "synapse:workflow-intent",
      normalizedPrompt
    );

    router.push(
      "/workspaces?create=assistant"
    );
  }

  const loading =
    workflows.isPending ||
    runs.isPending;

  const error =
    workflows.error ??
    runs.error;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 py-4 sm:py-8">
      <section className="mx-auto max-w-4xl text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-lg border bg-background shadow-sm">
          <Sparkles className="size-5" />
        </div>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
          What would you like
          Synapse to automate?
        </h1>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Describe the result you want.
          Synapse will turn it into an
          editable workflow draft for
          you to review and configure.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 text-left"
        >
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
            <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
              <Sparkles className="size-4" />

              <span>
                Synapse AI
              </span>

              <span className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Beta
              </span>
            </div>

            <textarea
              value={prompt}
              rows={5}
              minLength={10}
              maxLength={2_000}
              aria-label="Describe the workflow you want to create"
              placeholder="For example: Summarize the provided workflow input with AI and send the result to Slack."
              onChange={(event) => {
                setPrompt(
                  event.target.value
                );
              }}
              className="block w-full resize-none bg-transparent px-4 py-4 text-sm leading-6 outline-none placeholder:text-muted-foreground"
            />

            <div className="flex items-center justify-between gap-4 border-t px-3 py-3">
              <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
                <span>
                  Review the draft before
                  anything is created.
                </span>

                <span>
                  {prompt.length}/2000
                </span>
              </div>

              <Button
                type="submit"
                size="icon"
                disabled={
                  prompt.trim().length <
                  10
                }
                aria-label="Continue with this automation"
                className="ml-auto rounded-lg"
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {promptSuggestions.map(
            (suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setPrompt(
                    suggestion
                  );
                }}
                className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {suggestion}
              </button>
            )
          )}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            Start another way
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Create manually, use a
            template, or manage your
            connected applications.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map(
            (action) => {
              const Icon =
                action.icon;

              return (
                <Link
                  key={action.title}
                  href={action.href}
                  className="group rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-muted/40"
                >
                  <div className="flex size-9 items-center justify-center rounded-md border bg-background">
                    <Icon className="size-4" />
                  </div>

                  <h3 className="mt-4 text-sm font-semibold">
                    {action.title}
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {
                      action.description
                    }
                  </p>
                </Link>
              );
            }
          )}
        </div>
      </section>

      {loading && (
        <section className="flex min-h-52 items-center justify-center rounded-xl border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </section>
      )}

      {!loading && error && (
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <p className="font-medium text-destructive">
            Unable to load dashboard
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            {error.message}
          </p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              void Promise.all([
                workflows.refetch(),
                runs.refetch(),
              ]);
            }}
          >
            Try again
          </Button>
        </section>
      )}

      {!loading && !error && (
        <>
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">
                Overview
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                A quick view of your
                automations and recent
                execution activity.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-md border bg-background">
                    <Workflow className="size-4" />
                  </span>

                  <span className="text-xs text-muted-foreground">
                    Total
                  </span>
                </div>

                <p className="mt-4 text-2xl font-semibold tracking-tight">
                  {
                    statistics.workflows
                  }
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Workflows
                </p>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-md border bg-background">
                    <Zap className="size-4" />
                  </span>

                  <span className="text-xs text-muted-foreground">
                    Published
                  </span>
                </div>

                <p className="mt-4 text-2xl font-semibold tracking-tight">
                  {statistics.active}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Active workflows
                </p>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-md border bg-background">
                    <Activity className="size-4" />
                  </span>

                  <span className="text-xs text-muted-foreground">
                    Recent
                  </span>
                </div>

                <p className="mt-4 text-2xl font-semibold tracking-tight">
                  {statistics.runs}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Recent runs
                </p>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-md border bg-background">
                    <AlertCircle className="size-4" />
                  </span>

                  <span className="text-xs text-muted-foreground">
                    Recent
                  </span>
                </div>

                <p className="mt-4 text-2xl font-semibold tracking-tight">
                  {
                    statistics.failedRuns
                  }
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Failed runs
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-start justify-between gap-4 border-b p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Workflow className="size-4" />

                    <h2 className="font-semibold">
                      Recent workflows
                    </h2>
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Favorites are kept
                    near the top.
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link href="/workspaces" />
                  }
                >
                  View all
                  <ArrowRight className="size-4" />
                </Button>
              </div>

              {recentWorkflows.length ===
              0 ? (
                <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
                  <Workflow className="size-5 text-muted-foreground" />

                  <p className="mt-3 text-sm font-medium">
                    No workflows yet
                  </p>

                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Create an automation
                    manually or describe
                    what you want Synapse
                    to automate.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {recentWorkflows.map(
                    (workflowItem) => (
                      <Link
                        key={
                          workflowItem.id
                        }
                        href={`/workspaces/${workflowItem.workspaceId}/workflows/${workflowItem.id}`}
                        className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
                          <Workflow className="size-4" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {workflowItem.isFavorite && (
                              <Star className="size-3.5 fill-current text-amber-500" />
                            )}

                            <p className="truncate text-sm font-medium">
                              {
                                workflowItem.name
                              }
                            </p>
                          </div>

                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {
                              workflowItem.workspaceName
                            }
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getWorkflowStatusClassName(
                              workflowItem.status
                            )}`}
                          >
                            {
                              workflowItem.status
                            }
                          </span>

                          <span
                            suppressHydrationWarning
                            className="text-[10px] text-muted-foreground"
                          >
                            {formatRelativeTime(
                              workflowItem.updatedAt
                            )}
                          </span>
                        </div>
                      </Link>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-start justify-between gap-4 border-b p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <History className="size-4" />

                    <h2 className="font-semibold">
                      Recent activity
                    </h2>
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Latest workflow
                    execution results.
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link href="/workspaces?section=runs" />
                  }
                >
                  View all
                  <ArrowRight className="size-4" />
                </Button>
              </div>

              {recentRuns.length ===
              0 ? (
                <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
                  <History className="size-5 text-muted-foreground" />

                  <p className="mt-3 text-sm font-medium">
                    No runs yet
                  </p>

                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Run a published
                    workflow and its
                    execution will appear
                    here.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {recentRuns.map(
                    (run) => (
                      <Link
                        key={run.id}
                        href={`/workspaces/${run.workspaceId}/workflows/${run.workflowId}`}
                        className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
                          {getRunStatusIcon(
                            run.status
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {
                              run.workflowName
                            }
                          </p>

                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {
                              run.workspaceName
                            }
                            {" · "}
                            {run.triggerType.toLowerCase()}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getRunStatusClassName(
                              run.status
                            )}`}
                          >
                            {run.status}
                          </span>

                          <span
                            suppressHydrationWarning
                            className="text-[10px] text-muted-foreground"
                          >
                            {formatRelativeTime(
                              run.createdAt
                            )}
                          </span>
                        </div>
                      </Link>
                    )
                  )}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}