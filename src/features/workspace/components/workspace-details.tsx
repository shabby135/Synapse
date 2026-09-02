"use client";

import { useQuery } from "@tanstack/react-query";

import {
  CalendarDays,
  FolderKanban,
  Loader2,
  Shield,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useTRPC } from "@/trpc/react";

type WorkspaceDetailsProps = {
  workspaceId: string;
};

export function WorkspaceDetails({
  workspaceId,
}: WorkspaceDetailsProps) {
  const trpc = useTRPC();

  const workspace = useQuery(
    trpc.workspace.getById.queryOptions({
      id: workspaceId,
    })
  );

  if (workspace.isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (workspace.isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <p className="font-medium text-destructive">
          Unable to open workspace
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          {workspace.error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <FolderKanban className="size-6 text-primary" />
          </div>

          <CardTitle className="text-2xl">
            {workspace.data.name}
          </CardTitle>

          <CardDescription>
            /{workspace.data.slug}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="size-4 text-muted-foreground" />

            <span>
              Your role:
              {" "}
              <strong>
                {workspace.data.role}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="size-4 text-muted-foreground" />

            <span>
              Created{" "}
              {new Date(
                workspace.data.createdAt
              ).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}