import assert from "node:assert/strict";
import test from "node:test";

import {
  createGoogleFormsTriggerCursor,
  googleFormsResponseListRequest,
  GoogleFormsTriggerError,
  parseGoogleFormsDefinition,
  parseGoogleFormsResponsePage,
  parseGoogleFormsTriggerConfiguration,
  parseGoogleFormsTriggerCursor,
  processGoogleFormsResponsePage,
} from "../src/features/workflow/google-forms-trigger-configuration.ts";
import {
  validateWorkflowForPublish,
} from "../src/features/workflow/validate-publish.ts";

const integrationId =
  "11111111-1111-4111-8111-111111111111";

const formId =
  "form_1234567890";

const configuration = {
  triggerType:
    "GOOGLE_FORMS_NEW_RESPONSE",
  integrationId,
  formId,
  startMode: "FROM_NOW",
  pollIntervalMinutes: 5,
};

const formDefinition = {
  formId,
  title: "Synapse intake form",
  description:
    "Form used by the workflow trigger.",
  responderUri:
    "https://docs.google.com/forms/d/e/example/viewform",
  questions: [
    {
      questionId:
        "question_name",
      title: "Name",
    },
    {
      questionId:
        "question_color",
      title:
        "Preferences: Favourite colours",
    },
    {
      questionId:
        "question_resume",
      title: "Resume",
    },
  ],
};

function response({
  responseId = "response_001",
  createTime =
    "2026-09-23T12:05:00.000Z",
  lastSubmittedTime = createTime,
} = {}) {
  return {
    formId,
    responseId,
    createTime,
    lastSubmittedTime,
    respondentEmail:
      "person@example.com",
    totalScore: 8,
    answers: {
      question_name: {
        questionId:
          "question_name",
        textAnswers: {
          answers: [
            {
              value: "Shubham",
            },
          ],
        },
      },
      question_color: {
        questionId:
          "question_color",
        textAnswers: {
          answers: [
            {
              value: "Blue",
            },
            {
              value: "Green",
            },
          ],
        },
      },
      question_resume: {
        questionId:
          "question_resume",
        fileUploadAnswers: {
          answers: [
            {
              fileId:
                "file_1234567890",
              fileName:
                "resume.pdf",
              mimeType:
                "application/pdf",
            },
          ],
        },
      },
    },
  };
}

test("parses a valid Google Forms new-response trigger", () => {
  assert.deepEqual(
    parseGoogleFormsTriggerConfiguration(
      {
        label:
          "Google Forms trigger",
        configuration,
      }
    ),
    configuration
  );
});

test("rejects invalid or dynamic Google Forms trigger settings", () => {
  assert.throws(
    () =>
      parseGoogleFormsTriggerConfiguration(
        {
          label:
            "Google Forms trigger",
          configuration: {
            ...configuration,
            integrationId:
              "not-a-uuid",
          },
        }
      ),
    /valid Google Forms integration/
  );

  assert.throws(
    () =>
      parseGoogleFormsTriggerConfiguration(
        {
          label:
            "Google Forms trigger",
          configuration: {
            ...configuration,
            formId:
              "{{trigger.formId}}",
          },
        }
      ),
    /valid static Google Forms form ID/
  );

  assert.throws(
    () =>
      parseGoogleFormsTriggerConfiguration(
        {
          label:
            "Google Forms trigger",
          configuration: {
            ...configuration,
            startMode:
              "INVALID",
          },
        }
      ),
    /Select when the trigger should start/
  );

  assert.throws(
    () =>
      parseGoogleFormsTriggerConfiguration(
        {
          label:
            "Google Forms trigger",
          configuration: {
            ...configuration,
            pollIntervalMinutes: 2,
          },
        }
      ),
    /supported polling interval/
  );
});

test("starts at workflow activation without replaying older responses", () => {
  const activatedAt = new Date(
    "2026-09-23T12:00:00.000Z"
  );

  assert.deepEqual(
    createGoogleFormsTriggerCursor(
      configuration,
      activatedAt
    ),
    {
      phase: "INITIAL",
      checkpointMs:
        activatedAt.getTime(),
    }
  );
});

