"use client";

import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ChevronDown,
  Settings2,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
  WorkflowNodeData,
} from "@/features/workflow/types";
import {
  createActionConfiguration,
  workflowActionCatalog,
  type WorkflowActionType,
} from "@/features/workflow/workflow-node-catalog";

import {
  AiActionConfiguration,
} from "./ai-action-configuration";
import {
  DataMappingPanel,
} from "./data-mapping-panel";
import {
  GmailActionConfiguration,
} from "./gmail-action-configuration";
import {
  GmailTriggerConfiguration,
} from "./gmail-trigger-configuration";
import {
  GitHubActionConfiguration,
} from "./github-action-configuration";
import {
  GitHubTriggerConfiguration,
} from "./github-trigger-configuration";
import {
  GoogleCalendarActionConfiguration,
} from "./google-calendar-action-configuration";
import {
  GoogleCalendarTriggerConfiguration,
} from "./google-calendar-trigger-configuration";
import {
  GoogleFormsTriggerConfiguration,
} from "./google-forms-trigger-configuration";
import {
  GoogleSheetsActionConfiguration,
} from "./google-sheets-action-configuration";
import {
  GoogleSheetsTriggerConfiguration,
} from "./google-sheets-trigger-configuration";
import {
  HttpActionConfiguration,
} from "./http-action-configuration";
import {
  JiraActionConfiguration,
} from "./jira-action-configuration";
import {
  JiraTriggerConfiguration,
} from "./jira-trigger-configuration";
import {
  MessagingActionConfiguration,
} from "./messaging-action-configuration";
import {
  TrelloActionConfiguration,
} from "./trello-action-configuration";
import {
  TrelloTriggerConfiguration,
} from "./trello-trigger-configuration";

type NodeConfigurationPanelProps = {
  workspaceId: string;
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
  node: WorkflowCanvasNode | null;
  canEdit: boolean;
  height: number;
  onHeightChange: (
    height: number
  ) => void;
  onUpdate: (
    nodeId: string,
    data: WorkflowNodeData
  ) => void;
  onDelete: (
    nodeId: string
  ) => void;
};

type ConfigurationSectionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

const DEFAULT_PANEL_HEIGHT = 320;
const MIN_PANEL_HEIGHT = 220;
const MAX_PANEL_HEIGHT = 680;

const triggerTypes = [
  {
    value: "MANUAL",
    label: "Manual trigger",
  },
  {
    value:
      "GOOGLE_SHEETS_NEW_ROW",
    label:
      "Google Sheets — New Row",
  },
  {
    value:
      "GOOGLE_CALENDAR_NEW_EVENT",
    label:
      "Google Calendar — New Event",
  },
  {
    value:
      "GOOGLE_FORMS_NEW_RESPONSE",
    label:
      "Google Forms — New Response",
  },
  {
    value: "GMAIL_NEW_EMAIL",
    label: "Gmail — New Email",
  },
  {
    value: "GITHUB_NEW_ISSUE",
    label: "GitHub — New Issue",
  },
  {
    value: "JIRA_NEW_ISSUE",
    label: "Jira — New Issue",
  },
  {
    value: "TRELLO_NEW_CARD",
    label: "Trello — New Card",
  },
] as const;

function clampPanelHeight(
  height: number
): number {
  if (
    typeof window === "undefined"
  ) {
    return Math.min(
      MAX_PANEL_HEIGHT,
      Math.max(
        MIN_PANEL_HEIGHT,
        height
      )
    );
  }

  const viewportMaximum =
    Math.floor(
      window.innerHeight * 0.7
    );

  const maximumHeight =
    Math.max(
      MIN_PANEL_HEIGHT,
      Math.min(
        MAX_PANEL_HEIGHT,
        viewportMaximum
      )
    );

  return Math.min(
    maximumHeight,
    Math.max(
      MIN_PANEL_HEIGHT,
      height
    )
  );
}

function ConfigurationSection({
  title,
  description,
  defaultOpen = false,
  children,
}: ConfigurationSectionProps) {
  const [open, setOpen] =
    useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() =>
          setOpen(
            (current) => !current
          )
        }
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-muted/50"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">
            {title}
          </span>

          {description && (
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
              {description}
            </span>
          )}
        </span>

        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            open
              ? "rotate-180"
              : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t p-4">
          {children}
        </div>
      )}
    </section>
  );
}

