import "server-only";

import { createHash } from "node:crypto";

import {
  resolveWorkflowIntegration,
  WorkflowIntegrationError,
} from "@/features/integration/resolve-workflow-integration";

import {
  parseTrelloActionConfiguration,
  TrelloActionError,
  type TrelloActionConfiguration,
} from "./trello-action-configuration";
import type {
  WorkflowNodeData,
} from "./types";

type ExecuteTrelloActionOptions = {
  runId: string;
  workflowId: string;
  nodeId: string;
  data: WorkflowNodeData;
};

type TrelloCard = {
  id?: unknown;
  name?: unknown;
  desc?: unknown;
  idList?: unknown;
  url?: unknown;
  shortUrl?: unknown;
  closed?: unknown;
  due?: unknown;
  dueComplete?: unknown;
};

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2_500_000;
const IDEMPOTENCY_CARD_LIMIT = 1_000;

const trelloHeaders = (
  apiKey: string,
  apiToken: string
) => ({
  Authorization:
    `OAuth oauth_consumer_key="${apiKey}", oauth_token="${apiToken}"`,
  Accept: "application/json",
  "User-Agent": "Synapse-Workflow/1.0",
});

async function readBody(
  response: Response
): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = "";

  try {
    while (true) {
      const chunk = await reader.read();

      if (chunk.done) break;

      bytes += chunk.value.byteLength;

      if (bytes > MAX_RESPONSE_BYTES) {
        throw new TrelloActionError(
          "Trello returned an unexpectedly large response."
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

function providerError(
  body: string
): string {
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

function parseCard(body: string): TrelloCard {
  try {
    const parsed: unknown =
      JSON.parse(body);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error();
    }

    return parsed as TrelloCard;
  } catch {
    throw new TrelloActionError(
      "Trello returned an invalid card response."
    );
  }
}

function parseCardList(
  body: string
): TrelloCard[] {
  try {
    const parsed: unknown =
      JSON.parse(body);

    if (!Array.isArray(parsed)) {
      throw new Error();
    }

    return parsed as TrelloCard[];
  } catch {
    throw new TrelloActionError(
      "Trello returned an invalid card list."
    );
  }
}

export function createTrelloCardMarker(
  runId: string,
  nodeId: string
): string {
  const digest = createHash("sha256")
    .update(`${runId}:${nodeId}`)
    .digest("hex");

  return `<!-- synapse-execution:${digest} -->`;
}

export function createTrelloCardRequest(
  configuration: TrelloActionConfiguration,
  marker: string
) {
  return {
    idList: configuration.listId,
    name: configuration.name,
    desc: configuration.description
      ? `${configuration.description}\n\n${marker}`
      : marker,
    pos: configuration.position,
    ...(configuration.due
      ? { due: configuration.due }
      : {}),
    dueComplete:
      configuration.dueComplete,
    idMembers: configuration.memberIds,
    idLabels: configuration.labelIds,
  };
}

async function trelloRequest(
  url: string,
  init: RequestInit,
  failureMessage: string
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
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
      throw new TrelloActionError(
        `${failureMessage} timed out.`
      );
    }

    throw new TrelloActionError(
      `${failureMessage} failed.`
    );
  }
}

async function findExistingCard(
  apiKey: string,
  apiToken: string,
  listId: string,
  marker: string
): Promise<TrelloCard | null> {
  const query = new URLSearchParams({
    filter: "all",
    fields:
      "id,name,desc,idList,url,shortUrl,closed,due,dueComplete",
    limit: String(
      IDEMPOTENCY_CARD_LIMIT
    ),
  });
  const response = await trelloRequest(
    `https://api.trello.com/1/lists/${encodeURIComponent(listId)}/cards?${query.toString()}`,
    {
      method: "GET",
      headers: trelloHeaders(
        apiKey,
        apiToken
      ),
    },
    "Trello idempotency check"
  );
  const body = await readBody(response);

  if (!response.ok) {
    const detail = providerError(body);

    throw new TrelloActionError(
      `Trello idempotency check failed (${response.status})${detail ? `: ${detail}` : "."}`
    );
  }

  return (
    parseCardList(body).find(
      (card) =>
        typeof card.desc === "string" &&
        card.desc.includes(marker)
    ) ?? null
  );
}

function cardOutput(
  card: TrelloCard,
  integration: {
    id: string;
    name: string;
  },
  listId: string,
  recoveredFromRetry: boolean
): Record<string, unknown> {
  if (
    typeof card.id !== "string" ||
    !/^[0-9a-f]{24}$/i.test(card.id)
  ) {
    throw new TrelloActionError(
      "Trello did not return a valid card ID."
    );
  }

  return {
    success: true,
    provider: "TRELLO",
    integrationId: integration.id,
    integrationName: integration.name,
    listId,
    cardId: card.id,
    name:
      typeof card.name === "string"
        ? card.name
        : null,
    url:
      typeof card.url === "string"
        ? card.url
        : typeof card.shortUrl ===
            "string"
          ? card.shortUrl
          : null,
    closed:
      typeof card.closed === "boolean"
        ? card.closed
        : null,
    due:
      typeof card.due === "string"
        ? card.due
        : null,
    dueComplete:
      typeof card.dueComplete ===
      "boolean"
        ? card.dueComplete
        : null,
    recoveredFromRetry,
    message: recoveredFromRetry
      ? "Trello card already created successfully."
      : "Trello card created successfully.",
  };
}

export async function executeTrelloAction({
  runId,
  workflowId,
  nodeId,
  data,
}: ExecuteTrelloActionOptions): Promise<
  Record<string, unknown>
> {
  const configuration =
    parseTrelloActionConfiguration(data);
  const integration =
    await resolveWorkflowIntegration({
      workflowId,
      integrationId:
        configuration.integrationId,
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

  const marker = createTrelloCardMarker(
    runId,
    nodeId
  );
  const existing = await findExistingCard(
    apiKey,
    apiToken,
    configuration.listId,
    marker
  );

  if (existing) {
    return cardOutput(
      existing,
      integration,
      configuration.listId,
      true
    );
  }

  const response = await trelloRequest(
    "https://api.trello.com/1/cards",
    {
      method: "POST",
      headers: {
        ...trelloHeaders(
          apiKey,
          apiToken
        ),
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(
        createTrelloCardRequest(
          configuration,
          marker
        )
      ),
    },
    "Trello create-card request"
  );
  const body = await readBody(response);

  if (!response.ok) {
    const detail = providerError(body);

    throw new TrelloActionError(
      `Trello create-card failed (${response.status})${detail ? `: ${detail}` : "."}`
    );
  }

  return cardOutput(
    parseCard(body),
    integration,
    configuration.listId,
    false
  );
}
