"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";

import {
  ArrowUpRight,
  FolderKanban,
  Loader2,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useTRPC } from "@/trpc/react";

export function WorkspaceList() {
  const trpc = useTRPC();

  const workspaces = useQuery(
    trpc.workspace.list.queryOptions()
  );

  if (workspaces.isPending) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xl border">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (workspaces.isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <p className="font-medium text-destructive">
          Unable to load workspaces
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          {workspaces.error.message}
        </p>
      </div>
    );
  }

  if (workspaces.data.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed text-center">
        <FolderKanban className="mb-3 size-8 text-muted-foreground" />

        <p className="font-medium">
          No workspaces yet
        </p>

        <p className="text-sm text-muted-foreground">
          Create your first workspace using
          the form above.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {workspaces.data.map((workspace) => (
        <Link
          key={workspace.id}
          href={`/workspaces/${workspace.id}`}
          className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <FolderKanban className="size-5 text-primary" />
                </div>

                <ArrowUpRight className="size-4 text-muted-foreground" />
              </div>

              <CardTitle>
                {workspace.name}
              </CardTitle>

              <CardDescription>
                /{workspace.slug}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                {workspace.role}
              </span>

              <span className="text-xs text-muted-foreground">
                {new Date(
                  workspace.createdAt
                ).toLocaleDateString()}
              </span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}