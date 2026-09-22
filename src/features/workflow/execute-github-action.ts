import "server-only";

import { createHash } from "node:crypto";

import {
  resolveWorkflowIntegration,
  WorkflowIntegrationError,
} from "@/features/integration/resolve-workflow-integration";

import {
  GitHubActionError,
  parseGitHubActionConfiguration,
  type GitHubActionConfiguration,
} from "./github-action-configuration";
import type {
  WorkflowNodeData,
} from "./types";

type ExecuteGitHubActionOptions = {
  runId: string;
  workflowId: string;
  nodeId: string;
  data: WorkflowNodeData;
};

type GitHubIssue = {
  id?: unknown;
  number?: unknown;
  title?: unknown;
  body?: unknown;
  state?: unknown;
  html_url?: unknown;
  pull_request?: unknown;
};

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2_500_000;
const IDEMPOTENCY_PAGE_SIZE = 30;

const githubHeaders = (
  accessToken: string
) => ({
  Authorization: `Bearer ${accessToken}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version":
    "2022-11-28",
  "User-Agent": "Synapse-Workflow/1.0",
});

async function readBody(
  response: Response
): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = "";

  try {
    while (true) {
      const chunk = await reader.read();

      if (chunk.done) break;

      bytes += chunk.value.byteLength;

      if (bytes > MAX_RESPONSE_BYTES) {
        throw new GitHubActionError(
          "GitHub returned an unexpectedly large response."
        );
      }

      result += decoder.decode(
        chunk.value,
        { stream: true }
      );
    }

    return result + decoder.decode();
  } finally {
    await reader
      .cancel()
      .catch(() => undefined);
  }
}

function providerError(
  body: string
): string {
  try {
    const parsed = JSON.parse(body) as {
      message?: unknown;
    };

    return typeof parsed.message ===
      "string"
      ? parsed.message.slice(0, 500)
      : "";
  } catch {
    return "";
  }
}

function parseIssue(
  body: string
): GitHubIssue {
  try {
    const parsed: unknown =
      JSON.parse(body);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error();
    }

    return parsed as GitHubIssue;
  } catch {
    throw new GitHubActionError(
      "GitHub returned an invalid issue response."
    );
  }
}

export function createGitHubIssueMarker(
  runId: string,
  nodeId: string
): string {
  const digest = createHash("sha256")
    .update(`${runId}:${nodeId}`)
    .digest("hex");

  return `<!-- synapse-execution:${digest} -->`;
}

export function createGitHubIssueRequest(
  configuration: GitHubActionConfiguration,
  marker: string
) {
  return {
    title: configuration.title,
    body: configuration.body
      ? `${configuration.body}\n\n${marker}`
      : marker,
    labels: configuration.labels,
    assignees: configuration.assignees,
  };
}

async function findExistingIssue(
  accessToken: string,
  repository: string,
  marker: string
): Promise<GitHubIssue | null> {
  const query = new URLSearchParams({
    state: "all",
    sort: "created",
    direction: "desc",
    per_page: String(
      IDEMPOTENCY_PAGE_SIZE
    ),
  });
  let response: Response;

  try {
    response = await fetch(
      `https://api.github.com/repos/${repository}/issues?${query.toString()}`,
      {
        headers:
          githubHeaders(accessToken),
        redirect: "error",
        signal: AbortSignal.timeout(
          REQUEST_TIMEOUT_MS
        ),
      }
    );
  } catch {
    throw new GitHubActionError(
      "GitHub idempotency check failed."
    );
  }

  const body = await readBody(response);

  if (!response.ok) {
    const detail = providerError(body);

    throw new GitHubActionError(
      `GitHub idempotency check failed (${response.status})${detail ? `: ${detail}` : "."}`
    );
  }

  try {
    const parsed: unknown =
      JSON.parse(body);

    if (!Array.isArray(parsed)) {
      throw new Error();
    }

    return (
      parsed.find((item) => {
        if (
          !item ||
          typeof item !== "object"
        ) {
          return false;
        }

        const issue =
          item as GitHubIssue;

        return (
          !("pull_request" in issue) &&
          typeof issue.body ===
            "string" &&
          issue.body.includes(marker)
        );
      }) as GitHubIssue | undefined
    ) ?? null;
  } catch {
    throw new GitHubActionError(
      "GitHub returned an invalid issue-list response."
    );
  }
}

function issueOutput(
  issue: GitHubIssue,
  integration: {
    id: string;
    name: string;
  },
  repository: string,
  recoveredFromRetry: boolean
): Record<string, unknown> {
  if (
    typeof issue.id !== "number" ||
    !Number.isSafeInteger(issue.id) ||
    typeof issue.number !== "number" ||
    !Number.isSafeInteger(
      issue.number
    )
  ) {
    throw new GitHubActionError(
      "GitHub did not return a valid issue ID."
    );
  }

  return {
    success: true,
    provider: "GITHUB",
    integrationId: integration.id,
    integrationName: integration.name,
    repository,
    issueId: issue.id,
    issueNumber: issue.number,
    title:
      typeof issue.title === "string"
        ? issue.title
        : null,
    url:
      typeof issue.html_url ===
      "string"
        ? issue.html_url
        : null,
    state:
      typeof issue.state === "string"
        ? issue.state
        : null,
    recoveredFromRetry,
    message: recoveredFromRetry
      ? "GitHub issue already created successfully."
      : "GitHub issue created successfully.",
  };
}

export async function executeGitHubAction({
  runId,
  workflowId,
  nodeId,
  data,
}: ExecuteGitHubActionOptions): Promise<
  Record<string, unknown>
> {
  const configuration =
    parseGitHubActionConfiguration(data);
  const integration =
    await resolveWorkflowIntegration({
      workflowId,
      integrationId:
        configuration.integrationId,
      provider: "GITHUB",
    });
  const accessToken =
    integration.credentials.accessToken;

  if (!accessToken) {
    throw new WorkflowIntegrationError(
      "The GitHub integration does not contain an access token."
    );
  }

  const marker = createGitHubIssueMarker(
    runId,
    nodeId
  );
  const existing = await findExistingIssue(
    accessToken,
    configuration.repository,
    marker
  );

  if (existing) {
    return issueOutput(
      existing,
      integration,
      configuration.repository,
      true
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `https://api.github.com/repos/${configuration.repository}/issues`,
      {
        method: "POST",
        headers: {
          ...githubHeaders(accessToken),
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          createGitHubIssueRequest(
            configuration,
            marker
          )
        ),
        redirect: "error",
        signal: AbortSignal.timeout(
          REQUEST_TIMEOUT_MS
        ),
      }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" ||
        error.name === "AbortError")
    ) {
      throw new GitHubActionError(
        "GitHub create-issue request timed out."
      );
    }

    throw new GitHubActionError(
      "GitHub create-issue request failed."
    );
  }

  const body = await readBody(response);

  if (!response.ok) {
    const detail = providerError(body);

    throw new GitHubActionError(
      `GitHub create-issue failed (${response.status})${detail ? `: ${detail}` : "."}`
    );
  }

  return issueOutput(
    parseIssue(body),
    integration,
    configuration.repository,
    false
  );
}
