"use client";

import {
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  useRouter,
} from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Loader2,
  Sparkles,
  Workflow,
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
import type {
  GeneratedWorkflowDraft,
} from "@/features/workflow/generate-workflow-draft";
import { useTRPC } from "@/trpc/react";

const INTENT_STORAGE_KEY =
  "synapse:workflow-intent";

function subscribeToStoredIntent() {
  return () => undefined;
}

function readStoredIntent(): string {
  if (
    typeof window === "undefined"
  ) {
    return "";
  }

  return (
    window.sessionStorage.getItem(
      INTENT_STORAGE_KEY
    ) ?? ""
  );
}

function readServerIntent(): string {
  return "";
}

function actionTypeFromNode(
  node: GeneratedWorkflowDraft["definition"]["nodes"][number]
): string {
  const actionType =
    node.data.configuration
      ?.actionType;

  if (
    typeof actionType ===
    "string"
  ) {
    return actionType
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(
        /\b\w/gu,
        (character) =>
          character.toUpperCase()
      );
  }

  return node.type === "trigger"
    ? "Manual trigger"
    : "Action";
}

export function AssistantWorkflowCreator() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient =
    useQueryClient();

  const storedIntent =
    useSyncExternalStore(
      subscribeToStoredIntent,
      readStoredIntent,
      readServerIntent
    );

  const [
    editedPrompt,
    setEditedPrompt,
  ] = useState<string | null>(
    null
  );

  const [
    workspaceId,
    setWorkspaceId,
  ] = useState("");

  const [
    draft,
    setDraft,
  ] =
    useState<GeneratedWorkflowDraft | null>(
      null
    );

  const prompt =
    editedPrompt ?? storedIntent;

  const workspaces = useQuery(
    trpc.workspace.list.queryOptions()
  );

  const availableWorkspaces =
    workspaces.data?.filter(
      (workspace) =>
        workspace.role !== "VIEWER"
    ) ?? [];

  const selectedWorkspaceId =
    workspaceId ||
    availableWorkspaces[0]?.id ||
    "";

  const generateDraft =
    useMutation(
      trpc.workflow.generateAssistantDraft.mutationOptions(
        {
          onSuccess: (
            generatedDraft
          ) => {
            setDraft(
              generatedDraft
            );

            toast.success(
              "Workflow preview generated."
            );
          },

          onError: (error) => {
            toast.error(
              error.message
            );
          },
        }
      )
    );

  const createDraft =
    useMutation(
      trpc.workflow.createAssistantDraft.mutationOptions(
        {
          onSuccess: async (
            workflow
          ) => {
            window.sessionStorage.removeItem(
              INTENT_STORAGE_KEY
            );

            await Promise.all([
              queryClient.invalidateQueries(
                trpc.workflow.list.queryFilter(
                  {
                    workspaceId:
                      workflow.workspaceId,
                    includeArchived:
                      false,
                  }
                )
              ),

              queryClient.invalidateQueries(
                trpc.workspace.list.queryFilter()
              ),
            ]);

            toast.success(
              "Workflow draft created."
            );

            router.push(
              `/workspaces/${workflow.workspaceId}/workflows/${workflow.id}`
            );
          },

          onError: (error) => {
            toast.error(
              error.message
            );
          },
        }
      )
    );

  function handleGenerate(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const normalizedPrompt =
      prompt.trim();

    if (!selectedWorkspaceId) {
      toast.error(
        "Select a workspace first."
      );

      return;
    }

    if (
      normalizedPrompt.length < 10
    ) {
      toast.error(
        "Describe the automation in at least 10 characters."
      );

      return;
    }

    setDraft(null);

    generateDraft.mutate({
      workspaceId:
        selectedWorkspaceId,
      prompt: normalizedPrompt,
    });
  }

  function handleCreateDraft() {
    if (
      !draft ||
      !selectedWorkspaceId ||
      createDraft.isPending
    ) {
      return;
    }

    const name =
      draft.name.trim();

    if (name.length < 2) {
      toast.error(
        "Workflow name must contain at least 2 characters."
      );

      return;
    }

    createDraft.mutate({
      workspaceId:
        selectedWorkspaceId,
      name,
      description:
        draft.description.trim() ||
        undefined,
      definition:
        draft.definition,
    });
  }

  const isPending =
    generateDraft.isPending ||
    createDraft.isPending;

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
            <Sparkles className="size-5" />
          </span>

          <div>
            <CardTitle>
              Build with Synapse AI
            </CardTitle>

            <CardDescription className="mt-1">
              Describe the automation,
              review the generated steps,
              and create an editable
              draft.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-5 sm:p-6">
        {workspaces.isPending ? (
          <div className="flex min-h-32 items-center justify-center rounded-lg border">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : workspaces.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="font-medium text-destructive">
              Unable to load
              workspaces
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {
                workspaces.error
                  .message
              }
            </p>
          </div>
        ) : availableWorkspaces.length ===
          0 ? (
          <div className="rounded-lg border border-dashed p-5">
            <p className="font-medium">
              A workspace is required
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Create a workspace below
              before generating a
              workflow.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleGenerate}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label
                htmlFor="assistant-workspace"
                className="text-sm font-medium"
              >
                Workspace
              </label>

              <select
                id="assistant-workspace"
                value={
                  selectedWorkspaceId
                }
                disabled={isPending}
                onChange={(event) => {
                  setWorkspaceId(
                    event.target.value
                  );

                  setDraft(null);
                }}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {availableWorkspaces.map(
                  (workspace) => (
                    <option
                      key={
                        workspace.id
                      }
                      value={
                        workspace.id
                      }
                    >
                      {workspace.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="assistant-prompt"
                className="text-sm font-medium"
              >
                What should this
                workflow do?
              </label>

              <textarea
                id="assistant-prompt"
                value={prompt}
                rows={5}
                minLength={10}
                maxLength={2_000}
                disabled={isPending}
                placeholder="For example: Summarize the provided workflow input with AI and send the result to Slack."
                onChange={(event) => {
                  setEditedPrompt(
                    event.target.value
                  );

                  setDraft(null);
                }}
                className="w-full resize-y rounded-md border bg-background px-3 py-3 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              />

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  You can edit every
                  generated step later.
                </span>

                <span>
                  {prompt.length}/2000
                </span>
              </div>
            </div>

            {generateDraft.error && (
              <p className="text-sm font-medium text-destructive">
                {
                  generateDraft.error
                    .message
                }
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={
                  isPending ||
                  prompt.trim()
                    .length < 10
                }
              >
                {generateDraft.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}

                {draft
                  ? "Regenerate preview"
                  : "Generate workflow"}
              </Button>

              <Button
                variant="ghost"
                nativeButton={false}
                disabled={isPending}
                render={
                  <Link href="/dashboard" />
                }
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {draft && (
          <div className="space-y-5 border-t pt-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="size-4" />
                Preview ready
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Review the generated
                workflow before creating
                the draft.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="generated-workflow-name"
                  className="text-sm font-medium"
                >
                  Workflow name
                </label>

                <Input
                  id="generated-workflow-name"
                  value={draft.name}
                  maxLength={100}
                  disabled={
                    createDraft.isPending
                  }
                  onChange={(event) =>
                    setDraft(
                      (current) =>
                        current
                          ? {
                              ...current,
                              name:
                                event
                                  .target
                                  .value,
                            }
                          : current
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="generated-workflow-description"
                  className="text-sm font-medium"
                >
                  Description
                </label>

                <Input
                  id="generated-workflow-description"
                  value={
                    draft.description
                  }
                  maxLength={500}
                  disabled={
                    createDraft.isPending
                  }
                  onChange={(event) =>
                    setDraft(
                      (current) =>
                        current
                          ? {
                              ...current,
                              description:
                                event
                                  .target
                                  .value,
                            }
                          : current
                    )
                  }
                />
              </div>
            </div>

            <div className="rounded-xl border">
              <div className="border-b px-4 py-3">
                <p className="font-medium">
                  Generated steps
                </p>

                <p className="text-xs text-muted-foreground">
                  Steps run from top to
                  bottom.
                </p>
              </div>

              <div className="divide-y">
                {draft.definition.nodes.map(
                  (node, index) => (
                    <div
                      key={node.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-xs font-semibold">
                        {index + 1}
                      </span>

                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        {node.type ===
                        "trigger" ? (
                          <Workflow className="size-4" />
                        ) : (
                          <Bot className="size-4" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {
                            node.data
                              .label
                          }
                        </p>

                        <p className="truncate text-xs text-muted-foreground">
                          {actionTypeFromNode(
                            node
                          )}
                        </p>
                      </div>

                      {index <
                        draft.definition
                          .nodes.length -
                          1 && (
                        <ArrowRight className="hidden size-4 text-muted-foreground sm:block" />
                      )}
                    </div>
                  )
                )}
              </div>
            </div>

            {draft
              .requiresConfiguration
              .length > 0 && (
              <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />

                <div>
                  <p className="text-sm font-medium">
                    Configuration
                    required
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Configure these
                    steps in the editor
                    before publishing:
                  </p>

                  <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                    {draft.requiresConfiguration.map(
                      (step) => (
                        <li key={step}>
                          {step}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            )}

            {createDraft.error && (
              <p className="text-sm font-medium text-destructive">
                {
                  createDraft.error
                    .message
                }
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={
                  createDraft.isPending ||
                  draft.name.trim()
                    .length < 2
                }
                onClick={
                  handleCreateDraft
                }
              >
                {createDraft.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Workflow className="size-4" />
                )}

                Create editable draft
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  setDraft(null)
                }
              >
                Change request
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}