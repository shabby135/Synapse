import "server-only";

import {
  resolveWorkflowIntegration,
  WorkflowIntegrationError,
} from "@/features/integration/resolve-workflow-integration";

import type {
  IntegrationTriggerHandler,
} from "./integration-trigger-registry";
import {
  createTrelloTriggerCursor,
  parseTrelloTriggerConfiguration,
  parseTrelloTriggerCursor,
  processTrelloActionsPage,
  type TrelloApiAction,
  trelloActionsQuery,
  TrelloTriggerError,
} from "./trello-trigger-configuration";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2_000_000;

async function readLimitedBody(
  response: Response
) {
  if (!response.body) return "";

  const reader =
    response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let result = "";

  try {
    while (true) {
      const chunk = await reader.read();

      if (chunk.done) break;

      received += chunk.value.byteLength;

      if (received > MAX_RESPONSE_BYTES) {
        throw new TrelloTriggerError(
          "Trello returned too much action data."
        );
      }

      result += decoder.decode(
        chunk.value,
        { stream: true }
      );
    }

    return result + decoder.decode();
  } finally {
    await reader
      .cancel()
      .catch(() => undefined);
  }
}

function providerError(body: string) {
  try {
    const parsed = JSON.parse(body) as {
      message?: unknown;
      error?: unknown;
    };
    const detail =
      typeof parsed.message === "string"
        ? parsed.message
        : typeof parsed.error === "string"
          ? parsed.error
          : "";

    return detail.slice(0, 500);
  } catch {
    return "";
  }
}

function parseActions(
  body: string
): TrelloApiAction[] {
  try {
    const parsed = JSON.parse(body);

    if (!Array.isArray(parsed)) {
      throw new Error();
    }

    return parsed as TrelloApiAction[];
  } catch {
    throw new TrelloTriggerError(
      "Trello returned an invalid action list."
    );
  }
}

async function request(
  url: string,
  apiKey: string,
  apiToken: string
) {
  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        Authorization:
          `OAuth oauth_consumer_key="${apiKey}", oauth_token="${apiToken}"`,
        Accept: "application/json",
        "User-Agent":
          "Synapse-Workflow/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(
        REQUEST_TIMEOUT_MS
      ),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" ||
        error.name === "AbortError")
    ) {
      throw new TrelloTriggerError(
        "Trello trigger polling timed out."
      );
    }

    throw new TrelloTriggerError(
      "Trello trigger polling failed."
    );
  }
}

export const trelloTriggerHandler: IntegrationTriggerHandler = {
  type: "TRELLO_NEW_CARD",
  provider: "TRELLO",
  async poll({
    workflowId,
    activatedAt,
    configuration,
    cursor,
  }) {
    const parsedConfiguration =
      parseTrelloTriggerConfiguration({
        label: "Trello trigger",
        configuration,
      });
    const integration =
      await resolveWorkflowIntegration({
        workflowId,
        integrationId:
          parsedConfiguration.integrationId,
        provider: "TRELLO",
      });
    const apiKey =
      integration.credentials.apiKey;
    const apiToken =
      integration.credentials.apiToken;

    if (!apiKey || !apiToken) {
      throw new WorkflowIntegrationError(
        "The Trello integration does not contain an API key and token."
      );
    }

    const activeCursor =
      parseTrelloTriggerCursor(cursor) ??
      createTrelloTriggerCursor(
        parsedConfiguration,
        activatedAt
      );
    const pollingWindow =
      trelloActionsQuery({
        cursor: activeCursor,
        now: new Date(),
      });
    const response = await request(
      `https://api.trello.com/1/boards/${encodeURIComponent(parsedConfiguration.boardId)}/actions?${pollingWindow.query.toString()}`,
      apiKey,
      apiToken
    );
    const body = await readLimitedBody(
      response
    );

    if (!response.ok) {
      const detail = providerError(body);

      throw new TrelloTriggerError(
        `Trello card polling failed (${response.status})${detail ? `: ${detail}` : "."}`
      );
    }

    const detected =
      processTrelloActionsPage({
        actions: parseActions(body),
        configuration:
          parsedConfiguration,
        windowStartMs:
          pollingWindow.windowStartMs,
        windowEndMs:
          pollingWindow.windowEndMs,
        page: pollingWindow.page,
      });

    return {
      ...detected,
      pollIntervalMinutes:
        parsedConfiguration.pollIntervalMinutes,
    };
  },
};
