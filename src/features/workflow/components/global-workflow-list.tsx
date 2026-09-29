"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock3,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Workflow,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

type WorkflowStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type StatusFilter = "ALL" | WorkflowStatus;

const statusFilters: ReadonlyArray<{
  value: StatusFilter;
  label: string;
}> = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Archived" },
];

const workflowStatusClasses: Record<WorkflowStatus, string> = {
  ACTIVE:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  DRAFT:
    "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  ARCHIVED: "border-border bg-muted text-muted-foreground",
};

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function RunStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "SUCCESS":
      return <CircleCheck className="size-4 text-emerald-600" />;

    case "FAILED":
      return <CircleX className="size-4 text-destructive" />;

    case "RUNNING":
      return <Loader2 className="size-4 animate-spin text-blue-600" />;

    case "PENDING":
      return <Clock3 className="size-4 text-amber-600" />;

    default:
      return <CircleDashed className="size-4 text-muted-foreground" />;
  }
}

export function GlobalWorkflowList() {
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const workflows = useQuery(
    trpc.workflow.listAll.queryOptions({
      includeArchived: true,
    }),
  );

  const workflowRows = useMemo(() => workflows.data ?? [], [workflows.data]);

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = {
      ALL: workflowRows.length,
      ACTIVE: 0,
      DRAFT: 0,
      ARCHIVED: 0,
    };

    for (const workflowItem of workflowRows) {
      result[workflowItem.status] += 1;
    }

    return result;
  }, [workflowRows]);

  const visibleWorkflows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return workflowRows.filter((workflowItem) => {
      const matchesStatus =
        statusFilter === "ALL" || workflowItem.status === statusFilter;

      const matchesQuery =
        !normalizedQuery ||
        workflowItem.name.toLowerCase().includes(normalizedQuery) ||
        (workflowItem.description ?? "")
          .toLowerCase()
          .includes(normalizedQuery) ||
        workflowItem.workspaceName.toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [query, statusFilter, workflowRows]);

  if (workflows.isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border bg-card">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (workflows.isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <p className="font-medium text-destructive">
          Unable to load automations
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {workflows.error.message}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => {
            const active = statusFilter === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {filter.label}
                <span className="ml-2 text-xs opacity-70">
                  {counts[filter.value]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search automations..."
            aria-label="Search automations"
            className="pl-9"
          />
        </div>
      </div>

      {workflowRows.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 text-center">
          <div className="flex size-11 items-center justify-center rounded-lg border bg-background">
            <Workflow className="size-5" />
          </div>
          <h2 className="mt-4 font-semibold">No automations yet</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Create a workflow manually or describe what you want Synapse to
            automate.
          </p>
          <Link
            href="/workspaces?create=assistant"
            className="mt-5 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-4" />
            Create automation
          </Link>
        </div>
      ) : visibleWorkflows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <p className="font-medium">No matching automations</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different search or status filter.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_7rem_9rem_7rem_2rem] gap-4 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <span>Automation</span>
            <span>Workspace</span>
            <span>Status</span>
            <span>Latest run</span>
            <span>Updated</span>
            <span className="sr-only">Open</span>
          </div>

          <div className="divide-y">
            {visibleWorkflows.map((workflowItem) => {
              const href = `/workspaces/${workflowItem.workspaceId}/workflows/${workflowItem.id}`;

              return (
                <Link
                  key={workflowItem.id}
                  href={href}
                  className="group block px-4 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_7rem_9rem_7rem_2rem] md:items-center md:gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                          <Workflow className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {workflowItem.name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {workflowItem.description || "No description"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        {workflowItem.workspaceName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {workflowItem.workspaceRole}
                      </p>
                    </div>

                    <div>
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${workflowStatusClasses[workflowItem.status]}`}
                      >
                        {workflowItem.status.toLowerCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      {workflowItem.latestRun ? (
                        <>
                          <RunStatusIcon
                            status={workflowItem.latestRun.status}
                          />
                          <span className="capitalize text-muted-foreground">
                            {workflowItem.latestRun.status.toLowerCase()}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Never run</span>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {formatDate(workflowItem.updatedAt)}
                    </p>

                    <ExternalLink className="hidden size-4 text-muted-foreground transition-colors group-hover:text-foreground md:block" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
