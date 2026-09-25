import type { IntegrationTriggerCursor } from "@/lib/db/schema/workflow-integration-trigger";

import type { WorkflowNodeData } from "./types";

export type GoogleFormsTriggerStartMode =
  | "FROM_NOW"
  | "FROM_BEGINNING";

export type GoogleFormsTriggerConfiguration = {
  triggerType: "GOOGLE_FORMS_NEW_RESPONSE";
  integrationId: string;
  formId: string;
  startMode: GoogleFormsTriggerStartMode;
  pollIntervalMinutes: number;
};

export type GoogleFormsTriggerCursor =
  | {
      phase: "INITIAL" | "READY";
      checkpointMs: number;
    }
  | {
      phase: "PAGING";
      windowStartMs: number;
      windowEndMs: number;
      nextPageToken: string;
      page: number;
    };

export type GoogleFormsApiResponse = {
  formId?: unknown;
  responseId?: unknown;
  createTime?: unknown;
  lastSubmittedTime?: unknown;
  respondentEmail?: unknown;
  answers?: unknown;
  totalScore?: unknown;
};

export type GoogleFormsResponsePage = {
  responses: GoogleFormsApiResponse[];
  nextPageToken: string | null;
};

export type GoogleFormsQuestion = {
  questionId: string;
  title: string;
};

export type GoogleFormsDefinition = {
  formId: string;
  title: string;
  description: string;
  responderUri: string;
  questions: GoogleFormsQuestion[];
};

export type GoogleFormsFileAnswer = {
  fileId: string;
  fileName: string;
  mimeType: string;
};

export type GoogleFormsMappedAnswer = {
  questionId: string;
  title: string;
  values: string[];
  files: GoogleFormsFileAnswer[];
};

export type GoogleFormsDetectedEvent = {
  key: string;
  input: Record<string, unknown>;
};

export type GoogleFormsResponseListWindow = {
  query: {
    filter: string;
    pageSize: number;
    pageToken?: string;
  };
  windowStartMs: number;
  windowEndMs: number;
  page: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FORM_ID_PATTERN =
  /^[A-Za-z0-9_-]{10,256}$/;

const RFC3339_TIMESTAMP_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

const POLL_INTERVALS = new Set([
  1,
  5,
  15,
  30,
  60,
]);

const MAX_RESPONSES_PER_PAGE = 100;
const MAX_PAGE = 1_000;
const MAX_PAGE_TOKEN_LENGTH = 2_048;
const MAX_QUESTIONS = 1_000;
const MAX_ANSWERS = 1_000;
const MAX_VALUES_PER_ANSWER = 1_000;
const MAX_FILES_PER_ANSWER = 100;
const MAX_ANSWER_VALUE_LENGTH =
  100_000;
const POLL_OVERLAP_MS = 5 * 60_000;

export class GoogleFormsTriggerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleFormsTriggerError";
  }
}

function record(
  value: unknown
): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<
        string,
        unknown
      >)
    : null;
}

function readText(
  value: unknown,
  maximumLength = 2_000
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .slice(0, maximumLength);
}

function readAnswerValue(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||
    value.length >
      MAX_ANSWER_VALUE_LENGTH
  ) {
    return null;
  }

  return value;
}

