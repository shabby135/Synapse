import "server-only";

import {
  resolveWorkflowIntegration,
  WorkflowIntegrationError,
} from "@/features/integration/resolve-workflow-integration";

import {
  createGitHubTriggerCursor,
  type GitHubApiIssue,
  GitHubTriggerError,
  gitHubIssuesQuery,
  parseGitHubNextPage,
  parseGitHubTriggerConfiguration,
  parseGitHubTriggerCursor,
  processGitHubIssuesPage,
} from "./github-trigger-configuration";
import type {
  IntegrationTriggerHandler,
} from "./integration-trigger-registry";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2_000_000;

async function readLimitedBody(
  response: Response
) {
  if (!response.body) return "";

  const reader =
    response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let result = "";

  try {
    while (true) {
      const chunk = await reader.read();

      if (chunk.done) break;

      received += chunk.value.byteLength;

      if (received > MAX_RESPONSE_BYTES) {
        throw new GitHubTriggerError(
          "GitHub returned too much issue data."
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

function providerError(body: string) {
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

function parseIssues(
  body: string
): GitHubApiIssue[] {
  try {
    const parsed = JSON.parse(body);

    if (!Array.isArray(parsed)) {
      throw new Error();
    }

    return parsed.slice(0, 100) as GitHubApiIssue[];
  } catch {
    throw new GitHubTriggerError(
      "GitHub returned an invalid issue list."
    );
  }
}

async function request(
  url: string,
  accessToken: string
) {
  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        Accept:
          "application/vnd.github+json",
        "X-GitHub-Api-Version":
          "2022-11-28",
        "User-Agent":
          "Synapse-Workflow/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(
        REQUEST_TIMEOUT_MS
      ),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" ||
        error.name === "AbortError")
    ) {
      throw new GitHubTriggerError(
        "GitHub trigger polling timed out."
      );
    }

    throw new GitHubTriggerError(
      "GitHub trigger polling failed."
    );
  }
}

function repositoryPath(repository: string) {
  const [owner, name] =
    repository.split("/");

  return `${encodeURIComponent(owner ?? "")}/${encodeURIComponent(name ?? "")}`;
}

export const githubTriggerHandler: IntegrationTriggerHandler = {
  type: "GITHUB_NEW_ISSUE",
  provider: "GITHUB",
  async poll({
    workflowId,
    activatedAt,
    configuration,
    cursor,
  }) {
    const parsedConfiguration =
      parseGitHubTriggerConfiguration({
        label: "GitHub trigger",
        configuration,
      });
    const integration =
      await resolveWorkflowIntegration({
        workflowId,
        integrationId:
          parsedConfiguration.integrationId,
        provider: "GITHUB",
      });
    const accessToken =
      integration.credentials.accessToken;

    if (!accessToken) {
      throw new WorkflowIntegrationError(
        "The GitHub integration does not contain an access token."
      );
    }

    const activeCursor =
      parseGitHubTriggerCursor(cursor) ??
      createGitHubTriggerCursor(
        parsedConfiguration,
        activatedAt
      );
    const pollingWindow =
      gitHubIssuesQuery({
        configuration:
          parsedConfiguration,
        cursor: activeCursor,
        now: new Date(),
      });
    const response = await request(
      `https://api.github.com/repos/${repositoryPath(parsedConfiguration.repository)}/issues?${pollingWindow.query.toString()}`,
      accessToken
    );
    const body = await readLimitedBody(
      response
    );

    if (!response.ok) {
      const detail = providerError(body);
      const rateLimited =
        (response.status === 403 ||
          response.status === 429) &&
        response.headers.get(
          "x-ratelimit-remaining"
        ) === "0";

      throw new GitHubTriggerError(
        rateLimited
          ? "GitHub rate limit was reached. Polling will retry automatically."
          : `GitHub issue polling failed (${response.status})${detail ? `: ${detail}` : "."}`
      );
    }

    const detected =
      processGitHubIssuesPage({
        issues: parseIssues(body),
        repository:
          parsedConfiguration.repository,
        windowStartMs:
          pollingWindow.windowStartMs,
        windowEndMs:
          pollingWindow.windowEndMs,
        page: pollingWindow.page,
        hasNextPage:
          parseGitHubNextPage(
            response.headers.get("link")
          ),
      });

    return {
      ...detected,
      pollIntervalMinutes:
        parsedConfiguration.pollIntervalMinutes,
    };
  },
};
