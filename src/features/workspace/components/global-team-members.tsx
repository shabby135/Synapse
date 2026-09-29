"use client";

import {
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Loader2,
  Search,
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
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

type WorkspaceRole =
  | "OWNER"
  | "ADMIN"
  | "EDITOR"
  | "VIEWER";

type RoleFilter =
  | "ALL"
  | WorkspaceRole;

type RemoveTarget = {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  name: string;
};

const roleFilters: ReadonlyArray<{
  value: RoleFilter;
  label: string;
}> = [
  { value: "ALL", label: "All roles" },
  { value: "OWNER", label: "Owners" },
  { value: "ADMIN", label: "Admins" },
  { value: "EDITOR", label: "Editors" },
  { value: "VIEWER", label: "Viewers" },
];

const roleClasses: Record<
  WorkspaceRole,
  string
> = {
  OWNER:
    "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  ADMIN:
    "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  EDITOR:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  VIEWER:
    "border-border bg-muted text-muted-foreground",
};

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/u)
    .filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase();
}

function canManageMember(
  currentRole: WorkspaceRole,
  targetRole: WorkspaceRole
): boolean {
  if (targetRole === "OWNER") {
    return false;
  }

  if (currentRole === "OWNER") {
    return true;
  }

  return (
    currentRole === "ADMIN" &&
    (targetRole === "EDITOR" ||
      targetRole === "VIEWER")
  );
}

function availableRoles(
  currentRole: WorkspaceRole
): readonly Exclude<
  WorkspaceRole,
  "OWNER"
>[] {
  return currentRole === "OWNER"
    ? ["ADMIN", "EDITOR", "VIEWER"]
    : ["EDITOR", "VIEWER"];
}

function formatDate(
  value: Date | string
): string {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(new Date(value));
}

