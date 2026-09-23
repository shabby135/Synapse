import "server-only";

import {
  createHash,
} from "node:crypto";

import {
  normalizeJiraSiteUrl,
} from "@/features/integration/jira-connection";
import {
  resolveWorkflowIntegration,
  WorkflowIntegrationError,
} from "@/features/integration/resolve-workflow-integration";

import {
  JiraActionError,
  parseJiraActionConfiguration,
  type JiraActionConfiguration,
} from "./jira-action-configuration";
import type {
  WorkflowNodeData,
} from "./types";

type ExecuteJiraActionOptions = {
  runId: string;
  workflowId: string;
  nodeId: string;
  data: WorkflowNodeData;
};

type JiraIssue = {
  id?: unknown;
  key?: unknown;
  self?: unknown;
  fields?: {
    summary?: unknown;
  };
};

type JiraSearchResponse = {
  issues?: unknown;
};

type AtlassianDocument = {
  version: 1;
  type: "doc";
  content: Array<{
    type: "paragraph";
    content?: Array<{
      type: "text";
      text: string;
    }>;
  }>;
};

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2_500_000;

function jiraHeaders(
  email: string,
  apiToken: string
) {
  const authorization = Buffer.from(
    `${email}:${apiToken}`,
    "utf8"
  ).toString("base64");

  return {
    Authorization: `Basic ${authorization}`,
    Accept: "application/json",
    "User-Agent":
      "Synapse-Workflow/1.0",
  };
}

async function readBody(
  response: Response
): Promise<string> {
  if (!response.body) return "";

  const reader =
    response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = "";

  try {
    while (true) {
      const chunk =
        await reader.read();

      if (chunk.done) break;

      bytes += chunk.value.byteLength;

      if (
        bytes > MAX_RESPONSE_BYTES
      ) {
        throw new JiraActionError(
          "Jira returned an unexpectedly large response."
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
    const parsed = JSON.parse(
      body
    ) as {
      message?: unknown;
      errorMessages?: unknown;
      errors?: unknown;
    };

    const messages: string[] = [];

    if (
      typeof parsed.message ===
      "string"
    ) {
      messages.push(parsed.message);
    }

    if (
      Array.isArray(
        parsed.errorMessages
      )
    ) {
      for (
        const message of
        parsed.errorMessages
      ) {
        if (
          typeof message ===
          "string"
        ) {
          messages.push(message);
        }
      }
    }

    if (
      parsed.errors &&
      typeof parsed.errors ===
        "object" &&
      !Array.isArray(parsed.errors)
    ) {
      for (
        const [field, value] of
        Object.entries(parsed.errors)
      ) {
        if (
          typeof value ===
          "string"
        ) {
          messages.push(
            `${field}: ${value}`
          );
        }
      }
    }

    return messages
      .join("; ")
      .slice(0, 500);
  } catch {
    return "";
  }
}

function parseIssue(
  body: string
): JiraIssue {
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

    return parsed as JiraIssue;
  } catch {
    throw new JiraActionError(
      "Jira returned an invalid issue response."
    );
  }
}

function parseSearchResponse(
  body: string
): JiraIssue[] {
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

    const response =
      parsed as JiraSearchResponse;

    if (
      !Array.isArray(response.issues)
    ) {
      throw new Error();
    }

    return response.issues as JiraIssue[];
  } catch {
    throw new JiraActionError(
      "Jira returned an invalid issue-search response."
    );
  }
}

async function jiraRequest(
  url: string,
  init: RequestInit,
  failureMessage: string
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(
        REQUEST_TIMEOUT_MS
      ),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name ===
        "TimeoutError" ||
        error.name === "AbortError")
    ) {
      throw new JiraActionError(
        `${failureMessage} timed out.`
      );
    }

    throw new JiraActionError(
      `${failureMessage} failed.`
    );
  }
}

export function createJiraIssueMarker(
  runId: string,
  nodeId: string
): string {
  const digest = createHash("sha256")
    .update(`${runId}:${nodeId}`)
    .digest("hex");

  return `synapse-execution-${digest}`;
}

export function createJiraDescriptionDocument(
  description: string
): AtlassianDocument {
  const lines = description.split(
    /\r?\n/u
  );

  return {
    version: 1,
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      ...(line
        ? {
            content: [
              {
                type: "text",
                text: line,
              },
            ],
          }
        : {}),
    })),
  };
}

export function createJiraIssueRequest(
  configuration:
    JiraActionConfiguration,
  marker: string
) {
  const labels = [
    ...configuration.labels,
  ];

  if (
    !labels.some(
      (label) =>
        label.toLowerCase() ===
        marker.toLowerCase()
    )
  ) {
    labels.push(marker);
  }

  return {
    fields: {
      project: {
        key: configuration.projectKey,
      },
      issuetype: {
        id: configuration.issueTypeId,
      },
      summary:
        configuration.summary,
      labels,
      ...(configuration.description
        ? {
            description:
              createJiraDescriptionDocument(
                configuration.description
              ),
          }
        : {}),
      ...(configuration.priorityId
        ? {
            priority: {
              id: configuration.priorityId,
            },
          }
        : {}),
      ...(configuration.assigneeAccountId
        ? {
            assignee: {
              accountId:
                configuration.assigneeAccountId,
            },
          }
        : {}),
    },
  };
}

