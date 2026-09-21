import {
  resolveActionConfiguration,
  type MappingContext,
} from "./data-mapping";

import {
  executeAiPrompt,
} from "./execute-ai-prompt";
import {
  executeGmailAction,
} from "./execute-gmail-action";
import {
  executeGoogleCalendarAction,
} from "./execute-google-calendar-action";
import {
  executeGoogleSheetsAction,
} from "./execute-google-sheets-action";
import {
  executeHttpRequest,
} from "./execute-http-request";
import {
  executeMessagingAction,
} from "./execute-messaging-action";
import type {
  WorkflowNodeData,
} from "./types";

type ExecuteActionOptions = {
  runId: string;
  workflowId: string;
  nodeId: string;
  data: WorkflowNodeData;
  input: Record<string, unknown>;
  mappingContext?: MappingContext;
};

export class UnsupportedWorkflowActionError
  extends Error {
  constructor(actionType: string) {
    super(
      `Action type ${actionType} is not implemented yet.`
    );

    this.name =
      "UnsupportedWorkflowActionError";
  }
}

export async function executeAction({
  runId,
  workflowId,
  nodeId,
  data,
  input,
  mappingContext,
}: ExecuteActionOptions): Promise<
  Record<string, unknown>
> {
  const originalPrompt =
    data.configuration?.prompt;

  const promptHadMapping =
    typeof originalPrompt ===
      "string" &&
    originalPrompt.includes("{{");

  data = {
    ...data,
    configuration:
      resolveActionConfiguration(
        data.configuration ?? {},
        mappingContext ?? {
          trigger: input,
          input,
          nodes: {},
        }
      ),
  };

  const actionType =
    data.configuration?.actionType;

  if (
    typeof actionType !== "string" ||
    !actionType.trim()
  ) {
    throw new Error(
      `Node ${data.label} has no action type.`
    );
  }

  switch (actionType) {
    case "NO_OP":
      return {
        success: true,
        message:
          "Test action completed.",
        runId,
        workflowId,
        nodeId,
        receivedInput: input,
      };

    case "HTTP_REQUEST":
      return executeHttpRequest({
        data,
        input,
      });

    case "AI_PROMPT":
      return executeAiPrompt({
        data,
        input,
        templatesResolved: true,
        appendInput:
          !promptHadMapping,
      });

    case "SLACK_MESSAGE":
    case "DISCORD_MESSAGE":
      return executeMessagingAction({
        workflowId,
        data,
        input,
        templatesResolved: true,
      });

    case "GOOGLE_CALENDAR_CREATE_EVENT":
      return executeGoogleCalendarAction({
        runId,
        workflowId,
        nodeId,
        data,
      });

    case "GOOGLE_SHEETS_APPEND_ROW":
      return executeGoogleSheetsAction({
        workflowId,
        data,
      });

    case "GMAIL_SEND_EMAIL":
      return executeGmailAction({
        runId,
        workflowId,
        nodeId,
        data,
      });

    default:
      throw new UnsupportedWorkflowActionError(
        actionType
      );
  }
}