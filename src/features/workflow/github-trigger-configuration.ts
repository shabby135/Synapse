import type {
  IntegrationTriggerCursor,
} from "@/lib/db/schema/workflow-integration-trigger";

import type {
  WorkflowNodeData,
} from "./types";

export type GitHubTriggerStartMode =
  | "FROM_NOW"
  | "FROM_BEGINNING";

export type GitHubTriggerConfiguration = {
  triggerType: "GITHUB_NEW_ISSUE";
  integrationId: string;
  repository: string;
  labels: string[];
  startMode: GitHubTriggerStartMode;
  pollIntervalMinutes: number;
};

export type GitHubTriggerCursor =
  | {
      phase: "INITIAL" | "READY";
      checkpointMs: number;
    }
  | {
      phase: "PAGING";
      windowStartMs: number;
      windowEndMs: number;
      page: number;
    };

export type GitHubApiIssue = {
  id?: unknown;
  node_id?: unknown;
  number?: unknown;
  title?: unknown;
  body?: unknown;
  state?: unknown;
  state_reason?: unknown;
  locked?: unknown;
  html_url?: unknown;
  url?: unknown;
  comments_url?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  closed_at?: unknown;
  user?: unknown;
  labels?: unknown;
  assignees?: unknown;
  milestone?: unknown;
  pull_request?: unknown;
};

export type GitHubDetectedEvent = {
  key: string;
  input: Record<string, unknown>;
};

export type GitHubPollingWindow = {
  query: URLSearchParams;
  windowStartMs: number;
  windowEndMs: number;
  page: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OWNER_PATTERN =
  /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$/;
const REPOSITORY_PATTERN =
  /^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100}$/;
const POLL_INTERVALS = new Set([
  1,
  5,
  15,
  30,
  60,
]);
const MAX_LABELS = 20;
const MAX_LABEL_LENGTH = 50;
const MAX_PAGE = 1_000;
const MAX_ISSUES_PER_PAGE = 100;
const POLL_OVERLAP_MS = 2 * 60_000;
const MAX_BODY_CHARACTERS = 100_000;

export class GitHubTriggerError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubTriggerError";
  }
}

function readText(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function optionalText(value: unknown) {
  return typeof value === "string"
    ? value
    : null;
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

function positiveInteger(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

function parsedLabels(value: unknown) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const item of source) {
    const label = readText(item);

    if (!label) continue;

    if (
      label.length > MAX_LABEL_LENGTH ||
      label.includes("{{") ||
      /[\r\n\u0000-\u001f\u007f]/u.test(
        label
      )
    ) {
      throw new GitHubTriggerError(
        "Each GitHub label must be a static single-line value of at most 50 characters."
      );
    }

    const key = label.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      labels.push(label);
    }
  }

  if (labels.length > MAX_LABELS) {
    throw new GitHubTriggerError(
      "Use at most 20 GitHub labels."
    );
  }

  return labels;
}