function validEpochMilliseconds(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function nonNegativeInteger(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function validNextPageToken(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <=
      MAX_PAGE_TOKEN_LENGTH &&
    !/[\u0000-\u001f\u007f]/u.test(
      value
    )
  );
}

function opaqueId(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = value.trim();

  if (
    !parsed ||
    parsed.length > 512 ||
    /[\u0000-\u001f\u007f]/u.test(
      parsed
    )
  ) {
    return null;
  }

  return parsed;
}

function timestampMilliseconds(
  value: unknown
): number | null {
  if (
    typeof value !== "string" ||
    value.length > 128
  ) {
    return null;
  }

  const match =
    RFC3339_TIMESTAMP_PATTERN.exec(
      value.trim()
    );

  if (!match) {
    return null;
  }

  const dateTime = match[1];
  const fractionalSeconds = match[2];
  const timezone = match[3];

  if (!dateTime || !timezone) {
    return null;
  }

  const milliseconds =
    fractionalSeconds
      ? fractionalSeconds
          .padEnd(3, "0")
          .slice(0, 3)
      : "";

  const normalized =
    `${dateTime}${
      milliseconds
        ? `.${milliseconds}`
        : ""
    }${timezone}`;

  const parsed = Date.parse(normalized);

  return Number.isFinite(parsed) &&
    parsed >= 0
    ? parsed
    : null;
}

function parseJson(
  body: string,
  message: string
): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    throw new GoogleFormsTriggerError(
      "Google Forms returned invalid JSON."
    );
  }

  const source = record(parsed);

  if (!source) {
    throw new GoogleFormsTriggerError(
      message
    );
  }

  return source;
}

function questionTitle({
  itemTitle,
  rowTitle,
  questionId,
}: {
  itemTitle: string;
  rowTitle: string;
  questionId: string;
}): string {
  if (itemTitle && rowTitle) {
    return `${itemTitle}: ${rowTitle}`.slice(
      0,
      5_000
    );
  }

  return (
    itemTitle ||
    rowTitle ||
    `Question ${questionId}`
  );
}

function readQuestion(
  value: unknown,
  title: string
): GoogleFormsQuestion | null {
  const question = record(value);
  const questionId = opaqueId(
    question?.questionId
  );

  if (!questionId) {
    return null;
  }

  const rowQuestion = record(
    question?.rowQuestion
  );

  return {
    questionId,
    title: questionTitle({
      itemTitle: title,
      rowTitle: readText(
        rowQuestion?.title,
        5_000
      ),
      questionId,
    }),
  };
}

function extractQuestions(
  items: unknown
): GoogleFormsQuestion[] {
  if (items === undefined) {
    return [];
  }

  if (!Array.isArray(items)) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned invalid form items."
    );
  }

  const questions: GoogleFormsQuestion[] =
    [];
  const seen = new Set<string>();

  function addQuestion(
    question: GoogleFormsQuestion | null
  ) {
    if (!question) {
      return;
    }

    if (seen.has(question.questionId)) {
      throw new GoogleFormsTriggerError(
        "Google Forms returned duplicate question IDs."
      );
    }

    seen.add(question.questionId);
    questions.push(question);

    if (
      questions.length > MAX_QUESTIONS
    ) {
      throw new GoogleFormsTriggerError(
        "Google Forms returned too many questions."
      );
    }
  }

  for (const itemValue of items) {
    const item = record(itemValue);

    if (!item) {
      throw new GoogleFormsTriggerError(
        "Google Forms returned a malformed form item."
      );
    }

    const title = readText(
      item.title,
      5_000
    );

    const questionItem = record(
      item.questionItem
    );

    if (questionItem) {
      addQuestion(
        readQuestion(
          questionItem.question,
          title
        )
      );
    }

    const questionGroupItem = record(
      item.questionGroupItem
    );

    if (
      questionGroupItem?.questions !==
      undefined
    ) {
      if (
        !Array.isArray(
          questionGroupItem.questions
        )
      ) {
        throw new GoogleFormsTriggerError(
          "Google Forms returned a malformed question group."
        );
      }

      for (
        const question of
        questionGroupItem.questions
      ) {
        addQuestion(
          readQuestion(
            question,
            title
          )
        );
      }
    }
  }

  return questions;
}