function createTriggerData(
  triggerType: string
): WorkflowNodeData {
  switch (triggerType) {
    case "GOOGLE_SHEETS_NEW_ROW":
      return {
        label:
          "Google Sheets New Row",
        description:
          "Starts when a new row is detected in Google Sheets.",
        configuration: {
          triggerType:
            "GOOGLE_SHEETS_NEW_ROW",
          integrationId: "",
          spreadsheetId: "",
          range: "Sheet1!A:Z",
          hasHeader: true,
          startMode: "FROM_NOW",
          pollIntervalMinutes: 1,
        },
      };

    case "GOOGLE_CALENDAR_NEW_EVENT":
      return {
        label:
          "Google Calendar New Event",
        description:
          "Starts when a new event is created in Google Calendar.",
        configuration: {
          triggerType:
            "GOOGLE_CALENDAR_NEW_EVENT",
          integrationId: "",
          calendarId: "primary",
          startMode: "FROM_NOW",
          pollIntervalMinutes: 1,
        },
      };

    case "GOOGLE_FORMS_NEW_RESPONSE":
      return {
        label:
          "Google Forms New Response",
        description:
          "Starts when a new response is submitted to a Google Form.",
        configuration: {
          triggerType:
            "GOOGLE_FORMS_NEW_RESPONSE",
          integrationId: "",
          formId: "",
          startMode: "FROM_NOW",
          pollIntervalMinutes: 1,
        },
      };

    case "GMAIL_NEW_EMAIL":
      return {
        label: "Gmail New Email",
        description:
          "Starts when a new matching email is received in Gmail.",
        configuration: {
          triggerType:
            "GMAIL_NEW_EMAIL",
          integrationId: "",
          labelId: "INBOX",
          searchQuery: "",
          startMode: "FROM_NOW",
          pollIntervalMinutes: 1,
        },
      };

    case "GITHUB_NEW_ISSUE":
      return {
        label:
          "GitHub New Issue",
        description:
          "Starts when a new issue is created in a GitHub repository.",
        configuration: {
          triggerType:
            "GITHUB_NEW_ISSUE",
          integrationId: "",
          repository: "",
          labels: "",
          startMode: "FROM_NOW",
          pollIntervalMinutes: 1,
        },
      };

    case "JIRA_NEW_ISSUE":
      return {
        label: "Jira New Issue",
        description:
          "Starts when a new issue is created in a Jira project.",
        configuration: {
          triggerType:
            "JIRA_NEW_ISSUE",
          integrationId: "",
          projectKey: "",
          startMode: "FROM_NOW",
          pollIntervalMinutes: 1,
        },
      };

    case "TRELLO_NEW_CARD":
      return {
        label: "Trello New Card",
        description:
          "Starts when a new card is created on a Trello board.",
        configuration: {
          triggerType:
            "TRELLO_NEW_CARD",
          integrationId: "",
          boardId: "",
          listId: "",
          startMode: "FROM_NOW",
          pollIntervalMinutes: 1,
        },
      };

    case "MANUAL":
    default:
      return {
        label: "Manual Trigger",
        description:
          "Starts when the workflow is run manually.",
        configuration: {
          triggerType: "MANUAL",
        },
      };
  }
}

