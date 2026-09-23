import type {
  WorkflowNodeData,
} from "./types";

export type JiraActionConfiguration = {
  actionType: "JIRA_CREATE_ISSUE";
  integrationId: string;
  projectKey: string;
  issueTypeId: string;
  summary: string;
  description: string;
  labels: string[];
  priorityId: string | null;
  assigneeAccountId: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_KEY_PATTERN =
  /^[A-Z][A-Z0-9_]{1,9}$/;
const JIRA_ID_PATTERN =
  /^\d{1,32}$/;
const ACCOUNT_ID_PATTERN =
  /^[A-Za-z0-9:_-]{1,256}$/;

const MAX_SUMMARY_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 32_767;
const MAX_LABELS = 50;
const MAX_LABEL_LENGTH = 255;

export class JiraActionError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JiraActionError";
  }
}

function text(value: unknown): string {
  return typeof value === "string"
    ? value
    : "";
}

function parseLabels(
  value: unknown
): string[] {
  if (
    value !== undefined &&
    value !== null &&
    typeof value !== "string" &&
    !Array.isArray(value)
  ) {
    throw new JiraActionError(
      "Labels must be text or a list of text values."
    );
  }

  if (
    (typeof value === "string" &&
      value.length > 20_000) ||
    (Array.isArray(value) &&
      value.length > 100)
  ) {
    throw new JiraActionError(
      "Labels are too large."
    );
  }

  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]/u)
      : [];

  const labels: string[] = [];
  const seen = new Set<string>();

  for (const item of source) {
    if (typeof item !== "string") {
      throw new JiraActionError(
        "Each Jira label must be text."
      );
    }

    const label = item.trim();

    if (!label) continue;

    if (
      label.length > MAX_LABEL_LENGTH ||
      /[\s\u0000-\u001f\u007f]/u.test(
        label
      )
    ) {
      throw new JiraActionError(
        `Each Jira label must contain no whitespace or control characters and cannot exceed ${MAX_LABEL_LENGTH} characters.`
      );
    }

    const normalized =
      label.toLowerCase();

    if (!seen.has(normalized)) {
      seen.add(normalized);
      labels.push(label);
    }
  }

  if (labels.length > MAX_LABELS) {
    throw new JiraActionError(
      `Use at most ${MAX_LABELS} Jira labels.`
    );
  }

  return labels;
}

function parseOptionalJiraId(
  value: unknown,
  label: string
): string | null {
  if (
    value !== undefined &&
    value !== null &&
    typeof value !== "string"
  ) {
    throw new JiraActionError(
      `${label} must be text.`
    );
  }

  const parsed = text(value).trim();

  if (!parsed) {
    return null;
  }

  if (!JIRA_ID_PATTERN.test(parsed)) {
    throw new JiraActionError(
      `${label} must be a valid numeric Jira ID.`
    );
  }

  return parsed;
}

function parseAssigneeAccountId(
  value: unknown
): string | null {
  if (
    value !== undefined &&
    value !== null &&
    typeof value !== "string"
  ) {
    throw new JiraActionError(
      "Assignee account ID must be text."
    );
  }

  const accountId = text(value).trim();

  if (!accountId) {
    return null;
  }

  if (
    !ACCOUNT_ID_PATTERN.test(accountId)
  ) {
    throw new JiraActionError(
      "Assignee account ID must be a valid Jira account ID."
    );
  }

  return accountId;
}

export function parseJiraActionConfiguration(
  data: WorkflowNodeData
): JiraActionConfiguration {
  const configuration =
    data.configuration ?? {};

  if (
    configuration.actionType !==
    "JIRA_CREATE_ISSUE"
  ) {
    throw new JiraActionError(
      `${data.label} is not a Jira create-issue action.`
    );
  }

  const integrationId = text(
    configuration.integrationId
  ).trim();

  if (!UUID_PATTERN.test(integrationId)) {
    throw new JiraActionError(
      `${data.label} requires a valid Jira integration.`
    );
  }

  const projectKey = text(
    configuration.projectKey
  )
    .trim()
    .toUpperCase();

  if (
    projectKey.includes("{{") ||
    !PROJECT_KEY_PATTERN.test(projectKey)
  ) {
    throw new JiraActionError(
      "Project key must be a static Jira project key containing 2 to 10 uppercase letters, numbers, or underscores."
    );
  }

  const issueTypeId = text(
    configuration.issueTypeId
  ).trim();

  if (
    issueTypeId.includes("{{") ||
    !JIRA_ID_PATTERN.test(issueTypeId)
  ) {
    throw new JiraActionError(
      "Issue type ID must be a static numeric Jira issue-type ID."
    );
  }

  const summary = text(
    configuration.summary
  ).trim();

  if (
    !summary ||
    summary.length >
      MAX_SUMMARY_LENGTH ||
    /[\r\n]/u.test(summary)
  ) {
    throw new JiraActionError(
      `${data.label} requires a single-line summary of at most ${MAX_SUMMARY_LENGTH} characters.`
    );
  }

  const description = text(
    configuration.description
  );

  if (
    description.length >
    MAX_DESCRIPTION_LENGTH
  ) {
    throw new JiraActionError(
      `Issue description cannot exceed ${MAX_DESCRIPTION_LENGTH.toLocaleString("en-US")} characters.`
    );
  }

  return {
    actionType: "JIRA_CREATE_ISSUE",
    integrationId,
    projectKey,
    issueTypeId,
    summary,
    description,
    labels: parseLabels(
      configuration.labels
    ),
    priorityId: parseOptionalJiraId(
      configuration.priorityId,
      "Priority ID"
    ),
    assigneeAccountId:
      parseAssigneeAccountId(
        configuration.assigneeAccountId
      ),
  };
}