"use client";

import { useState } from "react";
import {
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import {
  Loader2,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { WorkspaceRole } from "@/features/workspace/permissions";
import { useTRPC } from "@/trpc/react";

type WorkspaceMembersProps = {
  workspaceId: string;
};

type EditableWorkspaceRole = Exclude<
  WorkspaceRole,
  "OWNER"
>;

type RemovalCandidate = {
  userId: string;
  name: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function WorkspaceMembers({
  workspaceId,
}: WorkspaceMembersProps) {
  const trpc = useTRPC();

  const [
    removalCandidate,
    setRemovalCandidate,
  ] = useState<RemovalCandidate | null>(
    null
  );

  const members = useQuery(
    trpc.workspace.listMembers.queryOptions({
      id: workspaceId,
    })
  );

  const workspace = useQuery(
    trpc.workspace.getById.queryOptions({
      id: workspaceId,
    })
  );

  const updateRole = useMutation(
    trpc.workspace.updateMemberRole.mutationOptions({
      onSuccess: async () => {
        toast.success("Member role updated.");
        await members.refetch();
      },
    })
  );

  const removeMember = useMutation(
    trpc.workspace.removeMember.mutationOptions({
      onSuccess: async () => {
        setRemovalCandidate(null);
        toast.success("Member removed.");
        await members.refetch();
      },
    })
  );

  const currentUserRole = workspace.data?.role;

  const mutationError =
    updateRole.error?.message ??
    removeMember.error?.message;

  function canManageMember(
    memberRole: WorkspaceRole
  ) {
    if (memberRole === "OWNER") {
      return false;
    }

    if (currentUserRole === "OWNER") {
      return true;
    }

    if (currentUserRole === "ADMIN") {
      return (
        memberRole === "EDITOR" ||
        memberRole === "VIEWER"
      );
    }

    return false;
  }

  function handleRoleChange(
    userId: string,
    role: EditableWorkspaceRole
  ) {
    updateRole.mutate({
      workspaceId,
      userId,
      role,
    });
  }

  function handleRemove() {
    if (!removalCandidate) {
      return;
    }

    removeMember.mutate({
      workspaceId,
      userId: removalCandidate.userId,
    });
  }

  if (members.isPending) {
    return (
      <Card>
        <CardContent className="flex min-h-40 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (members.isError) {
    return (
      <Card>
        <CardContent>
          <p className="font-medium text-destructive">
            Unable to load members
          </p>

          <p className="mt-1 text-sm text-destructive">
            {members.error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="size-5" />
            <CardTitle>Members</CardTitle>
          </div>

          <CardDescription>
            {members.data.length}{" "}
            {members.data.length === 1
              ? "member"
              : "members"}{" "}
            in this workspace
          </CardDescription>

          {mutationError && (
            <p className="text-sm font-medium text-destructive">
              {mutationError}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {members.data.map((member) => {
            const canManage =
              canManageMember(member.role);

            const isUpdating =
              updateRole.isPending &&
              updateRole.variables?.userId ===
                member.userId;

            const isRemoving =
              removeMember.isPending &&
              removeMember.variables?.userId ===
                member.userId;

            return (
              <div
                key={member.userId}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar>
                    {member.image && (
                      <AvatarImage
                        src={member.image}
                        alt={member.name}
                      />
                    )}

                    <AvatarFallback>
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {member.name}
                    </p>

                    <p className="truncate text-sm text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                </div>

                {canManage ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      disabled={
                        isUpdating ||
                        isRemoving
                      }
                      onChange={(event) =>
                        handleRoleChange(
                          member.userId,
                          event.target
                            .value as EditableWorkspaceRole
                        )
                      }
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                    >
                      {currentUserRole ===
                        "OWNER" && (
                        <option value="ADMIN">
                          Admin
                        </option>
                      )}

                      <option value="EDITOR">
                        Editor
                      </option>

                      <option value="VIEWER">
                        Viewer
                      </option>
                    </select>

                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={
                        isUpdating ||
                        removeMember.isPending
                      }
                      onClick={() => {
                        removeMember.reset();

                        setRemovalCandidate({
                          userId:
                            member.userId,
                          name: member.name,
                        });
                      }}
                    >
                      <Trash2 className="size-4" />

                      <span className="sr-only">
                        Remove {member.name}
                      </span>
                    </Button>
                  </div>
                ) : (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-medium">
                    {member.role}
                  </span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <AlertDialog
        open={removalCandidate !== null}
        onOpenChange={(open) => {
          if (
            !open &&
            !removeMember.isPending
          ) {
            setRemovalCandidate(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove workspace member?
            </AlertDialogTitle>

            <AlertDialogDescription>
              This will remove{" "}
              <span className="font-semibold text-foreground">
                {removalCandidate?.name}
              </span>{" "}
              from this workspace.
            </AlertDialogDescription>

            <p className="text-sm font-medium text-destructive">
              The member will lose access to this
              workspace and its resources.
            </p>
          </AlertDialogHeader>

          {removeMember.error && (
            <p className="text-sm font-medium text-destructive">
              {removeMember.error.message}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={removeMember.isPending}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={removeMember.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                handleRemove();
              }}
            >
              {removeMember.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}

              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}