import "server-only";

import {
  resolveWorkflowIntegration,
  WorkflowIntegrationError,
} from "@/features/integration/resolve-workflow-integration";

import {
  MessagingActionError,
  parseMessagingActionConfiguration,
} from "./messaging-action-configuration";
import type {
  WorkflowNodeData,
} from "./types";

type ExecuteMessagingActionOptions = {
  workflowId: string;
  data: WorkflowNodeData;
  input: Record<string, unknown>;
};

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ERROR_RESPONSE_BYTES =
  10_000;

function serializeInput(
  input: Record<string, unknown>
): string {
  try {
    const serialized = JSON.stringify(
      input,
      null,
      2
    );

    if (
      typeof serialized !== "string"
    ) {
      throw new Error();
    }

    return serialized;
  } catch {
    throw new MessagingActionError(
      "The action input could not be converted to JSON."
    );
  }
}

function buildMessage(
  message: string,
  input: Record<string, unknown>
): string {
  if (
    !message.includes("{{input}}")
  ) {
    return message;
  }

  return message.replaceAll(
    "{{input}}",
    serializeInput(input)
  );
}

async function readLimitedErrorBody(
  response: Response
): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader =
    response.body.getReader();

  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let result = "";

  try {
    while (true) {
      const chunk =
        await reader.read();

      if (chunk.done) {
        break;
      }

      receivedBytes +=
        chunk.value.byteLength;

      if (
        receivedBytes >
        MAX_ERROR_RESPONSE_BYTES
      ) {
        result +=
          "\n[Response truncated]";
        break;
      }

      result += decoder.decode(
        chunk.value,
        {
          stream: true,
        }
      );
    }

    result += decoder.decode();
  } finally {
    await reader.cancel().catch(
      () => undefined
    );
  }

  return result.trim();
}

export async function executeMessagingAction({
  workflowId,
  data,
  input,
}: ExecuteMessagingActionOptions): Promise<
  Record<string, unknown>
> {
  const configuration =
    parseMessagingActionConfiguration(
      data
    );

  const integration =
    await resolveWorkflowIntegration({
      workflowId,
      integrationId:
        configuration.integrationId,
      provider:
        configuration.provider,
    });

  const message = buildMessage(
    configuration.message,
    input
  );

  const body =
    configuration.provider === "SLACK"
      ? {
          text: message,
        }
      : {
          content: message,
          allowed_mentions: {
            parse: [],
          },
        };

  let response: Response;

  try {
    response = await fetch(
      integration.webhookUrl,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          "User-Agent":
            "Synapse-Workflow/1.0",
        },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(
          REQUEST_TIMEOUT_MS
        ),
      }
    );
  } catch (error) {
    if (
      error instanceof
      WorkflowIntegrationError
    ) {
      throw error;
    }

    if (
      error instanceof Error &&
      (error.name ===
        "TimeoutError" ||
        error.name ===
          "AbortError")
    ) {
      throw new MessagingActionError(
        `${integration.provider} webhook request timed out.`
      );
    }

    throw new MessagingActionError(
      `${integration.provider} webhook request failed${
        error instanceof Error
          ? `: ${error.message}`
          : "."
      }`
    );
  }

  if (!response.ok) {
    const responseBody =
      await readLimitedErrorBody(
        response
      );

    throw new MessagingActionError(
      `${integration.provider} webhook failed (${response.status})${
        responseBody
          ? `: ${responseBody}`
          : "."
      }`
    );
  }

  await response.body
    ?.cancel()
    .catch(() => undefined);

  return {
    success: true,
    provider:
      integration.provider,
    integrationId:
      integration.id,
    integrationName:
      integration.name,
    status: response.status,
    message:
      `${integration.provider} message sent successfully.`,
  };
}