export function parseGoogleFormsTriggerConfiguration(
  data: WorkflowNodeData
): GoogleFormsTriggerConfiguration {
  const configuration =
    data.configuration ?? {};

  if (
    configuration.triggerType !==
    "GOOGLE_FORMS_NEW_RESPONSE"
  ) {
    throw new GoogleFormsTriggerError(
      `${data.label} is not a Google Forms new-response trigger.`
    );
  }

  const integrationId = readText(
    configuration.integrationId,
    64
  );

  if (
    !UUID_PATTERN.test(integrationId)
  ) {
    throw new GoogleFormsTriggerError(
      `${data.label} requires a valid Google Forms integration.`
    );
  }

  const formId = readText(
    configuration.formId,
    256
  );

  if (
    formId.includes("{{") ||
    !FORM_ID_PATTERN.test(formId)
  ) {
    throw new GoogleFormsTriggerError(
      "Enter a valid static Google Forms form ID."
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
    throw new GoogleFormsTriggerError(
      "Select when the trigger should start reading responses."
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
    throw new GoogleFormsTriggerError(
      "Select a supported polling interval."
    );
  }

  return {
    triggerType:
      "GOOGLE_FORMS_NEW_RESPONSE",
    integrationId,
    formId,
    startMode,
    pollIntervalMinutes,
  };
}

export function createGoogleFormsTriggerCursor(
  configuration: GoogleFormsTriggerConfiguration,
  activatedAt: Date
): GoogleFormsTriggerCursor {
  const activatedAtMs =
    activatedAt.getTime();

  if (
    !Number.isSafeInteger(
      activatedAtMs
    ) ||
    activatedAtMs < 0
  ) {
    throw new GoogleFormsTriggerError(
      "The workflow activation time is invalid."
    );
  }

  return {
    phase: "INITIAL",
    checkpointMs:
      configuration.startMode ===
      "FROM_BEGINNING"
        ? 0
        : activatedAtMs,
  };
}

export function parseGoogleFormsTriggerCursor(
  cursor: IntegrationTriggerCursor | null
): GoogleFormsTriggerCursor | null {
  if (!cursor) {
    return null;
  }

  if (
    cursor.phase === "INITIAL" ||
    cursor.phase === "READY"
  ) {
    return validEpochMilliseconds(
      cursor.checkpointMs
    )
      ? {
          phase: cursor.phase,
          checkpointMs:
            cursor.checkpointMs,
        }
      : null;
  }

  if (cursor.phase !== "PAGING") {
    return null;
  }

  if (
    !validEpochMilliseconds(
      cursor.windowStartMs
    ) ||
    !validEpochMilliseconds(
      cursor.windowEndMs
    ) ||
    cursor.windowEndMs <
      cursor.windowStartMs ||
    !validNextPageToken(
      cursor.nextPageToken
    ) ||
    !nonNegativeInteger(
      cursor.page
    ) ||
    cursor.page > MAX_PAGE
  ) {
    return null;
  }

  return {
    phase: "PAGING",
    windowStartMs:
      cursor.windowStartMs,
    windowEndMs:
      cursor.windowEndMs,
    nextPageToken:
      cursor.nextPageToken,
    page: cursor.page,
  };
}

export function googleFormsResponseListRequest({
  cursor,
  now,
}: {
  cursor: GoogleFormsTriggerCursor;
  now: Date;
}): GoogleFormsResponseListWindow {
  const nowMs = now.getTime();

  if (
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0
  ) {
    throw new GoogleFormsTriggerError(
      "The Google Forms polling time is invalid."
    );
  }

  const windowStartMs =
    cursor.phase === "PAGING"
      ? cursor.windowStartMs
      : cursor.phase === "INITIAL"
        ? cursor.checkpointMs
        : Math.max(
            0,
            cursor.checkpointMs -
              POLL_OVERLAP_MS
          );

  const windowEndMs =
    cursor.phase === "PAGING"
      ? cursor.windowEndMs
      : Math.max(
          nowMs,
          windowStartMs
        );

  const page =
    cursor.phase === "PAGING"
      ? cursor.page
      : 0;

  const query: GoogleFormsResponseListWindow["query"] =
    {
      filter: `timestamp >= ${new Date(
        windowStartMs
      ).toISOString()}`,
      pageSize:
        MAX_RESPONSES_PER_PAGE,
    };

  if (cursor.phase === "PAGING") {
    query.pageToken =
      cursor.nextPageToken;
  }

  return {
    query,
    windowStartMs,
    windowEndMs,
    page,
  };
}

export function parseGoogleFormsDefinition(
  body: string,
  expectedFormId: string
): GoogleFormsDefinition {
  const source = parseJson(
    body,
    "Google Forms returned an invalid form definition."
  );

  const formId = opaqueId(
    source.formId
  );

  if (
    !formId ||
    formId !== expectedFormId
  ) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned an unexpected form definition."
    );
  }

  const info = record(source.info);

  if (!info) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned invalid form information."
    );
  }

  return {
    formId,
    title:
      readText(info.title, 5_000) ||
      "Untitled form",
    description: readText(
      info.description,
      20_000
    ),
    responderUri: readText(
      source.responderUri,
      2_048
    ),
    questions: extractQuestions(
      source.items
    ),
  };
}

