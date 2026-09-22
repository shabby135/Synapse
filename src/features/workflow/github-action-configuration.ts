import type {
  WorkflowNodeData,
} from "./types";

export type GitHubActionConfiguration = {
  actionType: "GITHUB_CREATE_ISSUE";
  integrationId: string;
  repository: string;
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OWNER_PATTERN =
  /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$/;
const REPOSITORY_PATTERN =
  /^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100}$/;
const USERNAME_PATTERN = OWNER_PATTERN;
const MAX_TITLE_LENGTH = 256;
const MAX_BODY_LENGTH = 65_536;
const MAX_LABELS = 20;
const MAX_LABEL_LENGTH = 50;
const MAX_ASSIGNEES = 10;

export class GitHubActionError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubActionError";
  }
}

function text(value: unknown): string {
  return typeof value === "string"
    ? value
    : "";
}

function parseList(
  value: unknown,
  options: {
    label: string;
    maximumItems: number;
    maximumLength: number;
    pattern?: RegExp;
  }
): string[] {
  if (
    value !== undefined &&
    value !== null &&
    typeof value !== "string" &&
    !Array.isArray(value)
  ) {
    throw new GitHubActionError(
      `${options.label[0]?.toUpperCase()}${options.label.slice(1)}s must be text or a list of text values.`
    );
  }

  if (
    (typeof value === "string" &&
      value.length > 10_000) ||
    (Array.isArray(value) &&
      value.length > 100)
  ) {
    throw new GitHubActionError(
      `${options.label[0]?.toUpperCase()}${options.label.slice(1)}s are too large.`
    );
  }

  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]/u)
      : [];
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of source) {
    if (typeof item !== "string") {
      throw new GitHubActionError(
        `Each ${options.label} must be text.`
      );
    }

    const parsed = text(item).trim();

    if (!parsed) continue;

    if (
      parsed.length >
        options.maximumLength ||
      /[\r\n\u0000-\u001f\u007f]/u.test(
        parsed
      ) ||
      (options.pattern &&
        !options.pattern.test(parsed))
    ) {
      throw new GitHubActionError(
        `Each ${options.label} must be a valid single-line value of at most ${options.maximumLength} characters.`
      );
    }

    const key = parsed.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      result.push(parsed);
    }
  }

  if (
    result.length > options.maximumItems
  ) {
    throw new GitHubActionError(
      `Use at most ${options.maximumItems} ${options.label}s.`
    );
  }

  return result;
}

export function parseGitHubActionConfiguration(
  data: WorkflowNodeData
): GitHubActionConfiguration {
  const configuration =
    data.configuration ?? {};

  if (
    configuration.actionType !==
    "GITHUB_CREATE_ISSUE"
  ) {
    throw new GitHubActionError(
      `${data.label} is not a GitHub create-issue action.`
    );
  }

  const integrationId = text(
    configuration.integrationId
  ).trim();

  if (!UUID_PATTERN.test(integrationId)) {
    throw new GitHubActionError(
      `${data.label} requires a valid GitHub integration.`
    );
  }

  const repository = text(
    configuration.repository
  ).trim();
  const parts = repository.split("/");

  if (
    repository.includes("{{") ||
    parts.length !== 2 ||
    !OWNER_PATTERN.test(parts[0] ?? "") ||
    !REPOSITORY_PATTERN.test(
      parts[1] ?? ""
    )
  ) {
    throw new GitHubActionError(
      "Repository must be a static owner/repository value."
    );
  }

  const title = text(
    configuration.title
  ).trim();

  if (
    !title ||
    title.length > MAX_TITLE_LENGTH ||
    /[\r\n]/u.test(title)
  ) {
    throw new GitHubActionError(
      `${data.label} requires a single-line title of at most ${MAX_TITLE_LENGTH} characters.`
    );
  }

  const body = text(configuration.body);

  if (body.length > MAX_BODY_LENGTH) {
    throw new GitHubActionError(
      `Issue body cannot exceed ${MAX_BODY_LENGTH.toLocaleString("en-US")} characters.`
    );
  }

  return {
    actionType: "GITHUB_CREATE_ISSUE",
    integrationId,
    repository,
    title,
    body,
    labels: parseList(
      configuration.labels,
      {
        label: "label",
        maximumItems: MAX_LABELS,
        maximumLength:
          MAX_LABEL_LENGTH,
      }
    ),
    assignees: parseList(
      configuration.assignees,
      {
        label: "assignee",
        maximumItems: MAX_ASSIGNEES,
        maximumLength: 39,
        pattern: USERNAME_PATTERN,
      }
    ),
  };
}
