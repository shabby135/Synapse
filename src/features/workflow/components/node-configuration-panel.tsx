"use client";

import { useState } from "react";
import {
  AlertTriangle,
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
  AiActionConfiguration,
} from "./ai-action-configuration";
import {
  DataMappingPanel,
} from "./data-mapping-panel";
import {
  GoogleCalendarActionConfiguration,
} from "./google-calendar-action-configuration";
import {
  GoogleCalendarTriggerConfiguration,
} from "./google-calendar-trigger-configuration";
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
  GoogleSheetsActionConfiguration,
} from "./google-sheets-action-configuration";
import {
  GoogleSheetsTriggerConfiguration,
} from "./google-sheets-trigger-configuration";
import {
  HttpActionConfiguration,
} from "./http-action-configuration";
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
  onUpdate: (
    nodeId: string,
    data: WorkflowNodeData
  ) => void;
  onDelete: (nodeId: string) => void;
};

const actionTypes = [
  {
    value: "NO_OP",
    label: "Test / No-op",
  },
  {
    value: "HTTP_REQUEST",
    label: "HTTP Request",
  },
  {
    value: "AI_PROMPT",
    label: "AI Prompt",
  },
  {
    value: "SLACK_MESSAGE",
    label: "Slack Message",
  },
  {
    value: "DISCORD_MESSAGE",
    label: "Discord Message",
  },
  {
    value:
      "GOOGLE_CALENDAR_CREATE_EVENT",
    label:
      "Google Calendar — Create Event",
  },
  {
    value: "GOOGLE_SHEETS_APPEND_ROW",
    label: "Google Sheets — Add Row",
  },
  {
    value: "GMAIL_SEND_EMAIL",
    label: "Gmail — Send Email",
  },
  {
    value: "GITHUB_CREATE_ISSUE",
    label: "GitHub — Create Issue",
  },
  {
    value: "TRELLO_CREATE_CARD",
    label: "Trello — Create Card",
  },
] as const;

const triggerTypes = [
  {
    value: "MANUAL",
    label: "Manual trigger",
  },
  {
    value: "GOOGLE_SHEETS_NEW_ROW",
    label: "Google Sheets — New Row",
  },
  {
    value:
      "GOOGLE_CALENDAR_NEW_EVENT",
    label:
      "Google Calendar — New Event",
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
    value: "TRELLO_NEW_CARD",
    label: "Trello — New Card",
  },
] as const;