export function parseGoogleFormsResponsePage(
  body: string
): GoogleFormsResponsePage {
  const source = parseJson(
    body,
    "Google Forms returned an invalid response list."
  );

  const responseValues =
    source.responses ?? [];

  if (!Array.isArray(responseValues)) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned invalid response data."
    );
  }

  if (
    responseValues.length >
    MAX_RESPONSES_PER_PAGE
  ) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned too many responses."
    );
  }

  const responses =
    responseValues.filter(
      (
        response
      ): response is GoogleFormsApiResponse =>
        response !== null &&
        typeof response === "object" &&
        !Array.isArray(response)
    );

  if (
    responses.length !==
    responseValues.length
  ) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned a malformed response."
    );
  }

  let nextPageToken: string | null =
    null;

  if (
    source.nextPageToken !==
      undefined &&
    source.nextPageToken !== null &&
    source.nextPageToken !== ""
  ) {
    if (
      !validNextPageToken(
        source.nextPageToken
      )
    ) {
      throw new GoogleFormsTriggerError(
        "Google Forms returned an invalid pagination token."
      );
    }

    nextPageToken =
      source.nextPageToken;
  }

  return {
    responses,
    nextPageToken,
  };
}

function parseFileAnswers(
  value: unknown
): GoogleFormsFileAnswer[] {
  const fileUploadAnswers =
    record(value);

  if (
    !fileUploadAnswers ||
    !Array.isArray(
      fileUploadAnswers.answers
    )
  ) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned malformed file-upload answers."
    );
  }

  if (
    fileUploadAnswers.answers.length >
    MAX_FILES_PER_ANSWER
  ) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned too many uploaded files for one answer."
    );
  }

  return fileUploadAnswers.answers.map(
    (fileValue) => {
      const file = record(fileValue);
      const fileId = opaqueId(
        file?.fileId
      );

      if (!file || !fileId) {
        throw new GoogleFormsTriggerError(
          "Google Forms returned a malformed uploaded file."
        );
      }

      return {
        fileId,
        fileName: readText(
          file.fileName,
          5_000
        ),
        mimeType: readText(
          file.mimeType,
          500
        ),
      };
    }
  );
}

function parseTextAnswers(
  value: unknown
): string[] {
  const textAnswers = record(value);

  if (
    !textAnswers ||
    !Array.isArray(
      textAnswers.answers
    )
  ) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned malformed text answers."
    );
  }

  if (
    textAnswers.answers.length >
    MAX_VALUES_PER_ANSWER
  ) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned too many values for one answer."
    );
  }

  return textAnswers.answers.map(
    (answerValue) => {
      const answer =
        record(answerValue);
      const value = readAnswerValue(
        answer?.value
      );

      if (
        !answer ||
        value === null
      ) {
        throw new GoogleFormsTriggerError(
          "Google Forms returned a malformed text answer."
        );
      }

      return value;
    }
  );
}