test("does not miss a response submitted after publishing but before the first poll", () => {
  const activatedAt = new Date(
    "2026-09-23T12:00:00.000Z"
  );

  const cursor =
    createGoogleFormsTriggerCursor(
      configuration,
      activatedAt
    );

  const request =
    googleFormsResponseListRequest({
      cursor,
      now: new Date(
        "2026-09-23T12:10:00.000Z"
      ),
    });

  const detected =
    processGoogleFormsResponsePage({
      responses: [
        response({
          createTime:
            "2026-09-23T12:05:00.000Z",
        }),
      ],
      nextPageToken: null,
      configuration,
      definition:
        formDefinition,
      windowStartMs:
        request.windowStartMs,
      windowEndMs:
        request.windowEndMs,
      page: request.page,
    });

  assert.equal(
    detected.events.length,
    1
  );

  assert.equal(
    detected.events[0]?.key,
    "response_001"
  );

  assert.deepEqual(
    detected.cursor,
    {
      phase: "READY",
      checkpointMs:
        new Date(
          "2026-09-23T12:10:00.000Z"
        ).getTime(),
    }
  );
});

test("can process existing responses from the beginning", () => {
  const fromBeginning = {
    ...configuration,
    startMode: "FROM_BEGINNING",
  };

  assert.deepEqual(
    createGoogleFormsTriggerCursor(
      fromBeginning,
      new Date(
        "2026-09-23T12:00:00.000Z"
      )
    ),
    {
      phase: "INITIAL",
      checkpointMs: 0,
    }
  );
});

test("builds a bounded Google Forms response request", () => {
  const request =
    googleFormsResponseListRequest({
      cursor: {
        phase: "INITIAL",
        checkpointMs:
          new Date(
            "2026-09-23T12:00:00.000Z"
          ).getTime(),
      },
      now: new Date(
        "2026-09-23T12:10:00.000Z"
      ),
    });

  assert.deepEqual(
    request.query,
    {
      filter:
        "timestamp >= 2026-09-23T12:00:00.000Z",
      pageSize: 100,
    }
  );

  assert.equal(request.page, 0);
});

test("keeps a frozen polling window while responses are paginated", () => {
  const windowStartMs =
    new Date(
      "2026-09-23T12:00:00.000Z"
    ).getTime();

  const windowEndMs =
    new Date(
      "2026-09-23T12:10:00.000Z"
    ).getTime();

  const request =
    googleFormsResponseListRequest({
      cursor: {
        phase: "PAGING",
        windowStartMs,
        windowEndMs,
        nextPageToken:
          "next-page-token",
        page: 2,
      },
      now: new Date(
        "2026-09-23T13:00:00.000Z"
      ),
    });

  assert.equal(
    request.windowStartMs,
    windowStartMs
  );

  assert.equal(
    request.windowEndMs,
    windowEndMs
  );

  assert.equal(request.page, 2);

  assert.deepEqual(
    request.query,
    {
      filter:
        "timestamp >= 2026-09-23T12:00:00.000Z",
      pageSize: 100,
      pageToken:
        "next-page-token",
    }
  );
});

test("parses Google Forms metadata and question titles", () => {
  const parsed =
    parseGoogleFormsDefinition(
      JSON.stringify({
        formId,
        info: {
          title:
            "Synapse intake form",
          description:
            "Form used by the workflow trigger.",
        },
        responderUri:
          "https://docs.google.com/forms/d/e/example/viewform",
        items: [
          {
            itemId: "item_name",
            title: "Name",
            questionItem: {
              question: {
                questionId:
                  "question_name",
                textQuestion: {},
              },
            },
          },
          {
            itemId:
              "item_preferences",
            title: "Preferences",
            questionGroupItem: {
              questions: [
                {
                  questionId:
                    "question_color",
                  rowQuestion: {
                    title:
                      "Favourite colours",
                  },
                },
              ],
            },
          },
          {
            itemId:
              "item_resume",
            title: "Resume",
            questionItem: {
              question: {
                questionId:
                  "question_resume",
                fileUploadQuestion: {},
              },
            },
          },
        ],
      }),
      formId
    );

  assert.deepEqual(
    parsed,
    formDefinition
  );
});