export function NodeConfigurationPanel({
  workspaceId,
  nodes,
  edges,
  node,
  canEdit,
  height,
  onHeightChange,
  onUpdate,
  onDelete,
}: NodeConfigurationPanelProps) {
  const [
    deleteDialogOpen,
    setDeleteDialogOpen,
  ] = useState(false);

  const resizeState = useRef<{
    startY: number;
    startHeight: number;
  } | null>(null);

  function handleResizeStart(
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    event.preventDefault();

    resizeState.current = {
      startY: event.clientY,
      startHeight: height,
    };

    event.currentTarget.setPointerCapture(
      event.pointerId
    );
  }

  function handleResizeMove(
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    const resize =
      resizeState.current;

    if (!resize) {
      return;
    }

    const movement =
      resize.startY -
      event.clientY;

    onHeightChange(
      clampPanelHeight(
        resize.startHeight +
          movement
      )
    );
  }

  function handleResizeEnd(
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    resizeState.current = null;

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }
  }

  if (!node) {
    return null;
  }

  const selectedNode = node;

  const configuration =
    selectedNode.data
      .configuration ?? {};

  const actionType =
    typeof configuration.actionType ===
    "string"
      ? configuration.actionType
      : "NO_OP";

  const triggerType =
    typeof configuration.triggerType ===
    "string"
      ? configuration.triggerType
      : "MANUAL";

  function updateData(
    changes: Partial<WorkflowNodeData>
  ) {
    onUpdate(selectedNode.id, {
      ...selectedNode.data,
      ...changes,
    });
  }

  function updateConfiguration(
    changes: Record<
      string,
      unknown
    >
  ) {
    updateData({
      configuration: {
        ...configuration,
        ...changes,
      },
    });
  }

  function changeActionType(
    nextActionType: string
  ) {
    const action =
      workflowActionCatalog.find(
        (candidate) =>
          candidate.actionType ===
          nextActionType
      );

    if (!action) {
      return;
    }

    updateData({
      label: action.label,
      description:
        action.description,
      configuration:
        createActionConfiguration(
          action.actionType as WorkflowActionType
        ),
    });
  }

  function changeTriggerType(
    nextTriggerType: string
  ) {
    updateData(
      createTriggerData(
        nextTriggerType
      )
    );
  }

  function confirmDelete() {
    onDelete(selectedNode.id);
    setDeleteDialogOpen(false);
  }

  return (
    <>
      <section
        style={{
          height:
            clampPanelHeight(height),
        }}
        className="relative flex shrink-0 animate-in flex-col border-t bg-background duration-200 slide-in-from-bottom-4"
      >
        <button
          type="button"
          aria-label="Resize configuration panel"
          title="Drag to resize. Double-click to reset."
          onPointerDown={
            handleResizeStart
          }
          onPointerMove={
            handleResizeMove
          }
          onPointerUp={
            handleResizeEnd
          }
          onPointerCancel={
            handleResizeEnd
          }
          onDoubleClick={() =>
            onHeightChange(
              DEFAULT_PANEL_HEIGHT
            )
          }
          className="group absolute -top-2 left-0 right-0 z-30 flex h-4 touch-none cursor-ns-resize items-center justify-center"
        >
          <span className="h-1 w-12 rounded-full bg-border transition-colors group-hover:bg-primary group-active:bg-primary" />
        </button>

        <div className="flex shrink-0 items-center justify-between gap-4 border-b bg-background px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Settings2 className="size-4" />
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-sm font-semibold">
                  {
                    selectedNode.data
                      .label
                  }
                </h3>

                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {selectedNode.type}
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                Configure this workflow
                step.
              </p>
            </div>
          </div>

          <span className="shrink-0 rounded-full border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
            {canEdit
              ? "Editable"
              : "Read only"}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
            <div className="space-y-2">
              <label
                htmlFor={
                  selectedNode.type ===
                  "trigger"
                    ? "trigger-type"
                    : "action-type"
                }
                className="text-sm font-medium"
              >
                {selectedNode.type ===
                "trigger"
                  ? "Trigger type"
                  : "Action type"}
              </label>

              {selectedNode.type ===
              "trigger" ? (
                <select
                  id="trigger-type"
                  value={triggerType}
                  disabled={!canEdit}
                  onChange={(event) =>
                    changeTriggerType(
                      event.target.value
                    )
                  }
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {triggerTypes.map(
                    (trigger) => (
                      <option
                        key={
                          trigger.value
                        }
                        value={
                          trigger.value
                        }
                      >
                        {trigger.label}
                      </option>
                    )
                  )}
                </select>
              ) : (
                <select
                  id="action-type"
                  value={actionType}
                  disabled={!canEdit}
                  onChange={(event) =>
                    changeActionType(
                      event.target.value
                    )
                  }
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {workflowActionCatalog.map(
                    (action) => (
                      <option
                        key={
                          action.actionType
                        }
                        value={
                          action.actionType
                        }
                      >
                        {action.label}
                      </option>
                    )
                  )}
                </select>
              )}
            </div>

            {selectedNode.type ===
              "trigger" && (
              <>
                {triggerType ===
                  "MANUAL" && (
                  <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                    Manual triggers do
                    not require an
                    external integration.
                  </div>
                )}

                {triggerType ===
                  "GOOGLE_SHEETS_NEW_ROW" && (
                  <GoogleSheetsTriggerConfiguration
                    workspaceId={
                      workspaceId
                    }
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}

                {triggerType ===
                  "GOOGLE_CALENDAR_NEW_EVENT" && (
                  <GoogleCalendarTriggerConfiguration
                    workspaceId={
                      workspaceId
                    }
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}

                {triggerType ===
                  "GOOGLE_FORMS_NEW_RESPONSE" && (
                  <GoogleFormsTriggerConfiguration
                    workspaceId={
                      workspaceId
                    }
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}

                {triggerType ===
                  "GMAIL_NEW_EMAIL" && (
                  <GmailTriggerConfiguration
                    workspaceId={
                      workspaceId
                    }
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}

                {triggerType ===
                  "GITHUB_NEW_ISSUE" && (
                  <GitHubTriggerConfiguration
                    workspaceId={
                      workspaceId
                    }
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}

                {triggerType ===
                  "JIRA_NEW_ISSUE" && (
                  <JiraTriggerConfiguration
                    workspaceId={
                      workspaceId
                    }
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}

                {triggerType ===
                  "TRELLO_NEW_CARD" && (
                  <TrelloTriggerConfiguration
                    workspaceId={
                      workspaceId
                    }
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}
              </>
            )}

            {selectedNode.type ===
              "action" && (
              <>
                {actionType ===
                  "NO_OP" && (
                  <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                    This step passes its
                    input through without
                    changing it.
                  </div>
                )}

                {actionType ===
                  "HTTP_REQUEST" && (
                  <HttpActionConfiguration
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}

                {actionType ===
                  "AI_PROMPT" && (
                  <AiActionConfiguration
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}

                {actionType ===
                  "SLACK_MESSAGE" && (
                  <MessagingActionConfiguration
                    workspaceId={
                      workspaceId
                    }
                    provider="SLACK"
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}

                {actionType ===
                  "DISCORD_MESSAGE" && (
                  <MessagingActionConfiguration
                    workspaceId={
                      workspaceId
                    }
                    provider="DISCORD"
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}

                {actionType ===
                  "GOOGLE_CALENDAR_CREATE_EVENT" && (
                  <GoogleCalendarActionConfiguration
                    workspaceId={
                      workspaceId
                    }
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}

                {actionType ===
                  "GOOGLE_SHEETS_APPEND_ROW" && (
                  <GoogleSheetsActionConfiguration
                    workspaceId={
                      workspaceId
                    }
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}

                {actionType ===
                  "GMAIL_SEND_EMAIL" && (
                  <GmailActionConfiguration
                    workspaceId={
                      workspaceId
                    }
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}

                {actionType ===
                  "GITHUB_CREATE_ISSUE" && (
                  <GitHubActionConfiguration
                    workspaceId={
                      workspaceId
                    }
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}

                {actionType ===
                  "JIRA_CREATE_ISSUE" && (
                  <JiraActionConfiguration
                    workspaceId={
                      workspaceId
                    }
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}

                {actionType ===
                  "TRELLO_CREATE_CARD" && (
                  <TrelloActionConfiguration
                    workspaceId={
                      workspaceId
                    }
                    configuration={
                      configuration
                    }
                    canEdit={
                      canEdit
                    }
                    onChange={
                      updateConfiguration
                    }
                  />
                )}
              </>
            )}

            <ConfigurationSection
              title="Node details"
              description="Change the label and description displayed on the canvas."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="node-label"
                    className="text-sm font-medium"
                  >
                    Label
                  </label>

                  <Input
                    id="node-label"
                    value={
                      selectedNode.data
                        .label
                    }
                    maxLength={100}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateData({
                        label:
                          event.target
                            .value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="node-description"
                    className="text-sm font-medium"
                  >
                    Description
                  </label>

                  <textarea
                    id="node-description"
                    value={
                      selectedNode.data
                        .description ?? ""
                    }
                    rows={3}
                    maxLength={500}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateData({
                        description:
                          event.target
                            .value,
                      })
                    }
                    className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            </ConfigurationSection>

            {selectedNode.type ===
              "action" && (
              <ConfigurationSection
                title="Data mapping"
                description="Use output from the trigger or an earlier action in this step."
              >
                <DataMappingPanel
                  key={
                    selectedNode.id
                  }
                  node={selectedNode}
                  nodes={nodes}
                  edges={edges}
                />
              </ConfigurationSection>
            )}

            {canEdit &&
              selectedNode.type !==
                "trigger" && (
                <div className="flex justify-end border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() =>
                      setDeleteDialogOpen(
                        true
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                    Delete node
                  </Button>
                </div>
              )}
          </div>
        </div>
      </section>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={
          setDeleteDialogOpen
        }
      >
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </div>

            <DialogTitle>
              Delete node?
            </DialogTitle>

            <DialogDescription>
              This will remove “
              {selectedNode.data.label}”
              and every connection
              attached to it. The change
              becomes permanent after
              saving the workflow.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setDeleteDialogOpen(
                  false
                )
              }
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
            >
              Delete node
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}