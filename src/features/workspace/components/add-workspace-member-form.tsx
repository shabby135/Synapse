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
  Loader2,
  UserPlus,
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

type AddWorkspaceMemberFormProps = {
  workspaceId: string;
};

type AssignableRole =
  | "ADMIN"
  | "EDITOR"
  | "VIEWER";

export function AddWorkspaceMemberForm({
  workspaceId,
}: AddWorkspaceMemberFormProps) {
  const [email, setEmail] = useState("");

  const [role, setRole] =
    useState<AssignableRole>("VIEWER");

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const workspace = useQuery(
    trpc.workspace.getById.queryOptions({
      id: workspaceId,
    })
  );

  const addMember = useMutation(
    trpc.workspace.addMember.mutationOptions({
      onSuccess: async () => {
        setEmail("");
        setRole("VIEWER");

        await queryClient.invalidateQueries(
          trpc.workspace.listMembers.queryFilter({
            id: workspaceId,
          })
        );

        toast.success(
          "Member added successfully."
        );
      },

      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const canManageMembers =
    workspace.data?.role === "OWNER" ||
    workspace.data?.role === "ADMIN";

  if (
    workspace.isPending ||
    !canManageMembers
  ) {
    return null;
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error(
        "Enter the member's email address."
      );

      return;
    }

    addMember.mutate({
      workspaceId,
      email: normalizedEmail,
      role,
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserPlus className="size-5" />

          <CardTitle>
            Add member
          </CardTitle>
        </div>

        <CardDescription>
          The user must already have a
          Synapse account.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 md:grid-cols-[1fr_180px_auto]"
        >
          <Input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="member@example.com"
            aria-label="Member email"
            disabled={addMember.isPending}
          />

          <select
            value={role}
            onChange={(event) =>
              setRole(
                event.target
                  .value as AssignableRole
              )
            }
            disabled={addMember.isPending}
            aria-label="Member role"
            className="h-8 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="ADMIN">
              Admin
            </option>

            <option value="EDITOR">
              Editor
            </option>

            <option value="VIEWER">
              Viewer
            </option>
          </select>

          <Button
            type="submit"
            disabled={addMember.isPending}
          >
            {addMember.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <UserPlus />
            )}

            Add member
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}