export function NodeConfigurationPanel({
  workspaceId,
  nodes,
  edges,
  node,
  canEdit,
  onUpdate,
  onDelete,
}: NodeConfigurationPanelProps) {
  const [
    deleteDialogOpen,
    setDeleteDialogOpen,
  ] = useState(false);

  if (!node) {
    return (
      <aside className="flex w-80 shrink-0 items-center justify-center border-l bg-background p-6">
        <p className="text-center text-sm text-muted-foreground">
          Select a node to configure it.
        </p>
      </aside>
    );
  }

  const selectedNode = node;

  const actionType =
    typeof selectedNode.data
      .configuration?.actionType ===
    "string"
      ? selectedNode.data
          .configuration.actionType
      : "NO_OP";

  const triggerType =
    typeof selectedNode.data
      .configuration?.triggerType ===
    "string"
      ? selectedNode.data
          .configuration.triggerType
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
    changes: Record<string, unknown>
  ) {
    updateData({
      configuration: {
        ...selectedNode.data
          .configuration,
        ...changes,
      },
    });
  }

  function changeActionType(
    nextActionType: string
  ) {
    if (
      nextActionType ===
      "HTTP_REQUEST"
    ) {
      updateData({
        configuration: {
          actionType: "HTTP_REQUEST",
          method: "GET",
          url: "",
          headersJson: "{}",
          body: "",
          timeoutMs: 10_000,
          failOnHttpError: true,
        },
      });

      return;
    }

    if (
      nextActionType === "AI_PROMPT"
    ) {
      updateData({
        configuration: {
          actionType: "AI_PROMPT",
          provider: "GEMINI",
          model:
            "gemini-3-flash-preview",
          systemPrompt:
            "You are a helpful assistant.",
          prompt:
            "Process the following workflow input:\n\n{{input}}",
          maxOutputTokens: 1_000,
        },
      });

      return;
    }

    if (
      nextActionType ===
        "SLACK_MESSAGE" ||
      nextActionType ===
        "DISCORD_MESSAGE"
    ) {
      updateData({
        configuration: {
          actionType: nextActionType,
          integrationId: "",
          message:
            "Workflow completed:\n\n{{input}}",
        },
      });

      return;
    }

    if (
      nextActionType ===
      "GOOGLE_CALENDAR_CREATE_EVENT"
    ) {
      updateData({
        configuration: {
          actionType:
            "GOOGLE_CALENDAR_CREATE_EVENT",
          integrationId: "",
          calendarId: "primary",
          title: "Workflow event",
          description:
            "Created by Synapse",
          location: "",
          startDateTime: "",
          endDateTime: "",
          timeZone:
            "Asia/Kolkata",
          attendees: "",
          sendUpdates: false,
        },
      });

      return;
    }

    if (
      nextActionType ===
      "GOOGLE_SHEETS_APPEND_ROW"
    ) {
      updateData({
        configuration: {
          actionType:
            "GOOGLE_SHEETS_APPEND_ROW",
          integrationId: "",
          spreadsheetId: "",
          range: "Sheet1!A:Z",
          valuesJson:
            '["{{input.name}}", "{{input.email}}"]',
          valueInputOption:
            "USER_ENTERED",
        },
      });

      return;
    }

    if (
      nextActionType ===
      "GMAIL_SEND_EMAIL"
    ) {
      updateData({
        configuration: {
          actionType:
            "GMAIL_SEND_EMAIL",
          integrationId: "",
          to: "",
          cc: "",
          bcc: "",
          replyTo: "",
          subject:
            "Synapse workflow notification",
          body:
            "Workflow completed:\n\n{{input}}",
          contentType:
            "PLAIN_TEXT",
        },
      });

      return;
    }

    if (
      nextActionType ===
      "GITHUB_CREATE_ISSUE"
    ) {
      updateData({
        configuration: {
          actionType:
            "GITHUB_CREATE_ISSUE",
          integrationId: "",
          repository: "",
          title:
            "Issue from Synapse workflow",
          body:
            "Created automatically by Synapse.\n\n{{input}}",
          labels: "",
          assignees: "",
        },
      });

      return;
    }

    if (
      nextActionType ===
      "TRELLO_CREATE_CARD"
    ) {
      updateData({
        configuration: {
          actionType:
            "TRELLO_CREATE_CARD",
          integrationId: "",
          listId: "",
          name:
            "Card from Synapse workflow",
          description:
            "Created automatically by Synapse.\n\n{{input}}",
          position: "bottom",
          due: "",
          dueComplete: false,
          memberIds: "",
          labelIds: "",
        },
      });

      return;
    }

    updateData({
      configuration: {
        actionType: nextActionType,
      },
    });
  }

  function changeTriggerType(
    nextTriggerType: string
  ) {
    if (
      nextTriggerType ===
      "GOOGLE_SHEETS_NEW_ROW"
    ) {
      updateData({
        label: "Google Sheets New Row",
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
      });

      return;
    }

    if (
      nextTriggerType ===
      "GOOGLE_CALENDAR_NEW_EVENT"
    ) {
      updateData({
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
      });

      return;
    }

    if (
      nextTriggerType ===
      "GMAIL_NEW_EMAIL"
    ) {
      updateData({
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
      });

      return;
    }

    if (
      nextTriggerType ===
      "GITHUB_NEW_ISSUE"
    ) {
      updateData({
        label: "GitHub New Issue",
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
      });

      return;
    }

    if (
      nextTriggerType ===
      "TRELLO_NEW_CARD"
    ) {
      updateData({
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
      });

      return;
    }

    updateData({
      label: "Manual Trigger",
      description:
        "Starts when the workflow is run manually.",
      configuration: {
        triggerType: "MANUAL",
      },
    });
  }

  function confirmDelete() {
    onDelete(selectedNode.id);
    setDeleteDialogOpen(false);
  }

  return (
    <>
      <aside className="w-80 shrink-0 overflow-y-auto border-l bg-background">
        <div className="border-b p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {selectedNode.type}
          </p>

          <h3 className="mt-1 font-semibold">
            Configure node
          </h3>
        </div>

        <div className="space-y-5 p-4">
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
                selectedNode.data.label
              }
              maxLength={100}
              disabled={!canEdit}
              onChange={(event) =>
                updateData({
                  label:
                    event.target.value,
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
              rows={4}
              maxLength={500}
              disabled={!canEdit}
              onChange={(event) =>
                updateData({
                  description:
                    event.target.value,
                })
              }
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {selectedNode.type ===
          "trigger" ? (
            <>
              <div className="space-y-2">
                <label
                  htmlFor="trigger-type"
                  className="text-sm font-medium"
                >
                  Trigger type
                </label>

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
                        key={trigger.value}
                        value={trigger.value}
                      >
                        {trigger.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              {triggerType ===
                "GOOGLE_SHEETS_NEW_ROW" && (
                <GoogleSheetsTriggerConfiguration
                  workspaceId={workspaceId}
                  configuration={
                    selectedNode.data
                      .configuration ?? {}
                  }
                  canEdit={canEdit}
                  onChange={
                    updateConfiguration
                  }
                />
              )}

              {triggerType ===
                "GOOGLE_CALENDAR_NEW_EVENT" && (
                <GoogleCalendarTriggerConfiguration
                  workspaceId={workspaceId}
                  configuration={
                    selectedNode.data
                      .configuration ?? {}
                  }
                  canEdit={canEdit}
                  onChange={
                    updateConfiguration
                  }
                />
              )}

              {triggerType ===
                "GMAIL_NEW_EMAIL" && (
                <GmailTriggerConfiguration
                  workspaceId={workspaceId}
                  configuration={
                    selectedNode.data
                      .configuration ?? {}
                  }
                  canEdit={canEdit}
                  onChange={
                    updateConfiguration
                  }
                />
              )}

              {triggerType ===
                "GITHUB_NEW_ISSUE" && (
                <GitHubTriggerConfiguration
                  workspaceId={workspaceId}
                  configuration={
                    selectedNode.data
                      .configuration ?? {}
                  }
                  canEdit={canEdit}
                  onChange={
                    updateConfiguration
                  }
                />
              )}

              {triggerType ===
                "TRELLO_NEW_CARD" && (
                <TrelloTriggerConfiguration
                  workspaceId={workspaceId}
                  configuration={
                    selectedNode.data
                      .configuration ?? {}
                  }
                  canEdit={canEdit}
                  onChange={
                    updateConfiguration
                  }
                />
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label
                  htmlFor="action-type"
                  className="text-sm font-medium"
                >
                  Action type
                </label>

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
                  {actionTypes.map(
                    (action) => (
                      <option
                        key={action.value}
                        value={
                          action.value
                        }
                      >
                        {action.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <DataMappingPanel
                key={selectedNode.id}
                node={selectedNode}
                nodes={nodes}
                edges={edges}
              />

              {actionType ===
                "HTTP_REQUEST" && (
                <HttpActionConfiguration
                  configuration={
                    selectedNode.data
                      .configuration ??
                    {}
                  }
                  canEdit={canEdit}
                  onChange={
                    updateConfiguration
                  }
                />
              )}

              {actionType ===
                "AI_PROMPT" && (
                <AiActionConfiguration
                  configuration={
                    selectedNode.data
                      .configuration ??
                    {}
                  }
                  canEdit={canEdit}
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
                    selectedNode.data
                      .configuration ??
                    {}
                  }
                  canEdit={canEdit}
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
                    selectedNode.data
                      .configuration ??
                    {}
                  }
                  canEdit={canEdit}
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
                    selectedNode.data
                      .configuration ??
                    {}
                  }
                  canEdit={canEdit}
                  onChange={
                    updateConfiguration
                  }
                />
              )}

              {actionType ===
                "GOOGLE_SHEETS_APPEND_ROW" && (
                <GoogleSheetsActionConfiguration
                  workspaceId={workspaceId}
                  configuration={
                    selectedNode.data
                      .configuration ?? {}
                  }
                  canEdit={canEdit}
                  onChange={
                    updateConfiguration
                  }
                />
              )}

              {actionType ===
                "GMAIL_SEND_EMAIL" && (
                <GmailActionConfiguration
                  workspaceId={workspaceId}
                  configuration={
                    selectedNode.data
                      .configuration ?? {}
                  }
                  canEdit={canEdit}
                  onChange={
                    updateConfiguration
                  }
                />
              )}

              {actionType ===
                "GITHUB_CREATE_ISSUE" && (
                <GitHubActionConfiguration
                  workspaceId={workspaceId}
                  configuration={
                    selectedNode.data
                      .configuration ?? {}
                  }
                  canEdit={canEdit}
                  onChange={
                    updateConfiguration
                  }
                />
              )}

              {actionType ===
                "TRELLO_CREATE_CARD" && (
                <TrelloActionConfiguration
                  workspaceId={workspaceId}
                  configuration={
                    selectedNode.data
                      .configuration ?? {}
                  }
                  canEdit={canEdit}
                  onChange={
                    updateConfiguration
                  }
                />
              )}
            </>
          )}

          {canEdit &&
            selectedNode.type !==
              "trigger" && (
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() =>
                  setDeleteDialogOpen(
                    true
                  )
                }
              >
                <Trash2 className="size-4" />
                Delete node
              </Button>
            )}
        </div>
      </aside>

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
              and all connections attached
              to it. The change will become
              permanent after you save the
              workflow.
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