test("parses Google Forms response pages", () => {
  assert.deepEqual(
    parseGoogleFormsResponsePage(
      JSON.stringify({
        responses: [
          response(),
        ],
        nextPageToken:
          "next-page-token",
      })
    ),
    {
      responses: [
        response(),
      ],
      nextPageToken:
        "next-page-token",
    }
  );

  assert.deepEqual(
    parseGoogleFormsResponsePage(
      JSON.stringify({})
    ),
    {
      responses: [],
      nextPageToken: null,
    }
  );

  assert.throws(
    () =>
      parseGoogleFormsResponsePage(
        JSON.stringify({
          responses: {},
        })
      ),
    GoogleFormsTriggerError
  );
});

test("accepts a response when Google Forms omits formId", () => {
  const apiResponse = response({
    createTime:
      "2026-09-23T12:05:00.123456789Z",
  });

  delete apiResponse.formId;

  const detected =
    processGoogleFormsResponsePage({
      responses: [apiResponse],
      nextPageToken: null,
      configuration,
      definition:
        formDefinition,
      windowStartMs:
        new Date(
          "2026-09-23T12:00:00.000Z"
        ).getTime(),
      windowEndMs:
        new Date(
          "2026-09-23T12:10:00.000Z"
        ).getTime(),
      page: 0,
    });

  assert.equal(
    detected.events.length,
    1
  );

  assert.equal(
    detected.events[0]?.key,
    "response_001"
  );

  assert.equal(
    detected.events[0]?.input
      .response.createdAt,
    "2026-09-23T12:05:00.123Z"
  );
});

test("maps text, multiple-choice, and file-upload answers", () => {
  const detected =
    processGoogleFormsResponsePage({
      responses: [
        response(),
      ],
      nextPageToken: null,
      configuration,
      definition:
        formDefinition,
      windowStartMs:
        new Date(
          "2026-09-23T12:00:00.000Z"
        ).getTime(),
      windowEndMs:
        new Date(
          "2026-09-23T12:10:00.000Z"
        ).getTime(),
      page: 0,
    });

  assert.equal(
    detected.events.length,
    1
  );

  assert.deepEqual(
    detected.events[0]?.input,
    {
      provider: "GOOGLE_FORMS",
      event: "NEW_RESPONSE",
      form: {
        id: formId,
        title:
          "Synapse intake form",
        description:
          "Form used by the workflow trigger.",
        responderUri:
          "https://docs.google.com/forms/d/e/example/viewform",
      },
      response: {
        id: "response_001",
        createdAt:
          "2026-09-23T12:05:00.000Z",
        submittedAt:
          "2026-09-23T12:05:00.000Z",
        respondentEmail:
          "person@example.com",
        totalScore: 8,
        answers: [
          {
            questionId:
              "question_name",
            title: "Name",
            values: ["Shubham"],
            files: [],
          },
          {
            questionId:
              "question_color",
            title:
              "Preferences: Favourite colours",
            values: [
              "Blue",
              "Green",
            ],
            files: [],
          },
          {
            questionId:
              "question_resume",
            title: "Resume",
            values: [],
            files: [
              {
                fileId:
                  "file_1234567890",
                fileName:
                  "resume.pdf",
                mimeType:
                  "application/pdf",
              },
            ],
          },
        ],
        answersByQuestionId: {
          question_name: {
            title: "Name",
            values: ["Shubham"],
            files: [],
          },
          question_color: {
            title:
              "Preferences: Favourite colours",
            values: [
              "Blue",
              "Green",
            ],
            files: [],
          },
          question_resume: {
            title: "Resume",
            values: [],
            files: [
              {
                fileId:
                  "file_1234567890",
                fileName:
                  "resume.pdf",
                mimeType:
                  "application/pdf",
              },
            ],
          },
        },
        answersByTitle: {
          Name: [
            {
              questionId:
                "question_name",
              values: ["Shubham"],
              files: [],
            },
          ],
          "Preferences: Favourite colours":
            [
              {
                questionId:
                  "question_color",
                values: [
                  "Blue",
                  "Green",
                ],
                files: [],
              },
            ],
          Resume: [
            {
              questionId:
                "question_resume",
              values: [],
              files: [
                {
                  fileId:
                    "file_1234567890",
                  fileName:
                    "resume.pdf",
                  mimeType:
                    "application/pdf",
                },
              ],
            },
          ],
        },
      },
    }
  );
});

