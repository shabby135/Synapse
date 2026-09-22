import "server-only";

import {
  resolveWorkflowIntegration,
  WorkflowIntegrationError,
} from "@/features/integration/resolve-workflow-integration";

import {
  detectGoogleSheetsNewRows,
  type GoogleSheetsCellValue,
  GoogleSheetsTriggerError,
  parseGoogleSheetsTriggerConfiguration,
} from "./google-sheets-trigger-configuration";
import type {
  IntegrationTriggerHandler,
} from "./integration-trigger-registry";

const REQUEST_TIMEOUT_MS =
  15_000;

const MAX_RESPONSE_BYTES =
  2_000_000;

type SheetsValuesResponse = {
  values?: unknown;
};

async function readLimitedBody(
  response: Response
) {
  if (!response.body) {
    return "";
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder();

  let received = 0;
  let result = "";

  try {
    while (true) {
      const chunk =
        await reader.read();

      if (chunk.done) {
        break;
      }

      received +=
        chunk.value.byteLength;

      if (
        received >
        MAX_RESPONSE_BYTES
      ) {
        throw new GoogleSheetsTriggerError(
          "Google Sheets returned too much row data. Use a smaller range."
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
      result +
      decoder.decode()
    );
  } finally {
    await reader
      .cancel()
      .catch(() => undefined);
  }
}

function providerError(
  body: string
) {
  try {
    const parsed =
      JSON.parse(body) as {
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

function parseRows(
  body: string
): GoogleSheetsCellValue[][] {
  let parsed:
    SheetsValuesResponse;

  try {
    parsed = JSON.parse(
      body
    ) as SheetsValuesResponse;
  } catch {
    throw new GoogleSheetsTriggerError(
      "Google Sheets returned an invalid response."
    );
  }

  if (
    parsed.values === undefined
  ) {
    return [];
  }

  if (
    !Array.isArray(
      parsed.values
    )
  ) {
    throw new GoogleSheetsTriggerError(
      "Google Sheets returned invalid row data."
    );
  }

  return parsed.values.map(
    (row, rowIndex) => {
      if (!Array.isArray(row)) {
        throw new GoogleSheetsTriggerError(
          `Google Sheets row ${rowIndex + 1} is invalid.`
        );
      }

      return row.map((cell) => {
        if (
          cell === null ||
          typeof cell ===
            "string" ||
          typeof cell ===
            "boolean"
        ) {
          return cell;
        }

        if (
          typeof cell ===
            "number" &&
          Number.isFinite(cell)
        ) {
          return cell;
        }

        throw new GoogleSheetsTriggerError(
          "Google Sheets returned an unsupported cell value."
        );
      });
    }
  );
}

export const googleSheetsTriggerHandler: IntegrationTriggerHandler =
  {
    type:
      "GOOGLE_SHEETS_NEW_ROW",

    provider: "GOOGLE_SHEETS",

    async poll({
      workflowId,
      configuration,
      cursor,
    }) {
      const parsedConfiguration =
        parseGoogleSheetsTriggerConfiguration(
          {
            label:
              "Google Sheets trigger",
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

            provider:
              "GOOGLE_SHEETS",
          }
        );

      const accessToken =
        integration.credentials
          .accessToken;

      if (!accessToken) {
        throw new WorkflowIntegrationError(
          "The Google Sheets integration does not contain an access token."
        );
      }

      const query =
        new URLSearchParams({
          majorDimension: "ROWS",

          valueRenderOption:
            "UNFORMATTED_VALUE",

          dateTimeRenderOption:
            "FORMATTED_STRING",
        });

      const url =
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
          parsedConfiguration
            .spreadsheetId
        )}/values/${encodeURIComponent(
          parsedConfiguration.range
        )}?${query.toString()}`;

      let response: Response;

      try {
        response = await fetch(
          url,
          {
            method: "GET",

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
      } catch (error) {
        if (
          error instanceof
            Error &&
          (error.name ===
            "TimeoutError" ||
            error.name ===
              "AbortError")
        ) {
          throw new GoogleSheetsTriggerError(
            "Google Sheets trigger polling timed out."
          );
        }

        throw new GoogleSheetsTriggerError(
          "Google Sheets trigger polling failed."
        );
      }

      const body =
        await readLimitedBody(
          response
        );

      if (!response.ok) {
        const detail =
          providerError(body);

        throw new GoogleSheetsTriggerError(
          `Google Sheets trigger polling failed (${response.status})${
            detail
              ? `: ${detail}`
              : "."
          }`
        );
      }

      const detected =
        detectGoogleSheetsNewRows({
          configuration:
            parsedConfiguration,

          cursor,

          rows: parseRows(body),
        });

      return {
        ...detected,

        pollIntervalMinutes:
          parsedConfiguration
            .pollIntervalMinutes,
      };
    },
  };