import assert from "node:assert/strict";
import test from "node:test";

import {
  detectGoogleSheetsNewRows,
  GoogleSheetsTriggerError,
  parseGoogleSheetsTriggerConfiguration,
} from "../src/features/workflow/google-sheets-trigger-configuration.ts";
import {
  validateWorkflowForPublish,
} from "../src/features/workflow/validate-publish.ts";

const integrationId =
  "550e8400-e29b-41d4-a716-446655440000";

const spreadsheetId =
  "1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890";

function createConfiguration(
  changes = {}
) {
  return {
    triggerType:
      "GOOGLE_SHEETS_NEW_ROW",

    integrationId,

    spreadsheetId,

    range: "Leads!A2:D",

    hasHeader: true,

    startMode: "FROM_NOW",

    pollIntervalMinutes: 1,

    ...changes,
  };
}

test(
  "parses a valid Google Sheets new-row trigger",
  () => {
    const result =
      parseGoogleSheetsTriggerConfiguration(
        {
          label: "New lead",

          configuration:
            createConfiguration(),
        }
      );

    assert.equal(
      result.triggerType,
      "GOOGLE_SHEETS_NEW_ROW"
    );

    assert.equal(
      result.pollIntervalMinutes,
      1
    );
  }
);

test(
  "rejects invalid or dynamic static settings",
  () => {
    assert.throws(
      () =>
        parseGoogleSheetsTriggerConfiguration(
          {
            label: "New lead",

            configuration:
              createConfiguration({
                integrationId:
                  "bad",
              }),
          }
        ),

      GoogleSheetsTriggerError
    );

    assert.throws(
      () =>
        parseGoogleSheetsTriggerConfiguration(
          {
            label: "New lead",

            configuration:
              createConfiguration({
                spreadsheetId:
                  "{{input.sheet}}",
              }),
          }
        ),

      GoogleSheetsTriggerError
    );
  }
);

test(
  "starts from the current row count without replaying old rows",
  () => {
    const result =
      detectGoogleSheetsNewRows({
        configuration:
          createConfiguration(),

        cursor: null,

        rows: [
          [
            "Name",
            "Email",
          ],

          [
            "Existing",
            "old@example.com",
          ],
        ],
      });

    assert.deepEqual(
      result.events,
      []
    );

    assert.deepEqual(
      result.cursor,
      {
        rowCount: 2,
      }
    );
  }
);

test(
  "emits newly appended rows with header-based data",
  () => {
    const configuration =
      createConfiguration();

    const rows = [
      [
        "Name",
        "Email",
        "Score",
      ],

      [
        "Existing",
        "old@example.com",
        4,
      ],

      [
        "Shubham",
        "new@example.com",
        42,
      ],
    ];

    const result =
      detectGoogleSheetsNewRows({
        configuration,

        cursor: {
          rowCount: 2,
        },

        rows,
      });

    assert.equal(
      result.events.length,
      1
    );

    assert.equal(
      result.events[0].input
        .rowNumber,
      4
    );

    assert.deepEqual(
      result.events[0].input
        .values,

      [
        "Shubham",
        "new@example.com",
        42,
      ]
    );

    assert.deepEqual(
      result.events[0].input.data,

      {
        Name: "Shubham",
        Email:
          "new@example.com",
        Score: 42,
      }
    );

    assert.deepEqual(
      result.cursor,

      {
        rowCount: 3,
      }
    );
  }
);

test(
  "can process existing rows while skipping the header",
  () => {
    const result =
      detectGoogleSheetsNewRows({
        configuration:
          createConfiguration({
            startMode:
              "FROM_BEGINNING",
          }),

        cursor: null,

        rows: [
          ["Name"],
          ["First"],
          ["Second"],
        ],
      });

    assert.deepEqual(
      result.events.map(
        (event) =>
          event.input.data
      ),

      [
        {
          Name: "First",
        },

        {
          Name: "Second",
        },
      ]
    );
  }
);

test(
  "uses stable fallback names for empty and duplicate headers",
  () => {
    const result =
      detectGoogleSheetsNewRows({
        configuration:
          createConfiguration({
            startMode:
              "FROM_BEGINNING",
          }),

        cursor: null,

        rows: [
          [
            "Name",
            "",
            "Name",
          ],

          [
            "A",
            "B",
            "C",
          ],
        ],
      });

    assert.deepEqual(
      result.events[0].input.data,

      {
        Name: "A",
        column_B: "B",
        Name_2: "C",
      }
    );
  }
);

test(
  "resets safely when a sheet becomes shorter",
  () => {
    const result =
      detectGoogleSheetsNewRows({
        configuration:
          createConfiguration(),

        cursor: {
          rowCount: 20,
        },

        rows: [
          ["Name"],
          ["Remaining"],
        ],
      });

    assert.deepEqual(
      result.events,
      []
    );

    assert.deepEqual(
      result.cursor,

      {
        rowCount: 2,
      }
    );
  }
);

test(
  "distinguishes replacement rows that reuse a previous position",
  () => {
    const configuration =
      createConfiguration({
        hasHeader: false,

        startMode:
          "FROM_BEGINNING",
      });

    const first =
      detectGoogleSheetsNewRows({
        configuration,

        cursor: null,

        rows: [
          ["Old value"],
        ],
      });

    const replacement =
      detectGoogleSheetsNewRows({
        configuration,

        cursor: null,

        rows: [
          ["New value"],
        ],
      });

    assert.notEqual(
      first.events[0].key,

      replacement.events[0].key
    );
  }
);

test(
  "limits each poll to one hundred events",
  () => {
    const rows = [
      ["Name"],

      ...Array.from(
        {
          length: 120,
        },

        (_, index) => [
          `Row ${index + 1}`,
        ]
      ),
    ];

    const result =
      detectGoogleSheetsNewRows({
        configuration:
          createConfiguration({
            startMode:
              "FROM_BEGINNING",
          }),

        cursor: null,

        rows,
      });

    assert.equal(
      result.events.length,
      100
    );

    assert.equal(
      result.cursor.rowCount,
      101
    );
  }
);

test(
  "validates a published Google Sheets trigger workflow",
  () => {
    const result =
      validateWorkflowForPublish(
        "550e8400-e29b-41d4-a716-446655440001",

        {
          nodes: [
            {
              id: "trigger-1",

              type: "trigger",

              position: {
                x: 0,
                y: 0,
              },

              data: {
                label:
                  "New lead",

                configuration:
                  createConfiguration(),
              },
            },

            {
              id: "action-1",

              type: "action",

              position: {
                x: 200,
                y: 0,
              },

              data: {
                label:
                  "Test action",

                configuration: {
                  actionType:
                    "NO_OP",
                },
              },
            },
          ],

          edges: [
            {
              id: "edge-1",

              source:
                "trigger-1",

              target:
                "action-1",
            },
          ],
        }
      );

    assert.deepEqual(
      result,
      {
        valid: true,
      }
    );
  }
);