"use client";

import {
  FormEvent,
  useState,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Loader2,
  Plus,
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

type CreateWorkflowFormProps = {
  workspaceId: string;
};

export function CreateWorkflowForm({
  workspaceId,
}: CreateWorkflowFormProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] =
    useState("");

  const workspace = useQuery(
    trpc.workspace.getById.queryOptions({
      id: workspaceId,
    })
  );

  const createWorkflow = useMutation(
    trpc.workflow.create.mutationOptions({
      onSuccess: async () => {
        setName("");
        setDescription("");

        await queryClient.invalidateQueries(
          trpc.workflow.list.queryFilter({
            workspaceId,
            includeArchived: false,
          })
        );

        toast.success("Workflow created.");
      },
    })
  );

  const canCreate =
    workspace.data &&
    hasWorkspacePermission(
      workspace.data.role,
      "workflow:create"
    );

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    createWorkflow.mutate({
      workspaceId,
      name,
      description:
        description.trim() || undefined,
    });
  }

  if (!canCreate) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Create a workflow
        </CardTitle>

        <CardDescription>
          Start with an empty workflow. Version
          1 will be created automatically.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
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
              value={name}
              maxLength={100}
              placeholder="Customer support automation"
              disabled={createWorkflow.isPending}
              onChange={(event) =>
                setName(event.target.value)
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
              value={description}
              maxLength={500}
              rows={3}
              placeholder="Describe what this workflow will automate."
              disabled={createWorkflow.isPending}
              onChange={(event) =>
                setDescription(
                  event.target.value
                )
              }
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {createWorkflow.error && (
            <p className="text-sm font-medium text-destructive">
              {createWorkflow.error.message}
            </p>
          )}

          <Button
            type="submit"
            disabled={
              createWorkflow.isPending ||
              name.trim().length < 2
            }
          >
            {createWorkflow.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}

            Create workflow
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}