test("filters responses outside the frozen polling window", () => {
  const detected =
    processGoogleFormsResponsePage({
      responses: [
        response({
          responseId:
            "response_before",
          createTime:
            "2026-09-23T11:59:59.000Z",
        }),
        response({
          responseId:
            "response_inside",
          createTime:
            "2026-09-23T12:05:00.000Z",
        }),
        response({
          responseId:
            "response_after",
          createTime:
            "2026-09-23T12:10:01.000Z",
        }),
      ],
      nextPageToken: null,
      configuration,
      definition:
        formDefinition,
      windowStartMs:
        new Date(
          "2026-09-23T12:00:00.000Z"
        ).getTime(),
      windowEndMs:
        new Date(
          "2026-09-23T12:10:00.000Z"
        ).getTime(),
      page: 0,
    });

  assert.deepEqual(
    detected.events.map(
      (event) => event.key
    ),
    ["response_inside"]
  );
});

test("continues pagination before advancing the response checkpoint", () => {
  const windowStartMs =
    new Date(
      "2026-09-23T12:00:00.000Z"
    ).getTime();

  const windowEndMs =
    new Date(
      "2026-09-23T12:10:00.000Z"
    ).getTime();

  const firstPage =
    processGoogleFormsResponsePage({
      responses: [
        response(),
      ],
      nextPageToken:
        "next-page-token",
      configuration,
      definition:
        formDefinition,
      windowStartMs,
      windowEndMs,
      page: 0,
    });

  assert.deepEqual(
    firstPage.cursor,
    {
      phase: "PAGING",
      windowStartMs,
      windowEndMs,
      nextPageToken:
        "next-page-token",
      page: 1,
    }
  );

  const finalPage =
    processGoogleFormsResponsePage({
      responses: [],
      nextPageToken: null,
      configuration,
      definition:
        formDefinition,
      windowStartMs,
      windowEndMs,
      page: 1,
    });

  assert.deepEqual(
    finalPage.cursor,
    {
      phase: "READY",
      checkpointMs:
        windowEndMs,
    }
  );
});

test("overlaps completed polling windows for delayed responses", () => {
  const checkpointMs =
    new Date(
      "2026-09-23T12:10:00.000Z"
    ).getTime();

  const request =
    googleFormsResponseListRequest({
      cursor: {
        phase: "READY",
        checkpointMs,
      },
      now: new Date(
        "2026-09-23T12:20:00.000Z"
      ),
    });

  assert.equal(
    request.windowStartMs,
    new Date(
      "2026-09-23T12:05:00.000Z"
    ).getTime()
  );

  assert.equal(
    request.windowEndMs,
    new Date(
      "2026-09-23T12:20:00.000Z"
    ).getTime()
  );
});

test("rejects malformed cursors and answer payloads", () => {
  assert.equal(
    parseGoogleFormsTriggerCursor({
      phase: "PAGING",
      windowStartMs: 100,
      windowEndMs: 50,
      nextPageToken:
        "next-page-token",
      page: 1,
    }),
    null
  );

  assert.throws(
    () =>
      processGoogleFormsResponsePage({
        responses: [
          {
            ...response(),
            answers: {
              question_name: {
                questionId:
                  "different_question",
                textAnswers: {
                  answers: [
                    {
                      value:
                        "Shubham",
                    },
                  ],
                },
              },
            },
          },
        ],
        nextPageToken: null,
        configuration,
        definition:
          formDefinition,
        windowStartMs:
          new Date(
            "2026-09-23T12:00:00.000Z"
          ).getTime(),
        windowEndMs:
          new Date(
            "2026-09-23T12:10:00.000Z"
          ).getTime(),
        page: 0,
      }),
    /invalid question ID/
  );
});

test(
  "validates a published Google Forms trigger workflow",
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
                  "Google Forms New Response",
                configuration,
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
                label: "Test action",
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
              source: "trigger-1",
              target: "action-1",
            },
          ],
        }
      );

    assert.deepEqual(result, {
      valid: true,
    });
  }
);