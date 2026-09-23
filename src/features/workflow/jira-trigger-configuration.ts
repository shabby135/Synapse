import type {
  IntegrationTriggerCursor,
} from "@/lib/db/schema/workflow-integration-trigger";

import type {
  WorkflowNodeData,
} from "./types";

export type JiraTriggerStartMode =
  | "FROM_NOW"
  | "FROM_BEGINNING";

export type JiraTriggerConfiguration = {
  triggerType: "JIRA_NEW_ISSUE";
  integrationId: string;
  projectKey: string;
  startMode: JiraTriggerStartMode;
  pollIntervalMinutes: number;
};

export type JiraTriggerCursor =
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

export type JiraApiIssue = {
  id?: unknown;
  key?: unknown;
  self?: unknown;
  fields?: unknown;
};

export type JiraIssueSearchPage = {
  issues: JiraApiIssue[];
  nextPageToken: string | null;
};

export type JiraDetectedEvent = {
  key: string;
  input: Record<string, unknown>;
};

export type JiraIssueSearchWindow = {
  body: {
    jql: string;
    fields: string[];
    maxResults: number;
    nextPageToken?: string;
  };
  windowStartMs: number;
  windowEndMs: number;
  page: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROJECT_KEY_PATTERN =
  /^[A-Z][A-Z0-9_]{1,9}$/;

const JIRA_ISSUE_ID_PATTERN =
  /^\d{1,32}$/;

const POLL_INTERVALS = new Set([
  1,
  5,
  15,
  30,
  60,
]);

const JIRA_SEARCH_FIELDS = [
  "summary",
  "description",
  "created",
  "updated",
  "labels",
  "project",
  "issuetype",
  "status",
  "priority",
  "reporter",
  "assignee",
];

const MAX_ISSUES_PER_PAGE = 50;
const MAX_PAGE = 1_000;
const MAX_PAGE_TOKEN_LENGTH = 2_048;
const POLL_OVERLAP_MS = 5 * 60_000;

export class JiraTriggerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JiraTriggerError";
  }
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

function record(
  value: unknown
): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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

function jiraIssueId(
  value: unknown
): string | null {
  const parsed = readText(value, 32);

  return JIRA_ISSUE_ID_PATTERN.test(
    parsed
  )
    ? parsed
    : null;
}

function jiraIssueKey(
  value: unknown,
  projectKey: string
): string | null {
  const parsed = readText(
    value,
    128
  ).toUpperCase();

  const pattern = new RegExp(
    `^${projectKey}-[1-9][0-9]*$`
  );

  return pattern.test(parsed)
    ? parsed
    : null;
}

function namedEntity(
  value: unknown
): {
  id: string;
  name: string;
} | null {
  const source = record(value);

  if (!source) {
    return null;
  }

  const id = readText(
    source.id,
    128
  );
  const name = readText(
    source.name,
    512
  );

  if (!id && !name) {
    return null;
  }

  return {
    id,
    name,
  };
}

function projectData(
  value: unknown
): {
  id: string;
  key: string;
  name: string;
} | null {
  const source = record(value);

  if (!source) {
    return null;
  }

  const id = readText(
    source.id,
    128
  );
  const key = readText(
    source.key,
    64
  ).toUpperCase();
  const name = readText(
    source.name,
    512
  );

  if (!id || !key) {
    return null;
  }

  return {
    id,
    key,
    name,
  };
}

function accountData(
  value: unknown
): {
  accountId: string;
  displayName: string;
  emailAddress: string;
} | null {
  const source = record(value);

  if (!source) {
    return null;
  }

  const accountId = readText(
    source.accountId,
    256
  );

  if (!accountId) {
    return null;
  }

  return {
    accountId,
    displayName: readText(
      source.displayName,
      512
    ),
    emailAddress: readText(
      source.emailAddress,
      512
    ),
  };
}

function labelData(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const labels = value
    .filter(
      (
        label
      ): label is string =>
        typeof label === "string"
    )
    .map((label) =>
      label.trim().slice(0, 255)
    )
    .filter(Boolean)
    .slice(0, 100);

  return [...new Set(labels)];
}

