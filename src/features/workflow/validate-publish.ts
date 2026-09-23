import type {
  WorkflowDefinition,
} from "@/lib/db/schema/workflow";

import {
  AiPromptActionError,
  parseAiPromptConfiguration,
} from "./ai-prompt-configuration";
import {
  configurationForPublish,
  DataMappingError,
  getAncestorNodeIds,
} from "./data-mapping";
import {
  GoogleCalendarActionError,
  parseGoogleCalendarActionConfiguration,
} from "./google-calendar-action-configuration";
import {
  GoogleCalendarTriggerError,
  parseGoogleCalendarTriggerConfiguration,
} from "./google-calendar-trigger-configuration";
import {
  GmailActionError,
  parseGmailActionConfiguration,
} from "./gmail-action-configuration";
import {
  GmailTriggerError,
  parseGmailTriggerConfiguration,
} from "./gmail-trigger-configuration";
import {
  GitHubActionError,
  parseGitHubActionConfiguration,
} from "./github-action-configuration";
import {
  GitHubTriggerError,
  parseGitHubTriggerConfiguration,
} from "./github-trigger-configuration";
import {
  GoogleSheetsActionError,
  parseGoogleSheetsActionConfiguration,
} from "./google-sheets-action-configuration";
import {
  GoogleSheetsTriggerError,
  parseGoogleSheetsTriggerConfiguration,
} from "./google-sheets-trigger-configuration";
import {
  HttpActionError,
  parseHttpActionConfiguration,
} from "./http-request-configuration";
import {
  MessagingActionError,
  parseMessagingActionConfiguration,
} from "./messaging-action-configuration";
import {
  parseTrelloTriggerConfiguration,
  TrelloTriggerError,
} from "./trello-trigger-configuration";
import {
  saveWorkflowDefinitionSchema,
} from "./validator";

export type PublishValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      message: string;
    };

const supportedActionTypes: ReadonlySet<string> =
  new Set([
    "NO_OP",
    "HTTP_REQUEST",
    "AI_PROMPT",
    "SLACK_MESSAGE",
    "DISCORD_MESSAGE",
    "GOOGLE_CALENDAR_CREATE_EVENT",
    "GOOGLE_SHEETS_APPEND_ROW",
    "GMAIL_SEND_EMAIL",
    "GITHUB_CREATE_ISSUE",
  ]);