export function GlobalTeamMembers() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [workspaceFilter, setWorkspaceFilter] =
    useState("ALL");
  const [roleFilter, setRoleFilter] =
    useState<RoleFilter>("ALL");
  const [removeTarget, setRemoveTarget] =
    useState<RemoveTarget | null>(null);

  const members = useQuery(
    trpc.workspace.listAllMembers.queryOptions()
  );

  const updateRole = useMutation(
    trpc.workspace.updateMemberRole.mutationOptions({
      onSuccess: async (_result, variables) => {
        await Promise.all([
          queryClient.invalidateQueries(
            trpc.workspace.listAllMembers.queryFilter()
          ),
          queryClient.invalidateQueries(
            trpc.workspace.listMembers.queryFilter({
              id: variables.workspaceId,
            })
          ),
        ]);

        toast.success("Member role updated.");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const removeMember = useMutation(
    trpc.workspace.removeMember.mutationOptions({
      onSuccess: async (_result, variables) => {
        setRemoveTarget(null);

        await Promise.all([
          queryClient.invalidateQueries(
            trpc.workspace.listAllMembers.queryFilter()
          ),
          queryClient.invalidateQueries(
            trpc.workspace.listMembers.queryFilter({
              id: variables.workspaceId,
            })
          ),
        ]);

        toast.success("Member removed.");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const memberRows = useMemo(
    () => members.data ?? [],
    [members.data]
  );

  const workspaces = useMemo(() => {
    const values = new Map<
      string,
      string
    >();

    for (const member of memberRows) {
      values.set(
        member.workspaceId,
        member.workspaceName
      );
    }

    return Array.from(values.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, [memberRows]);

  const uniqueMemberCount = useMemo(
    () =>
      new Set(
        memberRows.map((member) => member.userId)
      ).size,
    [memberRows]
  );

  const visibleMembers = useMemo(() => {
    const normalizedQuery = query
      .trim()
      .toLowerCase();

    return memberRows.filter((member) => {
      const matchesWorkspace =
        workspaceFilter === "ALL" ||
        member.workspaceId === workspaceFilter;

      const matchesRole =
        roleFilter === "ALL" ||
        member.role === roleFilter;

      const matchesQuery =
        !normalizedQuery ||
        member.name
          .toLowerCase()
          .includes(normalizedQuery) ||
        member.email
          .toLowerCase()
          .includes(normalizedQuery) ||
        member.workspaceName
          .toLowerCase()
          .includes(normalizedQuery);

      return (
        matchesWorkspace &&
        matchesRole &&
        matchesQuery
      );
    });
  }, [
    memberRows,
    query,
    roleFilter,
    workspaceFilter,
  ]);

  if (members.isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border bg-card">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (members.isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <p className="font-medium text-destructive">
          Unable to load team members
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {members.error.message}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Workspaces
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {workspaces.length}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Unique people
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {uniqueMemberCount}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Memberships
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {memberRows.length}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search by name, email, or workspace..."
            aria-label="Search team members"
            className="pl-9"
          />
        </div>

        <select
          value={workspaceFilter}
          onChange={(event) => {
            setWorkspaceFilter(event.target.value);
          }}
          aria-label="Filter by workspace"
          className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 lg:w-56"
        >
          <option value="ALL">
            All workspaces
          </option>
          {workspaces.map((workspace) => (
            <option
              key={workspace.id}
              value={workspace.id}
            >
              {workspace.name}
            </option>
          ))}
        </select>

        <select
          value={roleFilter}
          onChange={(event) => {
            setRoleFilter(
              event.target.value as RoleFilter
            );
          }}
          aria-label="Filter by role"
          className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 lg:w-44"
        >
          {roleFilters.map((role) => (
            <option
              key={role.value}
              value={role.value}
            >
              {role.label}
            </option>
          ))}
        </select>
      </div>

      {memberRows.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">
            No team memberships found
          </p>
        </div>
      ) : visibleMembers.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <p className="font-medium">
            No matching members
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Change the search, workspace, or role filter.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_9rem_8rem_3rem] gap-4 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <span>Member</span>
            <span>Workspace</span>
            <span>Role</span>
            <span>Joined</span>
            <span className="sr-only">Remove</span>
          </div>

          <div className="divide-y">
            {visibleMembers.map((member) => {
              const manageable =
                canManageMember(
                  member.workspaceRole,
                  member.role
                );
              const rolePending =
                updateRole.isPending &&
                updateRole.variables?.workspaceId ===
                  member.workspaceId &&
                updateRole.variables?.userId ===
                  member.userId;
              const removePending =
                removeMember.isPending &&
                removeMember.variables?.workspaceId ===
                  member.workspaceId &&
                removeMember.variables?.userId ===
                  member.userId;

              return (
                <div
                  key={`${member.workspaceId}:${member.userId}`}
                  className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_9rem_8rem_3rem] md:items-center md:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-9">
                      {member.image && (
                        <AvatarImage
                          src={member.image}
                          alt=""
                        />
                      )}
                      <AvatarFallback className="text-xs">
                        {initials(member.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {member.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <Link
                      href={`/workspaces/${member.workspaceId}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {member.workspaceName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Your role: {member.workspaceRole.toLowerCase()}
                    </p>
                  </div>

                  <div>
                    {manageable ? (
                      <select
                        value={member.role}
                        disabled={rolePending}
                        aria-label={`Role for ${member.name} in ${member.workspaceName}`}
                        onChange={(event) => {
                          updateRole.mutate({
                            workspaceId:
                              member.workspaceId,
                            userId: member.userId,
                            role:
                              event.target.value as Exclude<
                                WorkspaceRole,
                                "OWNER"
                              >,
                          });
                        }}
                        className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                      >
                        {availableRoles(
                          member.workspaceRole
                        ).map((role) => (
                          <option
                            key={role}
                            value={role}
                          >
                            {role}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${
                          roleClasses[member.role]
                        }`}
                      >
                        {member.role}
                      </span>
                    )}
                  </div>

                  <time
                    dateTime={new Date(
                      member.joinedAt
                    ).toISOString()}
                    className="text-sm text-muted-foreground"
                  >
                    {formatDate(member.joinedAt)}
                  </time>

                  <button
                    type="button"
                    aria-label={`Remove ${member.name} from ${member.workspaceName}`}
                    title={
                      manageable
                        ? "Remove member"
                        : "You cannot remove this member"
                    }
                    disabled={
                      !manageable || removePending
                    }
                    onClick={() => {
                      removeMember.reset();
                      setRemoveTarget({
                        workspaceId:
                          member.workspaceId,
                        workspaceName:
                          member.workspaceName,
                        userId: member.userId,
                        name: member.name,
                      });
                    }}
                    className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {removePending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !removeMember.isPending) {
            setRemoveTarget(null);
            removeMember.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove team member?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Remove{" "}
              <span className="font-semibold text-foreground">
                {removeTarget?.name}
              </span>{" "}
              from{" "}
              <span className="font-semibold text-foreground">
                {removeTarget?.workspaceName}
              </span>
              ? They will lose access to that workspace and its workflows.
            </AlertDialogDescription>
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

                if (removeTarget) {
                  removeMember.mutate({
                    workspaceId:
                      removeTarget.workspaceId,
                    userId: removeTarget.userId,
                  });
                }
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
    </section>
  );
}