function descriptionData(
  value: unknown
): unknown {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, 100_000);
  }

  if (
    typeof value === "object"
  ) {
    return value;
  }

  return null;
}

function issueCreatedAtMs(
  issue: JiraApiIssue
): number | null {
  const fields = record(issue.fields);
  const created = readText(
    fields?.created,
    128
  );
  const createdMs = Date.parse(created);

  return Number.isFinite(createdMs)
    ? createdMs
    : null;
}

export function parseJiraTriggerConfiguration(
  data: WorkflowNodeData
): JiraTriggerConfiguration {
  const configuration =
    data.configuration ?? {};

  if (
    configuration.triggerType !==
    "JIRA_NEW_ISSUE"
  ) {
    throw new JiraTriggerError(
      `${data.label} is not a Jira new-issue trigger.`
    );
  }

  const integrationId = readText(
    configuration.integrationId,
    64
  );

  if (!UUID_PATTERN.test(integrationId)) {
    throw new JiraTriggerError(
      `${data.label} requires a valid Jira integration.`
    );
  }

  const rawProjectKey = readText(
    configuration.projectKey,
    64
  );

  if (rawProjectKey.includes("{{")) {
    throw new JiraTriggerError(
      "Project key must be static."
    );
  }

  const projectKey =
    rawProjectKey.toUpperCase();

  if (
    !PROJECT_KEY_PATTERN.test(
      projectKey
    )
  ) {
    throw new JiraTriggerError(
      "Project key must contain 2 to 10 uppercase letters, numbers, or underscores and must begin with a letter."
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
    throw new JiraTriggerError(
      "Select when the trigger should start reading issues."
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
    throw new JiraTriggerError(
      "Select a supported polling interval."
    );
  }

  return {
    triggerType: "JIRA_NEW_ISSUE",
    integrationId,
    projectKey,
    startMode,
    pollIntervalMinutes,
  };
}

export function createJiraTriggerCursor(
  configuration: JiraTriggerConfiguration,
  activatedAt: Date
): JiraTriggerCursor {
  const activatedAtMs =
    activatedAt.getTime();

  if (
    !Number.isSafeInteger(
      activatedAtMs
    ) ||
    activatedAtMs < 0
  ) {
    throw new JiraTriggerError(
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

export function parseJiraTriggerCursor(
  cursor: IntegrationTriggerCursor | null
): JiraTriggerCursor | null {
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

export function jiraIssueSearchRequest({
  configuration,
  cursor,
  now,
}: {
  configuration: JiraTriggerConfiguration;
  cursor: JiraTriggerCursor;
  now: Date;
}): JiraIssueSearchWindow {
  const nowMs = now.getTime();

  if (
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0
  ) {
    throw new JiraTriggerError(
      "The Jira polling time is invalid."
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

  const body: JiraIssueSearchWindow["body"] =
    {
      jql: `project = "${configuration.projectKey}" ORDER BY created DESC, key DESC`,
      fields: [
        ...JIRA_SEARCH_FIELDS,
      ],
      maxResults:
        MAX_ISSUES_PER_PAGE,
    };

  if (cursor.phase === "PAGING") {
    body.nextPageToken =
      cursor.nextPageToken;
  }

  return {
    body,
    windowStartMs,
    windowEndMs,
    page,
  };
}

export function parseJiraIssueSearchPage(
  body: string
): JiraIssueSearchPage {
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    throw new JiraTriggerError(
      "Jira returned invalid JSON."
    );
  }

  const source = record(parsed);

  if (
    !source ||
    !Array.isArray(source.issues)
  ) {
    throw new JiraTriggerError(
      "Jira returned an invalid issue-search response."
    );
  }

  if (
    source.issues.length >
    MAX_ISSUES_PER_PAGE
  ) {
    throw new JiraTriggerError(
      "Jira returned too many issues."
    );
  }

  const issues = source.issues.filter(
    (
      issue
    ): issue is JiraApiIssue =>
      issue !== null &&
      typeof issue === "object" &&
      !Array.isArray(issue)
  );

  if (
    issues.length !==
    source.issues.length
  ) {
    throw new JiraTriggerError(
      "Jira returned a malformed issue."
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
      throw new JiraTriggerError(
        "Jira returned an invalid pagination token."
      );
    }

    nextPageToken =
      source.nextPageToken;
  }

  return {
    issues,
    nextPageToken,
  };
}

function detectedIssue(
  issue: JiraApiIssue,
  configuration: JiraTriggerConfiguration,
  windowStartMs: number,
  windowEndMs: number
): JiraDetectedEvent | null {
  const id = jiraIssueId(issue.id);
  const key = jiraIssueKey(
    issue.key,
    configuration.projectKey
  );
  const fields = record(issue.fields);

  if (!id || !key || !fields) {
    return null;
  }

  const project = projectData(
    fields.project
  );

  if (
    !project ||
    project.key !==
      configuration.projectKey
  ) {
    return null;
  }

  const created = readText(
    fields.created,
    128
  );
  const createdMs = Date.parse(created);

  if (
    !Number.isFinite(createdMs) ||
    createdMs < windowStartMs ||
    createdMs > windowEndMs
  ) {
    return null;
  }

  const updated = readText(
    fields.updated,
    128
  );
  const updatedMs = Date.parse(updated);

  return {
    key: id,
    input: {
      provider: "JIRA",
      event: "NEW_ISSUE",
      issue: {
        id,
        key,
        self: readText(
          issue.self,
          2_048
        ),
        summary: readText(
          fields.summary,
          10_000
        ),
        description:
          descriptionData(
            fields.description
          ),
        createdAt: new Date(
          createdMs
        ).toISOString(),
        updatedAt:
          Number.isFinite(updatedMs)
            ? new Date(
                updatedMs
              ).toISOString()
            : null,
        labels: labelData(
          fields.labels
        ),
        project,
        issueType: namedEntity(
          fields.issuetype
        ),
        status: namedEntity(
          fields.status
        ),
        priority: namedEntity(
          fields.priority
        ),
        reporter: accountData(
          fields.reporter
        ),
        assignee: accountData(
          fields.assignee
        ),
      },
    },
  };
}

export function processJiraIssuesPage({
  issues,
  nextPageToken,
  configuration,
  windowStartMs,
  windowEndMs,
  page,
}: {
  issues: JiraApiIssue[];
  nextPageToken: string | null;
  configuration: JiraTriggerConfiguration;
  windowStartMs: number;
  windowEndMs: number;
  page: number;
}): {
  events: JiraDetectedEvent[];
  cursor: JiraTriggerCursor;
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
    throw new JiraTriggerError(
      "The Jira polling window is invalid."
    );
  }

  if (
    !nonNegativeInteger(page) ||
    page > MAX_PAGE
  ) {
    throw new JiraTriggerError(
      "Jira returned an invalid issue page."
    );
  }

  if (
    issues.length >
    MAX_ISSUES_PER_PAGE
  ) {
    throw new JiraTriggerError(
      "Jira returned too many issues."
    );
  }

  if (
    nextPageToken !== null &&
    !validNextPageToken(
      nextPageToken
    )
  ) {
    throw new JiraTriggerError(
      "Jira returned an invalid pagination token."
    );
  }

  let reachedWindowStart = false;
  const events: JiraDetectedEvent[] =
    [];

  for (const issue of issues) {
    const fields = record(
      issue.fields
    );
    const project = projectData(
      fields?.project
    );
    const createdMs =
      issueCreatedAtMs(issue);

    if (
      project?.key ===
        configuration.projectKey &&
      createdMs !== null &&
      createdMs < windowStartMs
    ) {
      reachedWindowStart = true;
    }

    const event = detectedIssue(
      issue,
      configuration,
      windowStartMs,
      windowEndMs
    );

    if (event) {
      events.push(event);
    }
  }

  if (
    nextPageToken &&
    !reachedWindowStart
  ) {
    if (page >= MAX_PAGE) {
      throw new JiraTriggerError(
        "Jira issue pagination exceeded the supported limit."
      );
    }

    return {
      events,
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
    events,
    cursor: {
      phase: "READY",
      checkpointMs: windowEndMs,
    },
  };
}