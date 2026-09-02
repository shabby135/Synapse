"use client";

import {
  useState,
  type FormEvent,
} from "react";

import {
  useMutation,
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

import { useTRPC } from "@/trpc/react";

export function CreateWorkspaceForm() {
  const [name, setName] = useState("");

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const createWorkspace = useMutation(
    trpc.workspace.create.mutationOptions({
      onSuccess: async () => {
        setName("");

        await queryClient.invalidateQueries(
          trpc.workspace.list.queryFilter()
        );

        toast.success(
          "Workspace created successfully."
        );
      },

      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (trimmedName.length < 3) {
      toast.error(
        "Workspace name must contain at least 3 characters."
      );

      return;
    }

    createWorkspace.mutate({
      name: trimmedName,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Create a workspace
        </CardTitle>

        <CardDescription>
          Workspaces contain your workflows,
          integrations and team members.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <Input
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="Engineering team"
            aria-label="Workspace name"
            maxLength={50}
            disabled={createWorkspace.isPending}
          />

          <Button
            type="submit"
            disabled={createWorkspace.isPending}
          >
            {createWorkspace.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Plus />
            )}

            Create
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}