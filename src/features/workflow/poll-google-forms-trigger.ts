import "server-only";

import {
  resolveWorkflowIntegration,
  WorkflowIntegrationError,
} from "@/features/integration/resolve-workflow-integration";

import {
  createGoogleFormsTriggerCursor,
  googleFormsResponseListRequest,
  GoogleFormsTriggerError,
  parseGoogleFormsDefinition,
  parseGoogleFormsResponsePage,
  parseGoogleFormsTriggerConfiguration,
  parseGoogleFormsTriggerCursor,
  processGoogleFormsResponsePage,
} from "./google-forms-trigger-configuration";
import type {
  IntegrationTriggerHandler,
} from "./integration-trigger-registry";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_FORM_RESPONSE_BYTES =
  2_000_000;
const MAX_RESPONSES_RESPONSE_BYTES =
  4_000_000;

async function readLimitedBody(
  response: Response,
  maximumBytes: number,
  resource: string
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
        receivedBytes > maximumBytes
      ) {
        throw new GoogleFormsTriggerError(
          `Google Forms returned too much ${resource} data.`
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
    const error = record(
      parsed?.error
    );

    if (
      typeof error?.message ===
        "string" &&
      error.message.trim()
    ) {
      return error.message
        .trim()
        .slice(0, 500);
    }

    return "";
  } catch {
    return "";
  }
}

function googleFormsRequestError(
  status: number,
  detail: string,
  resource: "form" | "responses"
): GoogleFormsTriggerError {
  const suffix = detail
    ? `: ${detail}`
    : ".";

  if (
    status === 401 ||
    status === 403
  ) {
    return new GoogleFormsTriggerError(
      `Google Forms rejected the integration credentials or ${resource} permissions (${status})${suffix}`
    );
  }

  if (status === 404) {
    return new GoogleFormsTriggerError(
      `The configured Google Form could not be found or is not accessible (${status})${suffix}`
    );
  }

  if (status === 429) {
    return new GoogleFormsTriggerError(
      `Google Forms rate-limited trigger polling (${status})${suffix}`
    );
  }

  return new GoogleFormsTriggerError(
    `Google Forms ${resource} polling failed (${status})${suffix}`
  );
}

async function requestGoogleForms({
  url,
  accessToken,
  resource,
}: {
  url: string;
  accessToken: string;
  resource: "form" | "responses";
}): Promise<Response> {
  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        Accept: "application/json",
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
      (error.name ===
        "TimeoutError" ||
        error.name ===
          "AbortError")
    ) {
      throw new GoogleFormsTriggerError(
        `Google Forms ${resource} polling timed out.`
      );
    }

    if (
      error instanceof
      GoogleFormsTriggerError
    ) {
      throw error;
    }

    throw new GoogleFormsTriggerError(
      `Google Forms ${resource} polling failed.`
    );
  }
}

function formDefinitionUrl(
  formId: string
): string {
  return (
    "https://forms.googleapis.com/v1/forms/" +
    encodeURIComponent(formId)
  );
}

function formResponsesUrl({
  formId,
  filter,
  pageSize,
  pageToken,
}: {
  formId: string;
  filter: string;
  pageSize: number;
  pageToken?: string;
}): string {
  const url = new URL(
    `https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}/responses`
  );

  url.searchParams.set(
    "filter",
    filter
  );

  url.searchParams.set(
    "pageSize",
    String(pageSize)
  );

  if (pageToken) {
    url.searchParams.set(
      "pageToken",
      pageToken
    );
  }

  return url.toString();
}

export const googleFormsTriggerHandler: IntegrationTriggerHandler =
  {
    type:
      "GOOGLE_FORMS_NEW_RESPONSE",
    provider: "GOOGLE_FORMS",

    async poll({
      workflowId,
      activatedAt,
      configuration,
      cursor,
    }) {
      const parsedConfiguration =
        parseGoogleFormsTriggerConfiguration(
          {
            label:
              "Google Forms trigger",
            configuration,
          }
        );

      const integration =
        await resolveWorkflowIntegration(
          {
            workflowId,
            integrationId:
              parsedConfiguration.integrationId,
            provider:
              "GOOGLE_FORMS",
          }
        );

      const accessToken =
        integration.credentials.accessToken;

      if (!accessToken) {
        throw new WorkflowIntegrationError(
          "The Google Forms integration does not contain an access token."
        );
      }

      const activeCursor =
        parseGoogleFormsTriggerCursor(
          cursor
        ) ??
        createGoogleFormsTriggerCursor(
          parsedConfiguration,
          activatedAt
        );

      const pollingWindow =
        googleFormsResponseListRequest(
          {
            cursor: activeCursor,
            now: new Date(),
          }
        );

      const definitionResponse =
        await requestGoogleForms({
          url: formDefinitionUrl(
            parsedConfiguration.formId
          ),
          accessToken,
          resource: "form",
        });

      const definitionBody =
        await readLimitedBody(
          definitionResponse,
          MAX_FORM_RESPONSE_BYTES,
          "form"
        );

      if (!definitionResponse.ok) {
        throw googleFormsRequestError(
          definitionResponse.status,
          providerError(
            definitionBody
          ),
          "form"
        );
      }

      const definition =
        parseGoogleFormsDefinition(
          definitionBody,
          parsedConfiguration.formId
        );

      const responsesResponse =
        await requestGoogleForms({
          url: formResponsesUrl({
            formId:
              parsedConfiguration.formId,
            filter:
              pollingWindow.query.filter,
            pageSize:
              pollingWindow.query.pageSize,
            pageToken:
              pollingWindow.query
                .pageToken,
          }),
          accessToken,
          resource: "responses",
        });

      const responsesBody =
        await readLimitedBody(
          responsesResponse,
          MAX_RESPONSES_RESPONSE_BYTES,
          "response"
        );

      if (!responsesResponse.ok) {
        throw googleFormsRequestError(
          responsesResponse.status,
          providerError(
            responsesBody
          ),
          "responses"
        );
      }

      const responsePage =
        parseGoogleFormsResponsePage(
          responsesBody
        );

      const detected =
        processGoogleFormsResponsePage(
          {
            responses:
              responsePage.responses,
            nextPageToken:
              responsePage.nextPageToken,
            configuration:
              parsedConfiguration,
            definition,
            windowStartMs:
              pollingWindow.windowStartMs,
            windowEndMs:
              pollingWindow.windowEndMs,
            page:
              pollingWindow.page,
          }
        );

      return {
        ...detected,
        pollIntervalMinutes:
          parsedConfiguration.pollIntervalMinutes,
      };
    },
  };