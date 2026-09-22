import "server-only";

import {
  resolveWorkflowIntegration,
  WorkflowIntegrationError,
} from "@/features/integration/resolve-workflow-integration";

import {
  createGmailTriggerCursor,
  type GmailApiMessage,
  type GmailMessageListPage,
  GmailTriggerError,
  gmailMessagesQuery,
  parseGmailMessageList,
  parseGmailTriggerConfiguration,
  parseGmailTriggerCursor,
  processGmailMessagesPage,
} from "./gmail-trigger-configuration";
import type {
  IntegrationTriggerHandler,
} from "./integration-trigger-registry";

const REQUEST_TIMEOUT_MS = 15_000;

const MAX_LIST_RESPONSE_BYTES =
  1_000_000;

const MAX_MESSAGE_RESPONSE_BYTES =
  2_000_000;

const MESSAGE_FETCH_CONCURRENCY = 5;

async function readLimitedBody(
  response: Response,
  maximumBytes: number
) {
  if (!response.body) return "";

  const reader =
    response.body.getReader();

  const decoder = new TextDecoder();

  let received = 0;
  let result = "";

  try {
    while (true) {
      const chunk =
        await reader.read();

      if (chunk.done) break;

      received +=
        chunk.value.byteLength;

      if (received > maximumBytes) {
        throw new GmailTriggerError(
          "Gmail returned too much message data."
        );
      }

      result += decoder.decode(
        chunk.value,
        {
          stream: true,
        }
      );
    }

    return (
      result + decoder.decode()
    );
  } finally {
    await reader
      .cancel()
      .catch(() => undefined);
  }
}

function providerError(body: string) {
  try {
    const parsed = JSON.parse(
      body
    ) as {
      error?: {
        message?: unknown;
      };
    };

    return typeof parsed.error
      ?.message === "string"
      ? parsed.error.message.slice(
          0,
          500
        )
      : "";
  } catch {
    return "";
  }
}

function parseListPage(
  body: string
): GmailMessageListPage {
  try {
    const parsed = JSON.parse(body);

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error();
    }

    return parsed as GmailMessageListPage;
  } catch {
    throw new GmailTriggerError(
      "Gmail returned an invalid message list."
    );
  }
}

function parseMessage(
  body: string
): GmailApiMessage {
  try {
    const parsed = JSON.parse(body);

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error();
    }

    return parsed as GmailApiMessage;
  } catch {
    throw new GmailTriggerError(
      "Gmail returned an invalid message."
    );
  }
}

async function request(
  url: string,
  accessToken: string
) {
  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
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
      (error.name ===
        "TimeoutError" ||
        error.name ===
          "AbortError")
    ) {
      throw new GmailTriggerError(
        "Gmail trigger polling timed out."
      );
    }

    throw new GmailTriggerError(
      "Gmail trigger polling failed."
    );
  }
}

async function fetchMessage(
  id: string,
  accessToken: string
): Promise<GmailApiMessage | null> {
  const query =
    new URLSearchParams({
      format: "full",
    });

  const response = await request(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
      id
    )}?${query.toString()}`,
    accessToken
  );

  const body = await readLimitedBody(
    response,
    MAX_MESSAGE_RESPONSE_BYTES
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const detail =
      providerError(body);

    throw new GmailTriggerError(
      `Gmail message retrieval failed (${response.status})${
        detail
          ? `: ${detail}`
          : "."
      }`
    );
  }

  return parseMessage(body);
}

async function fetchMessages(
  ids: string[],
  accessToken: string
) {
  const messages:
    GmailApiMessage[] = [];

  for (
    let index = 0;
    index < ids.length;
    index +=
      MESSAGE_FETCH_CONCURRENCY
  ) {
    const batch = ids.slice(
      index,
      index +
        MESSAGE_FETCH_CONCURRENCY
    );

    const results =
      await Promise.all(
        batch.map((id) =>
          fetchMessage(
            id,
            accessToken
          )
        )
      );

    for (const message of results) {
      if (message) {
        messages.push(message);
      }
    }
  }

  return messages;
}

export const gmailTriggerHandler: IntegrationTriggerHandler =
  {
    type: "GMAIL_NEW_EMAIL",
    provider: "GMAIL",

    async poll({
      workflowId,
      activatedAt,
      configuration,
      cursor,
    }) {
      const parsedConfiguration =
        parseGmailTriggerConfiguration(
          {
            label: "Gmail trigger",
            configuration,
          }
        );

      const integration =
        await resolveWorkflowIntegration(
          {
            workflowId,
            integrationId:
              parsedConfiguration
                .integrationId,
            provider: "GMAIL",
          }
        );

      const accessToken =
        integration.credentials
          .accessToken;

      if (!accessToken) {
        throw new WorkflowIntegrationError(
          "The Gmail integration does not contain an access token."
        );
      }

      const activeCursor =
        parseGmailTriggerCursor(
          cursor
        ) ??
        createGmailTriggerCursor(
          parsedConfiguration,
          activatedAt
        );

      const pollingWindow =
        gmailMessagesQuery({
          configuration:
            parsedConfiguration,
          cursor: activeCursor,
          now: new Date(),
        });

      const response =
        await request(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?${pollingWindow.query.toString()}`,
          accessToken
        );

      const body =
        await readLimitedBody(
          response,
          MAX_LIST_RESPONSE_BYTES
        );

      if (!response.ok) {
        const detail =
          providerError(body);

        throw new GmailTriggerError(
          `Gmail trigger polling failed (${response.status})${
            detail
              ? `: ${detail}`
              : "."
          }`
        );
      }

      const page =
        parseListPage(body);

      const ids =
        parseGmailMessageList(page);

      const messages =
        await fetchMessages(
          ids,
          accessToken
        );

      const detected =
        processGmailMessagesPage({
          page,
          messages,
          windowStartMs:
            pollingWindow
              .windowStartMs,
          windowEndMs:
            pollingWindow
              .windowEndMs,
        });

      return {
        ...detected,
        pollIntervalMinutes:
          parsedConfiguration
            .pollIntervalMinutes,
      };
    },
  };
  