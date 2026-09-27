"use client";

import {
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import {
  Bot,
  FileText,
  GitBranch,
  LayoutGrid,
  Loader2,
  Mail,
  MessageSquare,
  Play,
  Sparkles,
  TicketCheck,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  createWorkflowTemplateDefinition,
  workflowTemplates,
  type WorkflowTemplateId,
} from "@/features/workflow/workflow-templates";
import {
  hasWorkspacePermission,
} from "@/features/workspace/permissions";
import { useTRPC } from "@/trpc/react";

type PlatformPresentation = {
  name: string;
  icon: LucideIcon;
  className: string;
};

type TemplatePresentation = {
  id: string;
  eyebrow: string;
  platforms: readonly PlatformPresentation[];
};

const templatePresentation: Record<
  WorkflowTemplateId,
  TemplatePresentation
> = {
  FORM_AI_SLACK: {
    id: "form-response-triage",
    eyebrow:
      "Lead and response automation",
    platforms: [
      {
        name: "Google Forms",
        icon: FileText,
        className:
          "bg-violet-500 text-white",
      },
      {
        name: "AI",
        icon: Sparkles,
        className:
          "bg-emerald-500 text-white",
      },
      {
        name: "Slack",
        icon: MessageSquare,
        className:
          "bg-fuchsia-500 text-white",
      },
    ],
  },

  GMAIL_AI_TRELLO: {
    id: "email-to-task",
    eyebrow: "Inbox automation",
    platforms: [
      {
        name: "Gmail",
        icon: Mail,
        className:
          "bg-red-500 text-white",
      },
      {
        name: "AI",
        icon: Sparkles,
        className:
          "bg-emerald-500 text-white",
      },
      {
        name: "Trello",
        icon: LayoutGrid,
        className:
          "bg-blue-500 text-white",
      },
    ],
  },

  GITHUB_TO_JIRA: {
    id: "issue-escalation",
    eyebrow:
      "Development automation",
    platforms: [
      {
        name: "GitHub",
        icon: GitBranch,
        className:
          "bg-zinc-900 text-white",
      },
      {
        name: "Jira",
        icon: TicketCheck,
        className:
          "bg-blue-600 text-white",
      },
    ],
  },

  MANUAL_AI_EMAIL: {
    id: "ai-email-assistant",
    eyebrow: "AI communication",
    platforms: [
      {
        name: "Manual",
        icon: Play,
        className:
          "bg-amber-500 text-white",
      },
      {
        name: "AI",
        icon: Bot,
        className:
          "bg-emerald-500 text-white",
      },
      {
        name: "Gmail",
        icon: Mail,
        className:
          "bg-red-500 text-white",
      },
    ],
  },
};

function PlatformLogos({
  platforms,
}: {
  platforms: readonly PlatformPresentation[];
}) {
  return (
    <div className="flex items-center">
      {platforms.map(
        (platform, index) => {
          const Icon = platform.icon;

          return (
            <div
              key={platform.name}
              title={platform.name}
              className={`relative flex size-11 items-center justify-center rounded-xl border-2 border-background shadow-sm ${platform.className} ${
                index > 0
                  ? "-ml-2"
                  : ""
              }`}
              style={{
                zIndex:
                  platforms.length -
                  index,
              }}
            >
              <Icon className="size-5" />
            </div>
          );
        }
      )}
    </div>
  );
}

export function TemplateGallery() {
  const trpc = useTRPC();
  const router = useRouter();

  const [
    selectedWorkspaceId,
    setSelectedWorkspaceId,
  ] = useState("");

  const [
    localError,
    setLocalError,
  ] = useState<string | null>(null);

  const workspaces = useQuery(
    trpc.workspace.list.queryOptions()
  );

  const createWorkflow = useMutation(
    trpc.workflow.create.mutationOptions()
  );

  const saveDefinition = useMutation(
    trpc.workflow.saveDefinition.mutationOptions()
  );

  const availableWorkspaces =
    useMemo(
      () =>
        workspaces.data?.filter(
          (workspace) =>
            hasWorkspacePermission(
              workspace.role,
              "workflow:create"
            )
        ) ?? [],
      [workspaces.data]
    );

  const activeWorkspaceId =
    availableWorkspaces.some(
      (workspace) =>
        workspace.id ===
        selectedWorkspaceId
    )
      ? selectedWorkspaceId
      : (availableWorkspaces[0]?.id ??
        "");

  const isPending =
    createWorkflow.isPending ||
    saveDefinition.isPending;

  async function createFromTemplate(
    templateId: WorkflowTemplateId
  ) {
    if (
      !activeWorkspaceId ||
      isPending
    ) {
      return;
    }

    const template =
      workflowTemplates.find(
        (candidate) =>
          candidate.id ===
          templateId
      );

    if (!template) {
      setLocalError(
        "The selected workflow template could not be found."
      );

      return;
    }

    setLocalError(null);

    try {
      const createdWorkflow =
        await createWorkflow.mutateAsync(
          {
            workspaceId:
              activeWorkspaceId,
            name: template.name,
            description:
              template.description,
          }
        );

      const definition =
        createWorkflowTemplateDefinition(
          templateId
        );

      await saveDefinition.mutateAsync({
        id: createdWorkflow.id,

        nodes: definition.nodes.map(
          (node) => ({
            id: node.id,
            type: node.type,
            position: {
              x: node.position.x,
              y: node.position.y,
            },
            data: {
              label:
                node.data.label,
              description:
                node.data.description,
              configuration:
                node.data.configuration,
            },
          })
        ),

        edges: definition.edges.map(
          (edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle:
              edge.sourceHandle ??
              null,
            targetHandle:
              edge.targetHandle ??
              null,
            animated:
              edge.animated ??
              false,
          })
        ),
      });

      toast.success(
        "Workflow created from template."
      );

      router.push(
        `/workspaces/${activeWorkspaceId}/workflows/${createdWorkflow.id}`
      );
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "Unable to create the workflow from this template."
      );
    }
  }

  if (workspaces.isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (workspaces.isError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <p className="font-medium text-destructive">
          Unable to load your
          workspaces
        </p>

        <p className="mt-1 text-sm text-destructive">
          {workspaces.error.message}
        </p>
      </div>
    );
  }

  if (
    availableWorkspaces.length === 0
  ) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted">
          <LayoutGrid className="size-5" />
        </div>

        <h2 className="mt-4 text-lg font-semibold">
          Create a workspace first
        </h2>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          You need a workspace with
          workflow creation permission
          before you can use a template.
        </p>

        <Button
          className="mt-5"
          render={
            <Link href="/workspaces" />
          }
        >
          Go to workspaces
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
        <div>
          <p className="font-medium">
            Create inside workspace
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            The template will create an
            editable workflow draft.
          </p>
        </div>

        <div className="w-full sm:w-72">
          <label
            htmlFor="template-workspace"
            className="sr-only"
          >
            Workspace
          </label>

          <select
            id="template-workspace"
            value={activeWorkspaceId}
            disabled={isPending}
            onChange={(event) => {
              setSelectedWorkspaceId(
                event.target.value
              );
              setLocalError(null);
            }}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {availableWorkspaces.map(
              (workspace) => (
                <option
                  key={workspace.id}
                  value={workspace.id}
                >
                  {workspace.name}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {localError && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
          {localError}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {workflowTemplates.map(
          (template) => {
            const presentation =
              templatePresentation[
                template.id
              ];

            return (
              <article
                key={template.id}
                id={presentation.id}
                className="scroll-mt-24 rounded-2xl border bg-card p-6 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <PlatformLogos
                    platforms={
                      presentation.platforms
                    }
                  />

                  <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {template.steps.length}{" "}
                    steps
                  </span>
                </div>

                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                  {
                    presentation.eyebrow
                  }
                </p>

                <h2 className="mt-2 text-xl font-semibold">
                  {template.name}
                </h2>

                <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">
                  {
                    template.description
                  }
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {template.steps.map(
                    (step, index) => (
                      <div
                        key={`${template.id}-${step}`}
                        className="flex items-center gap-2"
                      >
                        {index > 0 && (
                          <span className="text-xs text-muted-foreground">
                            →
                          </span>
                        )}

                        <span className="rounded-lg border bg-muted/40 px-2.5 py-1.5 text-xs font-medium">
                          {step}
                        </span>
                      </div>
                    )
                  )}
                </div>

                <Button
                  type="button"
                  className="mt-6 w-full"
                  disabled={
                    isPending ||
                    !activeWorkspaceId
                  }
                  onClick={() =>
                    createFromTemplate(
                      template.id
                    )
                  }
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}

                  Use this template
                </Button>
              </article>
            );
          }
        )}
      </div>
    </div>
  );
}