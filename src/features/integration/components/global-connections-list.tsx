"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  PlugZap,
  Search,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { getIntegrationProvider } from "@/features/integration/provider-registry";
import { useTRPC } from "@/trpc/react";

type IntegrationStatus = "ACTIVE" | "NEEDS_REAUTH" | "ERROR" | "DISABLED";

type StatusFilter = "ALL" | IntegrationStatus;

const statusFilters: ReadonlyArray<{
  value: StatusFilter;
  label: string;
}> = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Connected" },
  { value: "NEEDS_REAUTH", label: "Reconnect" },
  { value: "ERROR", label: "Errors" },
  { value: "DISABLED", label: "Disabled" },
];

const statusLabels: Record<IntegrationStatus, string> = {
  ACTIVE: "Connected",
  NEEDS_REAUTH: "Reconnect required",
  ERROR: "Connection error",
  DISABLED: "Disabled",
};

const statusClasses: Record<IntegrationStatus, string> = {
  ACTIVE:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  NEEDS_REAUTH:
    "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  ERROR: "border-destructive/20 bg-destructive/10 text-destructive",
  DISABLED: "border-border bg-muted text-muted-foreground",
};

function formatDate(value: Date | string | null): string {
  if (!value) {
    return "Never tested";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function StatusIcon({ status }: { status: IntegrationStatus }) {
  if (status === "ACTIVE") {
    return <CheckCircle2 className="size-4 text-emerald-600" />;
  }

  if (status === "NEEDS_REAUTH" || status === "ERROR") {
    return <AlertTriangle className="size-4 text-amber-600" />;
  }

  return <KeyRound className="size-4 text-muted-foreground" />;
}

export function GlobalConnectionsList() {
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const connections = useQuery(trpc.integration.listAll.queryOptions());

  const connectionRows = useMemo(
    () => connections.data ?? [],
    [connections.data],
  );

  const visibleConnections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return connectionRows.filter((connection) => {
      const provider = getIntegrationProvider(connection.provider);

      const matchesStatus =
        statusFilter === "ALL" || connection.status === statusFilter;

      const matchesQuery =
        !normalizedQuery ||
        connection.name.toLowerCase().includes(normalizedQuery) ||
        connection.workspaceName.toLowerCase().includes(normalizedQuery) ||
        provider.label.toLowerCase().includes(normalizedQuery) ||
        (connection.externalAccountName ?? "")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [connectionRows, query, statusFilter]);

  const groupedConnections = useMemo(() => {
    const groups = new Map<
      string,
      {
        workspaceId: string;
        workspaceName: string;
        workspaceRole: string;
        connections: typeof visibleConnections;
      }
    >();

    for (const connection of visibleConnections) {
      const existing = groups.get(connection.workspaceId);

      if (existing) {
        existing.connections.push(connection);
        continue;
      }

      groups.set(connection.workspaceId, {
        workspaceId: connection.workspaceId,
        workspaceName: connection.workspaceName,
        workspaceRole: connection.workspaceRole,
        connections: [connection],
      });
    }

    return Array.from(groups.values());
  }, [visibleConnections]);

  if (connections.isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border bg-card">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (connections.isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <p className="font-medium text-destructive">
          Unable to load app connections
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {connections.error.message}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-5">
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
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search connections..."
            aria-label="Search app connections"
            className="pl-9"
          />
        </div>
      </div>

      {connectionRows.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 text-center">
          <span className="flex size-11 items-center justify-center rounded-lg border bg-background">
            <PlugZap className="size-5" />
          </span>
          <h2 className="mt-4 font-semibold">No app connections</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Open a workspace to connect Slack, Google, GitHub, or another
            supported application.
          </p>
          <Link
            href="/workspaces"
            className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Choose a workspace
          </Link>
        </div>
      ) : groupedConnections.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <p className="font-medium">No matching connections</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different search or status filter.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedConnections.map((group) => (
            <section key={group.workspaceId} className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold">{group.workspaceName}</h2>
                  <p className="text-xs text-muted-foreground">
                    {group.workspaceRole} · {group.connections.length}{" "}
                    {group.connections.length === 1
                      ? "connection"
                      : "connections"}
                  </p>
                </div>

                <Link
                  href={`/workspaces/${group.workspaceId}#connections`}
                  className="inline-flex h-8 items-center justify-center gap-2 rounded-md border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Manage
                  <ExternalLink className="size-3.5" />
                </Link>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.connections.map((connection) => {
                  const provider = getIntegrationProvider(connection.provider);

                  return (
                    <article
                      key={connection.id}
                      className="rounded-xl border bg-card p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
                            <PlugZap className="size-5" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold">
                              {connection.name}
                            </h3>
                            <p className="truncate text-xs text-muted-foreground">
                              {provider.label}
                            </p>
                          </div>
                        </div>

                        <StatusIcon status={connection.status} />
                      </div>

                      <div className="mt-4 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Status</span>
                          <span
                            className={`rounded-full border px-2 py-0.5 font-medium ${statusClasses[connection.status]}`}
                          >
                            {statusLabels[connection.status]}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Account</span>
                          <span className="max-w-44 truncate font-medium">
                            {connection.externalAccountName || "Not provided"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">
                            Last tested
                          </span>
                          <span className="font-medium">
                            {formatDate(connection.lastTestedAt)}
                          </span>
                        </div>
                      </div>

                      {connection.lastError && (
                        <p className="mt-3 line-clamp-2 rounded-md bg-destructive/5 px-3 py-2 text-xs text-destructive">
                          {connection.lastError}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