function mapAnswers(
  value: unknown,
  questions: GoogleFormsQuestion[]
): GoogleFormsMappedAnswer[] {
  if (value === undefined) {
    return [];
  }

  const answers = record(value);

  if (!answers) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned malformed answers."
    );
  }

  const entries =
    Object.entries(answers);

  if (
    entries.length > MAX_ANSWERS
  ) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned too many answers."
    );
  }

  const questionTitles = new Map(
    questions.map((question) => [
      question.questionId,
      question.title,
    ])
  );

  const questionPositions = new Map(
    questions.map(
      (question, index) => [
        question.questionId,
        index,
      ]
    )
  );

  const mapped = entries.map(
    ([answerKey, answerValue]) => {
      const answer =
        record(answerValue);

      if (!answer) {
        throw new GoogleFormsTriggerError(
          "Google Forms returned a malformed answer."
        );
      }

      const keyQuestionId =
        opaqueId(answerKey);
      const answerQuestionId =
        opaqueId(
          answer.questionId
        );

      if (
        !keyQuestionId ||
        !answerQuestionId ||
        keyQuestionId !==
          answerQuestionId
      ) {
        throw new GoogleFormsTriggerError(
          "Google Forms returned an answer with an invalid question ID."
        );
      }

      const hasTextAnswers =
        answer.textAnswers !==
        undefined;
      const hasFileAnswers =
        answer.fileUploadAnswers !==
        undefined;

      if (
        hasTextAnswers ===
        hasFileAnswers
      ) {
        throw new GoogleFormsTriggerError(
          "Google Forms returned an answer with an invalid value."
        );
      }

      return {
        questionId:
          answerQuestionId,
        title:
          questionTitles.get(
            answerQuestionId
          ) ??
          `Question ${answerQuestionId}`,
        values: hasTextAnswers
          ? parseTextAnswers(
              answer.textAnswers
            )
          : [],
        files: hasFileAnswers
          ? parseFileAnswers(
              answer.fileUploadAnswers
            )
          : [],
      };
    }
  );

  mapped.sort((left, right) => {
    const leftPosition =
      questionPositions.get(
        left.questionId
      ) ??
      Number.MAX_SAFE_INTEGER;
    const rightPosition =
      questionPositions.get(
        right.questionId
      ) ??
      Number.MAX_SAFE_INTEGER;

    if (
      leftPosition !==
      rightPosition
    ) {
      return (
        leftPosition -
        rightPosition
      );
    }

    return left.questionId.localeCompare(
      right.questionId
    );
  });

  return mapped;
}

function detectedResponse({
  response,
  configuration,
  definition,
  windowStartMs,
  windowEndMs,
}: {
  response: GoogleFormsApiResponse;
  configuration: GoogleFormsTriggerConfiguration;
  definition: GoogleFormsDefinition;
  windowStartMs: number;
  windowEndMs: number;
}): {
  event: GoogleFormsDetectedEvent;
  createdMs: number;
} | null {
  const responseId = opaqueId(
    response.responseId
  );

  const createdMs =
    timestampMilliseconds(
      response.createTime
    );

  if (!responseId) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned a response with an invalid response ID."
    );
  }

  if (
    response.formId !== undefined
  ) {
    const responseFormId =
      opaqueId(response.formId);

    if (!responseFormId) {
      throw new GoogleFormsTriggerError(
        "Google Forms returned a response with an invalid form ID."
      );
    }

    if (
      responseFormId !==
      configuration.formId
    ) {
      throw new GoogleFormsTriggerError(
        "Google Forms returned a response for a different form."
      );
    }
  }

  if (createdMs === null) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned a response with an invalid creation timestamp."
    );
  }

  if (
    createdMs < windowStartMs ||
    createdMs > windowEndMs
  ) {
    return null;
  }

  const submittedMs =
    timestampMilliseconds(
      response.lastSubmittedTime
    );

  if (
    response.lastSubmittedTime !==
      undefined &&
    submittedMs === null
  ) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned an invalid submission timestamp."
    );
  }

  const mappedAnswers = mapAnswers(
    response.answers,
    definition.questions
  );

  const answersByQuestionId =
    Object.fromEntries(
      mappedAnswers.map((answer) => [
        answer.questionId,
        {
          title: answer.title,
          values: answer.values,
          files: answer.files,
        },
      ])
    );

  const answersByTitleMap =
    new Map<
      string,
      Array<{
        questionId: string;
        values: string[];
        files: GoogleFormsFileAnswer[];
      }>
    >();

  for (
    const answer of mappedAnswers
  ) {
    const existing =
      answersByTitleMap.get(
        answer.title
      ) ?? [];

    existing.push({
      questionId:
        answer.questionId,
      values: answer.values,
      files: answer.files,
    });

    answersByTitleMap.set(
      answer.title,
      existing
    );
  }

  const totalScore =
    response.totalScore === undefined
      ? null
      : typeof response.totalScore ===
            "number" &&
          Number.isFinite(
            response.totalScore
          )
        ? response.totalScore
        : null;

  if (
    response.totalScore !==
      undefined &&
    totalScore === null
  ) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned an invalid response score."
    );
  }

  return {
    createdMs,
    event: {
      key: responseId,
      input: {
        provider:
          "GOOGLE_FORMS",
        event: "NEW_RESPONSE",
        form: {
          id: definition.formId,
          title: definition.title,
          description:
            definition.description,
          responderUri:
            definition.responderUri,
        },
        response: {
          id: responseId,
          createdAt: new Date(
            createdMs
          ).toISOString(),
          submittedAt: new Date(
            submittedMs ?? createdMs
          ).toISOString(),
          respondentEmail:
            readText(
              response.respondentEmail,
              320
            ) || null,
          totalScore,
          answers: mappedAnswers,
          answersByQuestionId,
          answersByTitle:
            Object.fromEntries(
              answersByTitleMap
            ),
        },
      },
    },
  };
}