export function parseGitHubTriggerConfiguration(
  data: WorkflowNodeData
): GitHubTriggerConfiguration {
  const configuration =
    data.configuration ?? {};

  if (
    configuration.triggerType !==
    "GITHUB_NEW_ISSUE"
  ) {
    throw new GitHubTriggerError(
      `${data.label} is not a GitHub new-issue trigger.`
    );
  }

  const integrationId = readText(
    configuration.integrationId
  );

  if (!UUID_PATTERN.test(integrationId)) {
    throw new GitHubTriggerError(
      `${data.label} requires a valid GitHub integration.`
    );
  }

  const repository = readText(
    configuration.repository
  );
  const repositoryParts =
    repository.split("/");

  if (
    repository.includes("{{") ||
    repositoryParts.length !== 2 ||
    !OWNER_PATTERN.test(
      repositoryParts[0] ?? ""
    ) ||
    !REPOSITORY_PATTERN.test(
      repositoryParts[1] ?? ""
    )
  ) {
    throw new GitHubTriggerError(
      "Repository must be a static owner/repository value."
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
    throw new GitHubTriggerError(
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
    throw new GitHubTriggerError(
      "Select a supported polling interval."
    );
  }

  return {
    triggerType: "GITHUB_NEW_ISSUE",
    integrationId,
    repository,
    labels: parsedLabels(
      configuration.labels
    ),
    startMode,
    pollIntervalMinutes,
  };
}

export function createGitHubTriggerCursor(
  configuration: GitHubTriggerConfiguration,
  activatedAt: Date
): GitHubTriggerCursor {
  const activatedAtMs =
    activatedAt.getTime();

  if (
    !Number.isSafeInteger(
      activatedAtMs
    ) ||
    activatedAtMs < 0
  ) {
    throw new GitHubTriggerError(
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

export function parseGitHubTriggerCursor(
  cursor: IntegrationTriggerCursor | null
): GitHubTriggerCursor | null {
  if (!cursor) return null;

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
    !positiveInteger(cursor.page) ||
    cursor.page > MAX_PAGE
  ) {
    return null;
  }

  return {
    phase: "PAGING",
    windowStartMs:
      cursor.windowStartMs,
    windowEndMs: cursor.windowEndMs,
    page: cursor.page,
  };
}

export function gitHubIssuesQuery({
  configuration,
  cursor,
  now,
}: {
  configuration: GitHubTriggerConfiguration;
  cursor: GitHubTriggerCursor;
  now: Date;
}): GitHubPollingWindow {
  const nowMs = now.getTime();

  if (
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0
  ) {
    throw new GitHubTriggerError(
      "The GitHub polling time is invalid."
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
      : Math.max(nowMs, windowStartMs);
  const page =
    cursor.phase === "PAGING"
      ? cursor.page
      : 1;
  const query = new URLSearchParams({
    state: "all",
    sort: "created",
    direction: "asc",
    per_page: String(
      MAX_ISSUES_PER_PAGE
    ),
    page: String(page),
  });

  if (windowStartMs > 0) {
    query.set(
      "since",
      new Date(windowStartMs)
        .toISOString()
    );
  }

  if (configuration.labels.length > 0) {
    query.set(
      "labels",
      configuration.labels.join(",")
    );
  }

  return {
    query,
    windowStartMs,
    windowEndMs,
    page,
  };
}

export function parseGitHubNextPage(
  linkHeader: string | null
) {
  if (!linkHeader) return false;

  if (linkHeader.length > 16_384) {
    throw new GitHubTriggerError(
      "GitHub returned an invalid pagination header."
    );
  }

  return linkHeader
    .split(",")
    .some((part) =>
      /;\s*rel="next"\s*$/u.test(
        part.trim()
      )
    );
}

function userData(value: unknown) {
  const source = record(value);

  return source
    ? {
        id: positiveInteger(source.id)
          ? source.id
          : null,
        login: readText(source.login),
        type: readText(source.type),
        avatarUrl: readText(
          source.avatar_url
        ),
        htmlUrl: readText(
          source.html_url
        ),
      }
    : null;
}

function labelData(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, 100)
    .flatMap((item) => {
      if (typeof item === "string") {
        return [
          {
            id: null,
            name: item,
            color: "",
            description: "",
          },
        ];
      }

      const source = record(item);

      if (!source) return [];

      return [
        {
          id: positiveInteger(source.id)
            ? source.id
            : null,
          name: readText(source.name),
          color: readText(source.color),
          description:
            optionalText(
              source.description
            ) ?? "",
        },
      ];
    });
}

function assigneeData(value: unknown) {
  return Array.isArray(value)
    ? value
        .slice(0, 100)
        .map(userData)
        .filter(
          (item): item is NonNullable<
            ReturnType<typeof userData>
          > => item !== null
        )
    : [];
}

function milestoneData(value: unknown) {
  const source = record(value);

  if (!source) return null;

  return {
    id: positiveInteger(source.id)
      ? source.id
      : null,
    number: positiveInteger(
      source.number
    )
      ? source.number
      : null,
    title: readText(source.title),
    description:
      optionalText(source.description) ??
      "",
    state: readText(source.state),
    dueOn:
      optionalText(source.due_on),
  };
}

function detectedIssue(
  issue: GitHubApiIssue,
  repository: string,
  windowStartMs: number,
  windowEndMs: number
): GitHubDetectedEvent | null {
  if (record(issue.pull_request)) {
    return null;
  }

  const id = issue.id;
  const number = issue.number;
  const createdAt = readText(
    issue.created_at
  );
  const createdAtMs = Date.parse(
    createdAt
  );

  if (
    !positiveInteger(id) ||
    !positiveInteger(number) ||
    !Number.isFinite(createdAtMs) ||
    createdAtMs < windowStartMs ||
    createdAtMs > windowEndMs
  ) {
    return null;
  }

  return {
    key: String(id),
    input: {
      provider: "GITHUB",
      event: "NEW_ISSUE",
      repository,
      id,
      nodeId:
        optionalText(issue.node_id),
      number,
      title: readText(issue.title),
      body: (
        optionalText(issue.body) ?? ""
      ).slice(0, MAX_BODY_CHARACTERS),
      state: readText(issue.state),
      stateReason:
        optionalText(
          issue.state_reason
        ),
      locked:
        issue.locked === true,
      htmlUrl: readText(
        issue.html_url
      ),
      apiUrl: readText(issue.url),
      commentsUrl: readText(
        issue.comments_url
      ),
      createdAt,
      updatedAt:
        optionalText(issue.updated_at),
      closedAt:
        optionalText(issue.closed_at),
      author: userData(issue.user),
      labels: labelData(issue.labels),
      assignees: assigneeData(
        issue.assignees
      ),
      milestone: milestoneData(
        issue.milestone
      ),
    },
  };
}

export function processGitHubIssuesPage({
  issues,
  repository,
  windowStartMs,
  windowEndMs,
  page,
  hasNextPage,
}: {
  issues: GitHubApiIssue[];
  repository: string;
  windowStartMs: number;
  windowEndMs: number;
  page: number;
  hasNextPage: boolean;
}): {
  events: GitHubDetectedEvent[];
  cursor: GitHubTriggerCursor;
} {
  if (
    !positiveInteger(page) ||
    page > MAX_PAGE
  ) {
    throw new GitHubTriggerError(
      "GitHub returned an invalid issue page."
    );
  }

  const events = issues
    .slice(0, MAX_ISSUES_PER_PAGE)
    .flatMap((issue) => {
      const event = detectedIssue(
        issue,
        repository,
        windowStartMs,
        windowEndMs
      );

      return event ? [event] : [];
    });

  if (hasNextPage) {
    if (page >= MAX_PAGE) {
      throw new GitHubTriggerError(
        "GitHub issue pagination exceeded the supported limit."
      );
    }

    return {
      events,
      cursor: {
        phase: "PAGING",
        windowStartMs,
        windowEndMs,
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
