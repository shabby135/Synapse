import "server-only";

import {
  createHash,
} from "node:crypto";

import {
  resolveWorkflowIntegration,
  WorkflowIntegrationError,
} from "@/features/integration/resolve-workflow-integration";

import {
  GmailActionError,
  parseGmailActionConfiguration,
} from "./gmail-action-configuration";
import type {
  WorkflowNodeData,
} from "./types";

type ExecuteGmailActionOptions = {
  runId: string;
  workflowId: string;
  nodeId: string;
  data: WorkflowNodeData;
};

type GmailMessage = {
  id?: unknown;
  threadId?: unknown;
  labelIds?: unknown;
};

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 20_000;

async function readLimitedResponseBody(
  response: Response
): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader =
    response.body.getReader();
  const decoder =
    new TextDecoder();

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
        MAX_RESPONSE_BYTES
      ) {
        throw new GmailActionError(
          "Gmail returned an unexpectedly large response."
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
    await reader.cancel().catch(
      () => undefined
    );
  }
}

function getProviderError(
  body: string
): string {
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

function parseGmailMessage(
  body: string
): GmailMessage {
  try {
    const parsed: unknown =
      JSON.parse(body);

    if (
      !parsed ||
      typeof parsed !== "object"
    ) {
      throw new Error();
    }

    return parsed as GmailMessage;
  } catch {
    throw new GmailActionError(
      "Gmail returned an invalid response."
    );
  }
}

function encodeHeader(
  value: string
): string {
  const encoded = Buffer.from(
    value,
    "utf8"
  ).toString("base64");

  return `=?UTF-8?B?${encoded}?=`;
}

function wrapBase64(
  value: string
): string {
  return (
    value
      .match(/.{1,76}/g)
      ?.join("\r\n") ?? ""
  );
}

function buildRawMessage(
  configuration: ReturnType<
    typeof parseGmailActionConfiguration
  >,
  messageId: string
): string {
  const headers = [
    `To: ${configuration.to.join(
      ", "
    )}`,
  ];

  if (
    configuration.cc.length > 0
  ) {
    headers.push(
      `Cc: ${configuration.cc.join(
        ", "
      )}`
    );
  }

  if (
    configuration.bcc.length > 0
  ) {
    headers.push(
      `Bcc: ${configuration.bcc.join(
        ", "
      )}`
    );
  }

  if (configuration.replyTo) {
    headers.push(
      `Reply-To: ${configuration.replyTo}`
    );
  }

  headers.push(
    `Subject: ${encodeHeader(
      configuration.subject
    )}`,
    `Message-ID: <${messageId}>`,
    "MIME-Version: 1.0",
    `Content-Type: ${
      configuration.contentType ===
      "HTML"
        ? "text/html"
        : "text/plain"
    }; charset=UTF-8`,
    "Content-Transfer-Encoding: base64"
  );

  const encodedBody = wrapBase64(
    Buffer.from(
      configuration.body,
      "utf8"
    ).toString("base64")
  );

  const mimeMessage =
    `${headers.join(
      "\r\n"
    )}\r\n\r\n${encodedBody}`;

  return Buffer.from(
    mimeMessage,
    "utf8"
  ).toString("base64url");
}

async function findExistingMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage | null> {
  const query =
    new URLSearchParams({
      q: `rfc822msgid:${messageId}`,
      maxResults: "1",
    });

  let response: Response;

  try {
    response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${query.toString()}`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          Accept:
            "application/json",
          "User-Agent":
            "Synapse-Workflow/1.0",
        },
        redirect: "error",
        signal:
          AbortSignal.timeout(
            REQUEST_TIMEOUT_MS
          ),
      }
    );
  } catch {
    throw new GmailActionError(
      "Gmail idempotency check failed."
    );
  }

  const body =
    await readLimitedResponseBody(
      response
    );

  if (!response.ok) {
    const detail =
      getProviderError(body);

    throw new GmailActionError(
      `Gmail idempotency check failed (${response.status})${
        detail
          ? `: ${detail}`
          : "."
      }`
    );
  }

  try {
    const parsed = JSON.parse(
      body
    ) as {
      messages?: unknown;
    };

    if (
      !Array.isArray(
        parsed.messages
      ) ||
      parsed.messages.length === 0
    ) {
      return null;
    }

    const firstMessage =
      parsed.messages[0];

    return firstMessage &&
      typeof firstMessage ===
        "object"
      ? (firstMessage as GmailMessage)
      : null;
  } catch {
    throw new GmailActionError(
      "Gmail returned an invalid search response."
    );
  }
}

export async function executeGmailAction({
  runId,
  workflowId,
  nodeId,
  data,
}: ExecuteGmailActionOptions): Promise<
  Record<string, unknown>
> {
  const configuration =
    parseGmailActionConfiguration(
      data
    );

  const integration =
    await resolveWorkflowIntegration({
      workflowId,
      integrationId:
        configuration.integrationId,
      provider: "GMAIL",
    });

  const accessToken =
    integration.credentials
      .accessToken;

  if (!accessToken) {
    throw new WorkflowIntegrationError(
      "The Gmail integration does not contain an access token."
    );
  }

  const messageId =
    `${createHash("sha256")
      .update(
        `${runId}:${nodeId}`
      )
      .digest(
        "hex"
      )}@synapse.workflow`;

  const existingMessage =
    await findExistingMessage(
      accessToken,
      messageId
    );

  if (
    existingMessage &&
    typeof existingMessage.id ===
      "string"
  ) {
    return {
      success: true,
      provider: "GMAIL",
      integrationId:
        integration.id,
      integrationName:
        integration.name,
      messageId:
        existingMessage.id,
      threadId:
        typeof existingMessage.threadId ===
        "string"
          ? existingMessage.threadId
          : null,
      recoveredFromRetry: true,
      message:
        "Gmail message already sent successfully.",
    };
  }

  let response: Response;

  try {
    response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
          Accept:
            "application/json",
          "User-Agent":
            "Synapse-Workflow/1.0",
        },
        body: JSON.stringify({
          raw: buildRawMessage(
            configuration,
            messageId
          ),
        }),
        redirect: "error",
        signal:
          AbortSignal.timeout(
            REQUEST_TIMEOUT_MS
          ),
      }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name ===
        "TimeoutError" ||
        error.name ===
          "AbortError")
    ) {
      throw new GmailActionError(
        "Gmail send request timed out."
      );
    }

    throw new GmailActionError(
      "Gmail send request failed."
    );
  }

  const body =
    await readLimitedResponseBody(
      response
    );

  if (!response.ok) {
    const detail =
      getProviderError(body);

    throw new GmailActionError(
      `Gmail send failed (${response.status})${
        detail
          ? `: ${detail}`
          : "."
      }`
    );
  }

  const sentMessage =
    parseGmailMessage(body);

  if (
    typeof sentMessage.id !==
    "string"
  ) {
    throw new GmailActionError(
      "Gmail did not return a message ID."
    );
  }

  return {
    success: true,
    provider: "GMAIL",
    integrationId:
      integration.id,
    integrationName:
      integration.name,
    messageId: sentMessage.id,
    threadId:
      typeof sentMessage.threadId ===
      "string"
        ? sentMessage.threadId
        : null,
    labelIds: Array.isArray(
      sentMessage.labelIds
    )
      ? sentMessage.labelIds.filter(
          (
            item
          ): item is string =>
            typeof item ===
            "string"
        )
      : [],
    recoveredFromRetry: false,
    message:
      "Gmail message sent successfully.",
  };
}