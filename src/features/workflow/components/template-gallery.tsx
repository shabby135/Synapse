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
  ArrowRight,
  Bot,
  FileText,
  GitBranch,
  LayoutGrid,
  Loader2,
  Mail,
  MessageSquare,
  Play,
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
import { hasWorkspacePermission } from "@/features/workspace/permissions";
import { useTRPC } from "@/trpc/react";

type PlatformPresentation = {
  name: string;
  icon: LucideIcon;
  className: string;
};

type TemplatePresentation = {
  id: string;
  category: string;
  platforms: readonly PlatformPresentation[];
};

const templatePresentation: Record<
  WorkflowTemplateId,
  TemplatePresentation
> = {
  FORM_AI_SLACK: {
    id: "form-response-triage",
    category: "Lead management",
    platforms: [
      {
        name: "Google Forms",
        icon: FileText,
        className:
          "bg-violet-500/10 text-violet-700 dark:text-violet-300",
      },
      {
        name: "AI",
        icon: Bot,
        className:
          "bg-primary/10 text-primary",
      },
      {
        name: "Slack",
        icon: MessageSquare,
        className:
          "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
      },
    ],
  },

  GMAIL_AI_TRELLO: {
    id: "email-to-task",
    category: "Productivity",
    platforms: [
      {
        name: "Gmail",
        icon: Mail,
        className:
          "bg-red-500/10 text-red-700 dark:text-red-300",
      },
      {
        name: "AI",
        icon: Bot,
        className:
          "bg-primary/10 text-primary",
      },
      {
        name: "Trello",
        icon: LayoutGrid,
        className:
          "bg-blue-500/10 text-blue-700 dark:text-blue-300",
      },
    ],
  },

  GITHUB_TO_JIRA: {
    id: "issue-escalation",
    category: "Development",
    platforms: [
      {
        name: "GitHub",
        icon: GitBranch,
        className:
          "bg-foreground/10 text-foreground",
      },
      {
        name: "Jira",
        icon: TicketCheck,
        className:
          "bg-blue-500/10 text-blue-700 dark:text-blue-300",
      },
    ],
  },

  MANUAL_AI_EMAIL: {
    id: "ai-email-assistant",
    category: "Communication",
    platforms: [
      {
        name: "Manual trigger",
        icon: Play,
        className:
          "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      },
      {
        name: "AI",
        icon: Bot,
        className:
          "bg-primary/10 text-primary",
      },
      {
        name: "Gmail",
        icon: Mail,
        className:
          "bg-red-500/10 text-red-700 dark:text-red-300",
      },
    ],
  },
};

function PlatformIcons({
  platforms,
}: {
  platforms: readonly PlatformPresentation[];
}) {
  return (
    <div className="flex items-center gap-2">
      {platforms.map((platform) => {
        const Icon = platform.icon;

        return (
          <div
            key={platform.name}
            title={platform.name}
            aria-label={platform.name}
            className={`flex size-9 items-center justify-center rounded-lg ${platform.className}`}
          >
            <Icon className="size-4" />
          </div>
        );
      })}
    </div>
  );
}

function TemplateSteps({
  templateId,
  steps,
}: {
  templateId: WorkflowTemplateId;
  steps: readonly string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, index) => (
        <div
          key={`${templateId}-${step}`}
          className="flex items-center gap-1.5"
        >
          {index > 0 && (
            <ArrowRight className="size-3 text-muted-foreground/70" />
          )}

          <span className="rounded-md border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
            {step}
          </span>
        </div>
      ))}
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

  const availableWorkspaces = useMemo(
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
          candidate.id === templateId
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
        await createWorkflow.mutateAsync({
          workspaceId:
            activeWorkspaceId,
          name: template.name,
          description:
            template.description,
        });

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
              edge.animated ?? false,
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
      <div className="flex min-h-56 items-center justify-center rounded-lg border bg-card">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (workspaces.isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
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
      <div className="rounded-lg border border-dashed bg-card p-8 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-lg border bg-muted/50">
          <LayoutGrid className="size-4" />
        </div>

        <h2 className="mt-4 font-semibold">
          Create a workspace first
        </h2>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          You need a workspace with
          workflow creation permission
          before using a template.
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
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">
            Destination workspace
          </h2>

          <p className="mt-1 text-xs text-muted-foreground">
            A new editable workflow
            draft will be created here.
          </p>
        </div>

        <div className="w-full sm:w-64">
          <label
            htmlFor="template-workspace"
            className="sr-only"
          >
            Destination workspace
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
            className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
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
      </section>

      {localError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
          {localError}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
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
                className="scroll-mt-24 rounded-lg border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <PlatformIcons
                    platforms={
                      presentation.platforms
                    }
                  />

                  <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {template.steps.length}{" "}
                    steps
                  </span>
                </div>

                <div className="mt-5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {
                      presentation.category
                    }
                  </p>

                  <h2 className="mt-1 text-base font-semibold">
                    {template.name}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {
                      template.description
                    }
                  </p>
                </div>

                <div className="mt-4">
                  <TemplateSteps
                    templateId={
                      template.id
                    }
                    steps={
                      template.steps
                    }
                  />
                </div>

                <div className="mt-5 border-t pt-4">
                  <Button
                    type="button"
                    size="sm"
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

                    Use template
                  </Button>
                </div>
              </article>
            );
          }
        )}
      </div>
    </div>
  );
}