export function validateWorkflowForPublish(
  workflowId: string,
  definition: WorkflowDefinition
): PublishValidationResult {
  const parsed =
    saveWorkflowDefinitionSchema.safeParse({
      id: workflowId,
      nodes: definition.nodes,
      edges: definition.edges,
    });

  if (!parsed.success) {
    return {
      valid: false,
      message:
        parsed.error.issues[0]
          ?.message ??
        "The workflow definition is invalid.",
    };
  }

  const { nodes, edges } = parsed.data;

  const trigger = nodes.find(
    (node) =>
      node.type === "trigger"
  );

  if (!trigger) {
    return {
      valid: false,
      message:
        "The workflow requires a trigger.",
    };
  }

  const triggerType =
    trigger.data.configuration
      ?.triggerType ?? "MANUAL";

  try {
    if (triggerType === "MANUAL") {
      // Manual triggers have no additional configuration.
    } else if (
      triggerType ===
      "GOOGLE_SHEETS_NEW_ROW"
    ) {
      parseGoogleSheetsTriggerConfiguration(
        trigger.data
      );
    } else if (
      triggerType ===
      "GOOGLE_CALENDAR_NEW_EVENT"
    ) {
      parseGoogleCalendarTriggerConfiguration(
        trigger.data
      );
    } else if (
      triggerType ===
      "GMAIL_NEW_EMAIL"
    ) {
      parseGmailTriggerConfiguration(
        trigger.data
      );
    } else if (
      triggerType ===
      "GITHUB_NEW_ISSUE"
    ) {
      parseGitHubTriggerConfiguration(
        trigger.data
      );
    } else if (
      triggerType ===
      "TRELLO_NEW_CARD"
    ) {
      parseTrelloTriggerConfiguration(
        trigger.data
      );
    } else {
      return {
        valid: false,
        message: `${trigger.data.label} uses a trigger type that is not implemented yet.`,
      };
    }
  } catch (error) {
    if (
      error instanceof
        GoogleSheetsTriggerError ||
      error instanceof
        GoogleCalendarTriggerError ||
      error instanceof GmailTriggerError ||
      error instanceof GitHubTriggerError ||
      error instanceof TrelloTriggerError
    ) {
      return {
        valid: false,
        message: `${trigger.data.label}: ${error.message}`,
      };
    }

    return {
      valid: false,
      message: `${trigger.data.label} has invalid configuration.`,
    };
  }

  const actions = nodes.filter(
    (node) =>
      node.type === "action"
  );

  if (actions.length === 0) {
    return {
      valid: false,
      message:
        "Add at least one action before publishing.",
    };
  }

  if (
    edges.some(
      (edge) =>
        edge.target === trigger.id
    )
  ) {
    return {
      valid: false,
      message:
        "The trigger cannot have incoming connections.",
    };
  }

  for (const action of actions) {
    const actionType =
      action.data.configuration
        ?.actionType;

    if (
      typeof actionType !== "string" ||
      !actionType.trim()
    ) {
      return {
        valid: false,
        message: `${action.data.label} requires an action type.`,
      };
    }

    if (
      !supportedActionTypes.has(
        actionType
      )
    ) {
      return {
        valid: false,
        message: `${action.data.label} uses an action type that is not implemented yet.`,
      };
    }

    try {
      const validationData = {
        ...action.data,
        configuration:
          configurationForPublish(
            action.data.configuration ??
              {},
            getAncestorNodeIds(
              action.id,
              edges
            )
          ),
      };

      if (
        actionType ===
        "HTTP_REQUEST"
      ) {
        parseHttpActionConfiguration(
          validationData
        );
      }

      if (
        actionType === "AI_PROMPT"
      ) {
        parseAiPromptConfiguration(
          validationData
        );
      }

      if (
        actionType ===
          "SLACK_MESSAGE" ||
        actionType ===
          "DISCORD_MESSAGE"
      ) {
        parseMessagingActionConfiguration(
          validationData
        );
      }

      if (
        actionType ===
        "GOOGLE_CALENDAR_CREATE_EVENT"
      ) {
        parseGoogleCalendarActionConfiguration(
          validationData
        );
      }

      if (
        actionType ===
        "GOOGLE_SHEETS_APPEND_ROW"
      ) {
        parseGoogleSheetsActionConfiguration(
          validationData
        );
      }

      if (
        actionType ===
        "GMAIL_SEND_EMAIL"
      ) {
        parseGmailActionConfiguration(
          validationData
        );
      }

      if (
        actionType ===
        "GITHUB_CREATE_ISSUE"
      ) {
        parseGitHubActionConfiguration(
          validationData
        );
      }
    } catch (error) {
      if (
        error instanceof
          DataMappingError ||
        error instanceof
          HttpActionError ||
        error instanceof
          AiPromptActionError ||
        error instanceof
          MessagingActionError ||
        error instanceof
          GoogleCalendarActionError ||
        error instanceof
          GoogleSheetsActionError ||
        error instanceof
          GmailActionError ||
        error instanceof
          GitHubActionError
      ) {
        return {
          valid: false,
          message: `${action.data.label}: ${error.message}`,
        };
      }

      return {
        valid: false,
        message: `${action.data.label} has invalid configuration.`,
      };
    }
  }

  const adjacency = new Map<
    string,
    string[]
  >();

  for (const node of nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    adjacency
      .get(edge.source)
      ?.push(edge.target);
  }

  const reachable = new Set<string>();
  const queue = [trigger.id];

  while (queue.length > 0) {
    const nodeId = queue.shift();

    if (
      !nodeId ||
      reachable.has(nodeId)
    ) {
      continue;
    }

    reachable.add(nodeId);

    for (
      const nextNodeId of
      adjacency.get(nodeId) ?? []
    ) {
      queue.push(nextNodeId);
    }
  }

  const unreachableNode = nodes.find(
    (node) =>
      !reachable.has(node.id)
  );

  if (unreachableNode) {
    return {
      valid: false,
      message: `${unreachableNode.data.label} is not connected to the trigger.`,
    };
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function containsCycle(
    nodeId: string
  ): boolean {
    if (visiting.has(nodeId)) {
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visiting.add(nodeId);

    for (
      const nextNodeId of
      adjacency.get(nodeId) ?? []
    ) {
      if (
        containsCycle(nextNodeId)
      ) {
        return true;
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);

    return false;
  }

  if (containsCycle(trigger.id)) {
    return {
      valid: false,
      message:
        "Workflow connections cannot contain a cycle.",
    };
  }

  return {
    valid: true,
  };
}