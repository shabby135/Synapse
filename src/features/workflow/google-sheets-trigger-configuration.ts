import type {
  IntegrationTriggerCursor,
} from "@/lib/db/schema/workflow-integration-trigger";

import type {
  WorkflowNodeData,
} from "./types";

export type GoogleSheetsTriggerStartMode =
  | "FROM_NOW"
  | "FROM_BEGINNING";

export type GoogleSheetsTriggerConfiguration = {
  triggerType:
    "GOOGLE_SHEETS_NEW_ROW";
  integrationId: string;
  spreadsheetId: string;
  range: string;
  hasHeader: boolean;
  startMode:
    GoogleSheetsTriggerStartMode;
  pollIntervalMinutes: number;
};

export type GoogleSheetsTriggerCursor = {
  rowCount: number;
};

export type GoogleSheetsCellValue =
  | string
  | number
  | boolean
  | null;

export type GoogleSheetsDetectedEvent = {
  key: string;
  input: Record<string, unknown>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SPREADSHEET_ID_PATTERN =
  /^[A-Za-z0-9_-]{20,256}$/;

const POLL_INTERVALS = new Set([
  1,
  5,
  15,
  30,
  60,
]);

const MAX_EVENTS_PER_POLL = 100;

export class GoogleSheetsTriggerError
  extends Error {
  constructor(message: string) {
    super(message);

    this.name =
      "GoogleSheetsTriggerError";
  }
}

function readText(
  value: unknown
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export function parseGoogleSheetsTriggerConfiguration(
  data: WorkflowNodeData
): GoogleSheetsTriggerConfiguration {
  const configuration =
    data.configuration ?? {};

  if (
    configuration.triggerType !==
    "GOOGLE_SHEETS_NEW_ROW"
  ) {
    throw new GoogleSheetsTriggerError(
      `${data.label} is not a Google Sheets new-row trigger.`
    );
  }

  const integrationId = readText(
    configuration.integrationId
  );

  if (
    !UUID_PATTERN.test(integrationId)
  ) {
    throw new GoogleSheetsTriggerError(
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
    throw new GoogleSheetsTriggerError(
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
    throw new GoogleSheetsTriggerError(
      "Enter a static sheet range of at most 1,024 characters."
    );
  }

  const startMode =
    configuration.startMode ===
    "FROM_BEGINNING"
      ? "FROM_BEGINNING"
      : configuration.startMode ===
          "FROM_NOW"
        ? "FROM_NOW"
        : null;

  if (!startMode) {
    throw new GoogleSheetsTriggerError(
      "Select when the trigger should start reading rows."
    );
  }

  const pollIntervalMinutes =
    configuration.pollIntervalMinutes;

  if (
    typeof pollIntervalMinutes !==
      "number" ||
    !POLL_INTERVALS.has(
      pollIntervalMinutes
    )
  ) {
    throw new GoogleSheetsTriggerError(
      "Select a supported polling interval."
    );
  }

  return {
    triggerType:
      "GOOGLE_SHEETS_NEW_ROW",
    integrationId,
    spreadsheetId,
    range,
    hasHeader:
      configuration.hasHeader ===
      true,
    startMode,
    pollIntervalMinutes,
  };
}

function parseCursor(
  cursor:
    | IntegrationTriggerCursor
    | null
): GoogleSheetsTriggerCursor | null {
  const rowCount =
    cursor?.rowCount;

  if (
    typeof rowCount !== "number" ||
    !Number.isSafeInteger(
      rowCount
    ) ||
    rowCount < 0
  ) {
    return null;
  }

  return { rowCount };
}

function columnName(
  index: number
) {
  let value = index + 1;
  let result = "";

  while (value > 0) {
    value -= 1;

    result =
      String.fromCharCode(
        65 + (value % 26)
      ) + result;

    value = Math.floor(
      value / 26
    );
  }

  return result;
}

function headerKeys(
  header: GoogleSheetsCellValue[]
) {
  const used = new Map<
    string,
    number
  >();

  return header.map(
    (value, index) => {
      const base =
        typeof value === "string" &&
        value.trim()
          ? value.trim()
          : `column_${columnName(index)}`;

      const count =
        used.get(base) ?? 0;

      used.set(
        base,
        count + 1
      );

      return count === 0
        ? base
        : `${base}_${count + 1}`;
    }
  );
}

function rowObject(
  row: GoogleSheetsCellValue[],
  keys: string[]
) {
  return Object.fromEntries(
    row.map(
      (value, index) => [
        keys[index] ??
          `column_${columnName(index)}`,
        value,
      ]
    )
  );
}

function rangeStartRow(
  range: string
) {
  const gridRange =
    range.split("!").at(-1) ??
    range;

  const match =
    /^[A-Za-z]+(\d+)/.exec(
      gridRange
    );

  return match
    ? Number.parseInt(
        match[1],
        10
      )
    : 1;
}

function eventKey({
  spreadsheetId,
  range,
  rowIndex,
  row,
}: {
  spreadsheetId: string;
  range: string;
  rowIndex: number;
  row: GoogleSheetsCellValue[];
}) {
  const bytes =
    new TextEncoder().encode(
      JSON.stringify(row)
    );

  let first = 2_166_136_261;
  let second = 3_332_607_831;

  for (const byte of bytes) {
    first = Math.imul(
      first ^ byte,
      16_777_619
    );

    second = Math.imul(
      second ^ byte,
      2_246_822_519
    );
  }

  const rowFingerprint = [
    first,
    second,
  ]
    .map((value) =>
      (value >>> 0)
        .toString(16)
        .padStart(8, "0")
    )
    .join("");

  return [
    spreadsheetId,
    range,
    rowIndex,
    rowFingerprint,
  ].join(":");
}

export function detectGoogleSheetsNewRows({
  configuration,
  cursor,
  rows,
}: {
  configuration:
    GoogleSheetsTriggerConfiguration;
  cursor:
    | IntegrationTriggerCursor
    | null;
  rows: GoogleSheetsCellValue[][];
}): {
  events:
    GoogleSheetsDetectedEvent[];
  cursor:
    GoogleSheetsTriggerCursor;
} {
  const currentCount =
    rows.length;

  const previous =
    parseCursor(cursor);

  if (!previous) {
    if (
      configuration.startMode ===
      "FROM_NOW"
    ) {
      return {
        events: [],
        cursor: {
          rowCount: currentCount,
        },
      };
    }
  } else if (
    currentCount <
    previous.rowCount
  ) {
    return {
      events: [],
      cursor: {
        rowCount: currentCount,
      },
    };
  }

  const headerOffset =
    configuration.hasHeader
      ? 1
      : 0;

  const firstUnreadIndex =
    Math.max(
      previous?.rowCount ??
        headerOffset,
      headerOffset
    );

  const finalIndex = Math.min(
    currentCount,
    firstUnreadIndex +
      MAX_EVENTS_PER_POLL
  );

  const keys =
    configuration.hasHeader
      ? headerKeys(
          rows[0] ?? []
        )
      : [];

  const firstSheetRow =
    rangeStartRow(
      configuration.range
    );

  const events = rows
    .slice(
      firstUnreadIndex,
      finalIndex
    )
    .map((row, offset) => {
      const rowIndex =
        firstUnreadIndex +
        offset;

      const rowNumber =
        firstSheetRow +
        rowIndex;

      return {
        key: eventKey({
          spreadsheetId:
            configuration
              .spreadsheetId,
          range:
            configuration.range,
          rowIndex,
          row,
        }),

        input: {
          provider:
            "GOOGLE_SHEETS",
          event: "NEW_ROW",

          spreadsheetId:
            configuration
              .spreadsheetId,

          range:
            configuration.range,

          rowNumber,

          values: row,

          data:
            configuration.hasHeader
              ? rowObject(
                  row,
                  keys
                )
              : {},
        },
      };
    });

  return {
    events,
    cursor: {
      rowCount: finalIndex,
    },
  };
}