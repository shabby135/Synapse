import assert from "node:assert/strict";
import test from "node:test";

import {
  configurationForPublish,
  DataMappingError,
  resolveActionConfiguration,
} from "../src/features/workflow/data-mapping.ts";
import {
  GoogleSheetsActionError,
  parseGoogleSheetsActionConfiguration,
} from "../src/features/workflow/google-sheets-action-configuration.ts";

const integrationId =
  "550e8400-e29b-41d4-a716-446655440000";

const spreadsheetId =
  "1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890";

function createData(
  changes = {}
) {
  return {
    label: "Append spreadsheet row",
    configuration: {
      actionType:
        "GOOGLE_SHEETS_APPEND_ROW",
      integrationId,
      spreadsheetId,
      range: "Sheet1!A:Z",
      valuesJson: JSON.stringify([
        "Shubham",
        "shubham@example.com",
        42,
        true,
      ]),
      valueInputOption:
        "USER_ENTERED",
      ...changes,
    },
  };
}

test(
  "parses a valid Google Sheets append-row action",
  () => {
    const result =
      parseGoogleSheetsActionConfiguration(
        createData()
      );

    assert.equal(
      result.integrationId,
      integrationId
    );

    assert.equal(
      result.spreadsheetId,
      spreadsheetId
    );

    assert.equal(
      result.range,
      "Sheet1!A:Z"
    );

    assert.equal(
      result.valueInputOption,
      "USER_ENTERED"
    );

    assert.deepEqual(
      result.values,
      [
        "Shubham",
        "shubham@example.com",
        42,
        true,
      ]
    );
  }
);

test(
  "preserves supported Google Sheets cell value types",
  () => {
    const result =
      parseGoogleSheetsActionConfiguration(
        createData({
          valuesJson:
            '["text", 12.5, true, false, null]',
        })
      );

    assert.deepEqual(
      result.values,
      [
        "text",
        12.5,
        true,
        false,
        null,
      ]
    );
  }
);

test(
  "rejects an invalid integration ID",
  () => {
    assert.throws(
      () =>
        parseGoogleSheetsActionConfiguration(
          createData({
            integrationId:
              "not-a-uuid",
          })
        ),
      GoogleSheetsActionError
    );
  }
);

test(
  "rejects an invalid spreadsheet ID",
  () => {
    assert.throws(
      () =>
        parseGoogleSheetsActionConfiguration(
          createData({
            spreadsheetId: "invalid",
          })
        ),
      /spreadsheet ID/i
    );
  }
);

test(
  "rejects non-array row values",
  () => {
    assert.throws(
      () =>
        parseGoogleSheetsActionConfiguration(
          createData({
            valuesJson:
              '{"name":"Shubham"}',
          })
        ),
      /JSON array/i
    );
  }
);

test(
  "rejects nested objects and arrays as cell values",
  () => {
    assert.throws(
      () =>
        parseGoogleSheetsActionConfiguration(
          createData({
            valuesJson:
              '["Shubham", {"score":42}]',
          })
        ),
      /must be text, a number, a boolean, or null/i
    );

    assert.throws(
      () =>
        parseGoogleSheetsActionConfiguration(
          createData({
            valuesJson:
              '["Shubham", [42]]',
          })
        ),
      /must be text, a number, a boolean, or null/i
    );
  }
);

test(
  "resolves mapped row values while preserving their types",
  () => {
    const configuration =
      resolveActionConfiguration(
        {
          actionType:
            "GOOGLE_SHEETS_APPEND_ROW",
          integrationId,
          spreadsheetId,
          range: "Sheet1!A:Z",
          valuesJson: JSON.stringify([
            "{{input.name}}",
            "{{input.score}}",
            "{{input.active}}",
          ]),
          valueInputOption:
            "USER_ENTERED",
        },
        {
          trigger: {},
          input: {
            name: "Shubham",
            score: 42,
            active: true,
          },
          nodes: {},
        }
      );

    assert.equal(
      configuration.valuesJson,
      '["Shubham",42,true]'
    );

    const parsed =
      parseGoogleSheetsActionConfiguration(
        {
          label:
            "Append spreadsheet row",
          configuration,
        }
      );

    assert.deepEqual(
      parsed.values,
      [
        "Shubham",
        42,
        true,
      ]
    );
  }
);

test(
  "does not allow mapping static Google Sheets settings",
  () => {
    for (const [
      field,
      value,
    ] of [
      [
        "integrationId",
        "{{input.integrationId}}",
      ],
      [
        "spreadsheetId",
        "{{input.spreadsheetId}}",
      ],
      [
        "range",
        "{{input.range}}",
      ],
      [
        "valueInputOption",
        "{{input.valueInputOption}}",
      ],
    ]) {
      assert.throws(
        () =>
          configurationForPublish(
            {
              actionType:
                "GOOGLE_SHEETS_APPEND_ROW",
              integrationId,
              spreadsheetId,
              range:
                "Sheet1!A:Z",
              valuesJson:
                '["value"]',
              valueInputOption:
                "USER_ENTERED",
              [field]: value,
            },
            new Set()
          ),
        DataMappingError
      );
    }
  }
);

test(
  "validates mapped Google Sheets row values for publishing",
  () => {
    const configuration =
      configurationForPublish(
        {
          actionType:
            "GOOGLE_SHEETS_APPEND_ROW",
          integrationId,
          spreadsheetId,
          range: "Sheet1!A:Z",
          valuesJson: JSON.stringify([
            "{{input.name}}",
            "{{input.score}}",
          ]),
          valueInputOption:
            "USER_ENTERED",
        },
        new Set()
      );

    assert.doesNotThrow(() =>
      parseGoogleSheetsActionConfiguration(
        {
          label:
            "Append spreadsheet row",
          configuration,
        }
      )
    );
  }
);