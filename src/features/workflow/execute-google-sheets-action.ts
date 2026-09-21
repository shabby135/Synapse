import "server-only";

import {
  resolveWorkflowIntegration,
  WorkflowIntegrationError,
} from "@/features/integration/resolve-workflow-integration";

import {
  GoogleSheetsActionError,
  parseGoogleSheetsActionConfiguration,
} from "./google-sheets-action-configuration";
import type {
  WorkflowNodeData,
} from "./types";

type ExecuteGoogleSheetsActionOptions = {
  workflowId: string;
  data: WorkflowNodeData;
};

type GoogleSheetsAppendResponse = {
  spreadsheetId?: unknown;
  tableRange?: unknown;
  updates?: {
    spreadsheetId?: unknown;
    updatedRange?: unknown;
    updatedRows?: unknown;
    updatedColumns?: unknown;
    updatedCells?: unknown;
  };
};

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 20_000;

async function readLimitedBody(
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
        MAX_RESPONSE_BYTES
      ) {
        throw new GoogleSheetsActionError(
          "Google Sheets returned an unexpectedly large response."
        );
      }

      result += decoder.decode(
        chunk.value,
        {
          stream: true,
        }
      );
    }

    result += decoder.decode();

    return result;
  } finally {
    await reader
      .cancel()
      .catch(() => undefined);
  }
}

function parseResponse(
  body: string
): GoogleSheetsAppendResponse {
  try {
    const parsed: unknown =
      JSON.parse(body);

    if (
      typeof parsed !== "object" ||
      parsed === null
    ) {
      throw new Error();
    }

    return (
      parsed as GoogleSheetsAppendResponse
    );
  } catch {
    throw new GoogleSheetsActionError(
      "Google Sheets returned an invalid response."
    );
  }
}

function readProviderError(
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

function readNumber(
  value: unknown
): number | null {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : null;
}

export async function executeGoogleSheetsAction({
  workflowId,
  data,
}: ExecuteGoogleSheetsActionOptions): Promise<
  Record<string, unknown>
> {
  const configuration =
    parseGoogleSheetsActionConfiguration(
      data
    );

  const integration =
    await resolveWorkflowIntegration({
      workflowId,
      integrationId:
        configuration.integrationId,
      provider: "GOOGLE_SHEETS",
    });

  const accessToken =
    integration.credentials.accessToken;

  if (!accessToken) {
    throw new WorkflowIntegrationError(
      "The Google Sheets integration does not contain an access token."
    );
  }

  const query = new URLSearchParams({
    valueInputOption:
      configuration.valueInputOption,
    insertDataOption: "INSERT_ROWS",
    includeValuesInResponse: "false",
  });

  const spreadsheetId =
    encodeURIComponent(
      configuration.spreadsheetId
    );

  const range = encodeURIComponent(
    configuration.range
  );

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?${query.toString()}`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        "Content-Type":
          "application/json",
        Accept: "application/json",
        "User-Agent":
          "Synapse-Workflow/1.0",
      },
      body: JSON.stringify({
        majorDimension: "ROWS",
        values: [
          configuration.values,
        ],
      }),
      redirect: "error",
      signal: AbortSignal.timeout(
        REQUEST_TIMEOUT_MS
      ),
    });
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
      throw new GoogleSheetsActionError(
        "Google Sheets request timed out."
      );
    }

    throw new GoogleSheetsActionError(
      "Google Sheets request failed."
    );
  }

  const responseBody =
    await readLimitedBody(response);

  if (!response.ok) {
    const providerMessage =
      readProviderError(responseBody);

    throw new GoogleSheetsActionError(
      `Google Sheets row append failed (${response.status})${
        providerMessage
          ? `: ${providerMessage}`
          : "."
      }`
    );
  }

  const result =
    parseResponse(responseBody);

  const updatedRange =
    typeof result.updates
      ?.updatedRange === "string"
      ? result.updates.updatedRange
      : null;

  if (!updatedRange) {
    throw new GoogleSheetsActionError(
      "Google Sheets did not return the updated range."
    );
  }

  return {
    success: true,
    provider: "GOOGLE_SHEETS",
    integrationId:
      integration.id,
    integrationName:
      integration.name,
    spreadsheetId:
      typeof result.spreadsheetId ===
      "string"
        ? result.spreadsheetId
        : configuration.spreadsheetId,
    tableRange:
      typeof result.tableRange ===
      "string"
        ? result.tableRange
        : null,
    updatedRange,
    updatedRows: readNumber(
      result.updates?.updatedRows
    ),
    updatedColumns: readNumber(
      result.updates?.updatedColumns
    ),
    updatedCells: readNumber(
      result.updates?.updatedCells
    ),
    message:
      "Google Sheets row appended successfully.",
  };
}