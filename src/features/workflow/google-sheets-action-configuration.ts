import type {
  WorkflowNodeData,
} from "./types";

export type GoogleSheetsValue =
  | string
  | number
  | boolean
  | null;

export type GoogleSheetsActionConfiguration = {
  actionType:
    "GOOGLE_SHEETS_APPEND_ROW";
  integrationId: string;
  spreadsheetId: string;
  range: string;
  values: GoogleSheetsValue[];
  valueInputOption:
    | "RAW"
    | "USER_ENTERED";
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SPREADSHEET_ID_PATTERN =
  /^[A-Za-z0-9_-]{20,256}$/;

const MAX_VALUES_JSON_LENGTH =
  100_000;

const MAX_COLUMN_COUNT = 1_000;

const MAX_CELL_TEXT_LENGTH =
  50_000;

export class GoogleSheetsActionError
  extends Error {
  constructor(message: string) {
    super(message);

    this.name =
      "GoogleSheetsActionError";
  }
}

function readText(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function parseValues(
  value: unknown
): GoogleSheetsValue[] {
  let parsed: unknown;

  if (
    typeof value !== "string"
  ) {
    throw new GoogleSheetsActionError(
      "Row values must be provided as a JSON array."
    );
  }

  if (
    value.length >
    MAX_VALUES_JSON_LENGTH
  ) {
    throw new GoogleSheetsActionError(
      "Row values cannot exceed 100,000 characters."
    );
  }

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new GoogleSheetsActionError(
      "Row values must be valid JSON."
    );
  }

  if (!Array.isArray(parsed)) {
    throw new GoogleSheetsActionError(
      "Row values must be a JSON array."
    );
  }

  if (parsed.length === 0) {
    throw new GoogleSheetsActionError(
      "Add at least one value to the row."
    );
  }

  if (
    parsed.length >
    MAX_COLUMN_COUNT
  ) {
    throw new GoogleSheetsActionError(
      `A row cannot contain more than ${MAX_COLUMN_COUNT} values.`
    );
  }

  return parsed.map(
    (cell, index) => {
      if (
        cell === null ||
        typeof cell === "boolean"
      ) {
        return cell;
      }

      if (
        typeof cell === "number"
      ) {
        if (!Number.isFinite(cell)) {
          throw new GoogleSheetsActionError(
            `Row value ${index + 1} must be a finite number.`
          );
        }

        return cell;
      }

      if (
        typeof cell === "string"
      ) {
        if (
          cell.length >
          MAX_CELL_TEXT_LENGTH
        ) {
          throw new GoogleSheetsActionError(
            `Row value ${index + 1} cannot exceed ${MAX_CELL_TEXT_LENGTH} characters.`
          );
        }

        return cell;
      }

      throw new GoogleSheetsActionError(
        `Row value ${index + 1} must be text, a number, a boolean, or null.`
      );
    }
  );
}

export function parseGoogleSheetsActionConfiguration(
  data: WorkflowNodeData
): GoogleSheetsActionConfiguration {
  const configuration =
    data.configuration ?? {};

  if (
    configuration.actionType !==
    "GOOGLE_SHEETS_APPEND_ROW"
  ) {
    throw new GoogleSheetsActionError(
      `${data.label} is not a Google Sheets append-row action.`
    );
  }

  const integrationId = readText(
    configuration.integrationId
  );

  if (
    !UUID_PATTERN.test(integrationId)
  ) {
    throw new GoogleSheetsActionError(
      `${data.label} requires a valid Google Sheets integration.`
    );
  }

  const spreadsheetId = readText(
    configuration.spreadsheetId
  );

  if (
    !SPREADSHEET_ID_PATTERN.test(
      spreadsheetId
    ) ||
    spreadsheetId.includes("{{")
  ) {
    throw new GoogleSheetsActionError(
      "Enter a valid static Google Sheets spreadsheet ID."
    );
  }

  const range = readText(
    configuration.range
  );

  if (
    !range ||
    range.length > 1_024 ||
    range.includes("{{")
  ) {
    throw new GoogleSheetsActionError(
      "Enter a static sheet range of at most 1,024 characters."
    );
  }

  const valueInputOption =
    configuration.valueInputOption ===
    "RAW"
      ? "RAW"
      : configuration.valueInputOption ===
          "USER_ENTERED"
        ? "USER_ENTERED"
        : null;

  if (!valueInputOption) {
    throw new GoogleSheetsActionError(
      "Select a valid value input option."
    );
  }

  return {
    actionType:
      "GOOGLE_SHEETS_APPEND_ROW",
    integrationId,
    spreadsheetId,
    range,
    values: parseValues(
      configuration.valuesJson
    ),
    valueInputOption,
  };
}
