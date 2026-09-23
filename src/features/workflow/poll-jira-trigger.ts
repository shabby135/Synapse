import "server-only";

import { Buffer } from "node:buffer";

import {
  normalizeJiraSiteUrl,
} from "@/features/integration/jira-connection";
import {
  resolveWorkflowIntegration,
  WorkflowIntegrationError,
} from "@/features/integration/resolve-workflow-integration";

import type {
  IntegrationTriggerHandler,
} from "./integration-trigger-registry";
import {
  createJiraTriggerCursor,
  jiraIssueSearchRequest,
  JiraTriggerError,
  parseJiraIssueSearchPage,
  parseJiraTriggerConfiguration,
  parseJiraTriggerCursor,
  processJiraIssuesPage,
} from "./jira-trigger-configuration";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2_000_000;

async function readLimitedBody(
  response: Response
): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader =
    response.body.getReader();
  const decoder = new TextDecoder();

  let receivedBytes = 0;
  let result = "";

  try {
    while (true) {
      const chunk = await reader.read();

      if (chunk.done) {
        break;
      }

      receivedBytes +=
        chunk.value.byteLength;

      if (
        receivedBytes >
        MAX_RESPONSE_BYTES
      ) {
        throw new JiraTriggerError(
          "Jira returned too much issue data."
        );
      }

      result += decoder.decode(
        chunk.value,
        {
          stream: true,
        }
      );
    }

    return result + decoder.decode();
  } finally {
    await reader
      .cancel()
      .catch(() => undefined);
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

function providerError(
  body: string
): string {
  try {
    const parsed = record(
      JSON.parse(body)
    );

    if (!parsed) {
      return "";
    }

    const messages: string[] = [];

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
            "string" &&
          message.trim()
        ) {
          messages.push(
            message.trim()
          );
        }
      }
    }

    const errors = record(
      parsed.errors
    );

    if (errors) {
      for (
        const value of
        Object.values(errors)
      ) {
        if (
          typeof value ===
            "string" &&
          value.trim()
        ) {
          messages.push(
            value.trim()
          );
        }
      }
    }

    if (
      typeof parsed.message ===
        "string" &&
      parsed.message.trim()
    ) {
      messages.push(
        parsed.message.trim()
      );
    }

    return messages
      .join(" ")
      .slice(0, 500);
  } catch {
    return "";
  }
}

function jiraSearchUrl(
  siteUrl: string
): string {
  const normalizedSiteUrl =
    normalizeJiraSiteUrl(siteUrl);

  return new URL(
    "/rest/api/3/search/jql",
    `${normalizedSiteUrl}/`
  ).toString();
}

async function requestJiraIssues({
  siteUrl,
  email,
  apiToken,
  body,
}: {
  siteUrl: string;
  email: string;
  apiToken: string;
  body: Record<string, unknown>;
}): Promise<Response> {
  const authorization =
    Buffer.from(
      `${email}:${apiToken}`,
      "utf8"
    ).toString("base64");

  try {
    return await fetch(
      jiraSearchUrl(siteUrl),
      {
        method: "POST",
        headers: {
          Authorization:
            `Basic ${authorization}`,
          Accept:
            "application/json",
          "Content-Type":
            "application/json",
          "User-Agent":
            "Synapse-Workflow/1.0",
        },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(
          REQUEST_TIMEOUT_MS
        ),
      }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name ===
        "TimeoutError" ||
        error.name ===
          "AbortError")
    ) {
      throw new JiraTriggerError(
        "Jira trigger polling timed out."
      );
    }

    if (
      error instanceof
      JiraTriggerError
    ) {
      throw error;
    }

    throw new JiraTriggerError(
      "Jira trigger polling failed."
    );
  }
}

function jiraRequestError(
  status: number,
  detail: string
): JiraTriggerError {
  const suffix = detail
    ? `: ${detail}`
    : ".";

  if (
    status === 401 ||
    status === 403
  ) {
    return new JiraTriggerError(
      `Jira rejected the integration credentials or project permissions (${status})${suffix}`
    );
  }

  if (status === 404) {
    return new JiraTriggerError(
      `The Jira site, project, or search endpoint could not be found (${status})${suffix}`
    );
  }

  if (status === 429) {
    return new JiraTriggerError(
      `Jira rate-limited trigger polling (${status})${suffix}`
    );
  }

  return new JiraTriggerError(
    `Jira issue polling failed (${status})${suffix}`
  );
}

export const jiraTriggerHandler: IntegrationTriggerHandler =
  {
    type: "JIRA_NEW_ISSUE",
    provider: "JIRA",

    async poll({
      workflowId,
      activatedAt,
      configuration,
      cursor,
    }) {
      const parsedConfiguration =
        parseJiraTriggerConfiguration(
          {
            label: "Jira trigger",
            configuration,
          }
        );

      const integration =
        await resolveWorkflowIntegration(
          {
            workflowId,
            integrationId:
              parsedConfiguration.integrationId,
            provider: "JIRA",
          }
        );

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

      const activeCursor =
        parseJiraTriggerCursor(
          cursor
        ) ??
        createJiraTriggerCursor(
          parsedConfiguration,
          activatedAt
        );

      const pollingWindow =
        jiraIssueSearchRequest({
          configuration:
            parsedConfiguration,
          cursor: activeCursor,
          now: new Date(),
        });

      const response =
        await requestJiraIssues({
          siteUrl,
          email,
          apiToken,
          body: pollingWindow.body,
        });

      const responseBody =
        await readLimitedBody(
          response
        );

      if (!response.ok) {
        throw jiraRequestError(
          response.status,
          providerError(
            responseBody
          )
        );
      }

      const searchPage =
        parseJiraIssueSearchPage(
          responseBody
        );

      const detected =
        processJiraIssuesPage({
          issues:
            searchPage.issues,
          nextPageToken:
            searchPage.nextPageToken,
          configuration:
            parsedConfiguration,
          windowStartMs:
            pollingWindow.windowStartMs,
          windowEndMs:
            pollingWindow.windowEndMs,
          page:
            pollingWindow.page,
        });

      return {
        ...detected,
        pollIntervalMinutes:
          parsedConfiguration.pollIntervalMinutes,
      };
    },
  };