export function processGoogleFormsResponsePage({
  responses,
  nextPageToken,
  configuration,
  definition,
  windowStartMs,
  windowEndMs,
  page,
}: {
  responses: GoogleFormsApiResponse[];
  nextPageToken: string | null;
  configuration: GoogleFormsTriggerConfiguration;
  definition: GoogleFormsDefinition;
  windowStartMs: number;
  windowEndMs: number;
  page: number;
}): {
  events: GoogleFormsDetectedEvent[];
  cursor: GoogleFormsTriggerCursor;
} {
  if (
    !validEpochMilliseconds(
      windowStartMs
    ) ||
    !validEpochMilliseconds(
      windowEndMs
    ) ||
    windowEndMs < windowStartMs
  ) {
    throw new GoogleFormsTriggerError(
      "The Google Forms polling window is invalid."
    );
  }

  if (
    definition.formId !==
    configuration.formId
  ) {
    throw new GoogleFormsTriggerError(
      "The Google Forms definition does not match the configured form."
    );
  }

  if (
    !nonNegativeInteger(page) ||
    page > MAX_PAGE
  ) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned an invalid response page."
    );
  }

  if (
    responses.length >
    MAX_RESPONSES_PER_PAGE
  ) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned too many responses."
    );
  }

  if (
    nextPageToken !== null &&
    !validNextPageToken(
      nextPageToken
    )
  ) {
    throw new GoogleFormsTriggerError(
      "Google Forms returned an invalid pagination token."
    );
  }

  const detected = responses
    .map((response) =>
      detectedResponse({
        response,
        configuration,
        definition,
        windowStartMs,
        windowEndMs,
      })
    )
    .filter(
      (
        value
      ): value is NonNullable<
        typeof value
      > => value !== null
    )
    .sort(
      (left, right) =>
        left.createdMs -
          right.createdMs ||
        left.event.key.localeCompare(
          right.event.key
        )
    );

  if (nextPageToken) {
    if (page >= MAX_PAGE) {
      throw new GoogleFormsTriggerError(
        "Google Forms response pagination exceeded the supported limit."
      );
    }

    return {
      events: detected.map(
        ({ event }) => event
      ),
      cursor: {
        phase: "PAGING",
        windowStartMs,
        windowEndMs,
        nextPageToken,
        page: page + 1,
      },
    };
  }

  return {
    events: detected.map(
      ({ event }) => event
    ),
    cursor: {
      phase: "READY",
      checkpointMs: windowEndMs,
    },
  };
}