function escapeJqlString(
  value: string
): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"');
}

export function createJiraIssueSearchUrl(
  siteUrl: string,
  projectKey: string,
  marker: string
): string {
  const query = new URLSearchParams({
    jql:
      `project = "${escapeJqlString(projectKey)}" ` +
      `AND labels = "${escapeJqlString(marker)}" ` +
      "ORDER BY created DESC",
    fields: "id,key,summary,self",
    maxResults: "1",
  });

  return (
    `${siteUrl}/rest/api/3/search/jql?` +
    query.toString()
  );
}

async function findExistingIssue(
  siteUrl: string,
  email: string,
  apiToken: string,
  projectKey: string,
  marker: string
): Promise<JiraIssue | null> {
  const response = await jiraRequest(
    createJiraIssueSearchUrl(
      siteUrl,
      projectKey,
      marker
    ),
    {
      method: "GET",
      headers: jiraHeaders(
        email,
        apiToken
      ),
    },
    "Jira idempotency check"
  );

  const body = await readBody(response);

  if (!response.ok) {
    const detail =
      providerError(body);

    throw new JiraActionError(
      `Jira idempotency check failed (${response.status})${detail ? `: ${detail}` : "."}`
    );
  }

  return (
    parseSearchResponse(body)[0] ??
    null
  );
}

function issueOutput(
  issue: JiraIssue,
  integration: {
    id: string;
    name: string;
  },
  siteUrl: string,
  projectKey: string,
  fallbackSummary: string,
  recoveredFromRetry: boolean
): Record<string, unknown> {
  if (
    typeof issue.id !== "string" ||
    !/^\d+$/u.test(issue.id)
  ) {
    throw new JiraActionError(
      "Jira did not return a valid issue ID."
    );
  }

  if (
    typeof issue.key !== "string" ||
    !/^[A-Z][A-Z0-9_]{1,9}-[1-9]\d*$/u.test(
      issue.key
    )
  ) {
    throw new JiraActionError(
      "Jira did not return a valid issue key."
    );
  }

  const summary =
    issue.fields &&
    typeof issue.fields.summary ===
      "string"
      ? issue.fields.summary
      : fallbackSummary;

  return {
    success: true,
    provider: "JIRA",
    integrationId: integration.id,
    integrationName:
      integration.name,
    projectKey,
    issueId: issue.id,
    issueKey: issue.key,
    summary,
    url:
      `${siteUrl}/browse/` +
      encodeURIComponent(issue.key),
    apiUrl:
      typeof issue.self === "string"
        ? issue.self
        : null,
    recoveredFromRetry,
    message: recoveredFromRetry
      ? "Jira issue already created successfully."
      : "Jira issue created successfully.",
  };
}

export async function executeJiraAction({
  runId,
  workflowId,
  nodeId,
  data,
}: ExecuteJiraActionOptions): Promise<
  Record<string, unknown>
> {
  const configuration =
    parseJiraActionConfiguration(
      data
    );

  const integration =
    await resolveWorkflowIntegration({
      workflowId,
      integrationId:
        configuration.integrationId,
      provider: "JIRA",
    });

  const siteUrl =
    integration.credentials.siteUrl;
  const email =
    integration.credentials.email;
  const apiToken =
    integration.credentials.apiToken;

  if (
    !siteUrl ||
    !email ||
    !apiToken
  ) {
    throw new WorkflowIntegrationError(
      "The Jira integration does not contain a site URL, email address, and API token."
    );
  }

  const normalizedSiteUrl =
    normalizeJiraSiteUrl(siteUrl);

  const marker =
    createJiraIssueMarker(
      runId,
      nodeId
    );

  const existing =
    await findExistingIssue(
      normalizedSiteUrl,
      email,
      apiToken,
      configuration.projectKey,
      marker
    );

  if (existing) {
    return issueOutput(
      existing,
      integration,
      normalizedSiteUrl,
      configuration.projectKey,
      configuration.summary,
      true
    );
  }

  const response = await jiraRequest(
    `${normalizedSiteUrl}/rest/api/3/issue`,
    {
      method: "POST",
      headers: {
        ...jiraHeaders(
          email,
          apiToken
        ),
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(
        createJiraIssueRequest(
          configuration,
          marker
        )
      ),
    },
    "Jira create-issue request"
  );

  const body = await readBody(response);

  if (!response.ok) {
    const detail =
      providerError(body);

    throw new JiraActionError(
      `Jira create-issue failed (${response.status})${detail ? `: ${detail}` : "."}`
    );
  }

  return issueOutput(
    parseIssue(body),
    integration,
    normalizedSiteUrl,
    configuration.projectKey,
    configuration.summary,
    false
  );
}