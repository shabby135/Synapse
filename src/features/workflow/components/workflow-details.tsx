"use client";

import {
  useState,
  type FormEvent,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Eye,
  History,
  Loader2,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { hasWorkspacePermission } from "@/features/workspace/permissions";
import { useTRPC } from "@/trpc/react";

import { RunWorkflowControl } from "./run-workflow-control";
import { WorkflowBuilder } from "./workflow-builder";
import { WorkflowRunDetailsDialog } from "./workflow-run-details-dialog";

type WorkflowDetailsProps = {
  workspaceId: string;
  workflowId: string;
};

function getRunStatusClassName(
  status: string
) {
  switch (status) {
    case "SUCCESS":
      return "bg-green-500/10 text-green-700";

    case "FAILED":
      return "bg-destructive/10 text-destructive";

    case "RUNNING":
      return "bg-blue-500/10 text-blue-700";

    case "CANCELLED":
      return "bg-muted text-muted-foreground";

    default:
      return "bg-amber-500/10 text-amber-700";
  }
}

export function WorkflowDetails({
  workspaceId,
  workflowId,
}: WorkflowDetailsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [
    selectedRunId,
    setSelectedRunId,
  ] = useState<string | null>(null);

  const workflow = useQuery(
    trpc.workflow.getById.queryOptions({
      id: workflowId,
    })
  );

  const workspace = useQuery(
    trpc.workspace.getById.queryOptions({
      id: workspaceId,
    })
  );

  const runs = useQuery(
    trpc.workflow.listRuns.queryOptions({
      workflowId,
      limit: 20,
    })
  );

  const updateWorkflow = useMutation(
    trpc.workflow.update.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(
            trpc.workflow.getById.queryFilter({
              id: workflowId,
            })
          ),

          queryClient.invalidateQueries(
            trpc.workflow.list.queryFilter({
              workspaceId,
              includeArchived: false,
            })
          ),
        ]);

        toast.success(
          "Workflow updated."
        );
      },
    })
  );

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const formData = new FormData(
      event.currentTarget
    );

    const name = String(
      formData.get("name") ?? ""
    ).trim();

    const description = String(
      formData.get("description") ?? ""
    ).trim();

    updateWorkflow.mutate({
      id: workflowId,
      name,
      description:
        description || null,
    });
  }

  if (
    workflow.isPending ||
    workspace.isPending
  ) {
    return (
      <Card>
        <CardContent className="flex min-h-56 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (
    workflow.isError ||
    workspace.isError
  ) {
    const error =
      workflow.error ??
      workspace.error;

    return (
      <Card>
        <CardContent>
          <p className="font-medium text-destructive">
            Unable to load workflow
          </p>

          <p className="mt-1 text-sm text-destructive">
            {error?.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const canUpdate =
    hasWorkspacePermission(
      workspace.data.role,
      "workflow:update"
    );

  const canExecute =
    workflow.data.status === "ACTIVE" &&
    hasWorkspacePermission(
      workspace.data.role,
      "workflow:execute"
    );

  const canEdit =
    canUpdate &&
    workflow.data.status !==
      "ARCHIVED";

  const latestDefinition =
    workflow.data.versions[0]
      ?.definition ?? {
      nodes: [],
      edges: [],
    };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-muted p-3">
                <WorkflowIcon className="size-6" />
              </div>

              <div>
                <CardTitle>
                  {workflow.data.name}
                </CardTitle>

                <CardDescription className="mt-1">
                  {workflow.data
                    .description ??
                    "No description provided."}
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                {workflow.data.status}
              </span>

              <RunWorkflowControl
                workflowId={workflowId}
                canExecute={canExecute}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <WorkflowBuilder
            workflowId={workflowId}
            workspaceId={workspaceId}
            canEdit={canEdit}
            initialDefinition={
              latestDefinition
            }
          />
        </CardContent>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>
              Workflow settings
            </CardTitle>

            <CardDescription>
              Update the workflow name and
              description.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              key={workflow.data.updatedAt.toString()}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label
                  htmlFor="workflow-name"
                  className="text-sm font-medium"
                >
                  Name
                </label>

                <Input
                  id="workflow-name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  defaultValue={
                    workflow.data.name
                  }
                  disabled={
                    updateWorkflow.isPending
                  }
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="workflow-description"
                  className="text-sm font-medium"
                >
                  Description
                </label>

                <textarea
                  id="workflow-description"
                  name="description"
                  rows={4}
                  maxLength={500}
                  defaultValue={
                    workflow.data
                      .description ?? ""
                  }
                  disabled={
                    updateWorkflow.isPending
                  }
                  className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {updateWorkflow.error && (
                <p className="text-sm font-medium text-destructive">
                  {
                    updateWorkflow.error
                      .message
                  }
                </p>
              )}

              <Button
                type="submit"
                disabled={
                  updateWorkflow.isPending
                }
              >
                {updateWorkflow.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}

                Save changes
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="size-5" />

            <CardTitle>
              Run history
            </CardTitle>
          </div>

          <CardDescription>
            Recent manual executions of this
            workflow.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {runs.isPending && (
            <div className="flex min-h-24 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {runs.isError && (
            <div>
              <p className="font-medium text-destructive">
                Unable to load run history
              </p>

              <p className="mt-1 text-sm text-destructive">
                {runs.error.message}
              </p>
            </div>
          )}

          {runs.isSuccess &&
            runs.data.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                This workflow has not been
                executed yet.
              </p>
            )}

          {runs.isSuccess &&
            runs.data.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">
                    Manual run
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(
                      run.createdAt
                    ).toLocaleString()}
                  </p>

                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {run.id}
                  </p>

                  {run.error && (
                    <p className="mt-2 text-sm text-destructive">
                      {run.error}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${getRunStatusClassName(
                      run.status
                    )}`}
                  >
                    {run.status}
                  </span>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSelectedRunId(
                        run.id
                      )
                    }
                  >
                    <Eye className="size-4" />
                    Details
                  </Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="size-5" />

            <CardTitle>
              Version history
            </CardTitle>
          </div>

          <CardDescription>
            Saved versions of this workflow.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {workflow.data.versions.map(
            (version) => (
              <div
                key={version.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">
                    Version{" "}
                    {version.version}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    Workflow definition
                    snapshot
                  </p>
                </div>

                <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                  {version.status}
                </span>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {selectedRunId && (
        <WorkflowRunDetailsDialog
          runId={selectedRunId}
          open
          onOpenChange={(open) => {
            if (!open) {
              setSelectedRunId(null);
            }
          }}
        />
      )}
    </div>
  );
}
