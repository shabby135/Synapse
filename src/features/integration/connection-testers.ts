import "server-only";

import {
  apiKeyProviderValues,
  classifyApiKeyTestStatus,
  createApiKeyTestRequest,
  type ApiKeyProvider,
} from "./api-key-provider";
import {
  defineConnectionTester,
  type ConnectionTestResult,
  type IntegrationConnectionTester,
} from "./connection-test";
import type {
  IntegrationCredentials,
} from "./credential-codec";
import {
  validateProviderCredentials,
} from "./credential-definition";
import type {
  IntegrationProvider,
} from "./provider-registry";
import {
  classifyTrelloStatus,
  createTrelloConnectionRequest,
  parseTrelloMember,
} from "./trello-connection";

const TEST_TIMEOUT_MS = 15_000;
const MAX_TRELLO_RESPONSE_BYTES =
  64_000;

async function readBoundedBody(
  response: Response,
  maximumBytes: number
): Promise<string | null> {
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

      if (bytes > maximumBytes) {
        return null;
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

function apiKeyTester(
  provider: ApiKeyProvider
): IntegrationConnectionTester {
  return defineConnectionTester(
    provider,
    async ({
      credentials,
      signal,
    }) => {
      const apiKey = credentials.apiKey;

      if (!apiKey) {
        return {
          status:
            "INVALID_CREDENTIALS",
          message: "API key is missing.",
        };
      }

      const request =
        createApiKeyTestRequest({
          provider,
          apiKey,
          signal,
        });
      let response: Response;

      try {
        response = await fetch(
          request.url,
          request.init
        );
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name ===
            "AbortError" ||
            error.name ===
              "TimeoutError")
        ) {
          return {
            status:
              "PROVIDER_UNAVAILABLE",
            message:
              "Connection test timed out.",
          };
        }

        return {
          status:
            "PROVIDER_UNAVAILABLE",
          message:
            "The provider could not be reached.",
        };
      }

      await response.body
        ?.cancel()
        .catch(() => undefined);

      return classifyApiKeyTestStatus(
        response.status
      );
    }
  );
}

function webhookTester(
  provider: "SLACK" | "DISCORD"
): IntegrationConnectionTester {
  return defineConnectionTester(
    provider,
    async ({
      credentials,
      signal,
    }) => {
      const webhookUrl =
        credentials.webhookUrl;

      if (!webhookUrl) {
        return {
          status:
            "INVALID_CREDENTIALS",
          message:
            "Webhook URL is missing.",
        };
      }

      const body =
        provider === "SLACK"
          ? {
              text: "Synapse connection test succeeded.",
            }
          : {
              content:
                "Synapse connection test succeeded.",
              allowed_mentions: {
                parse: [],
              },
            };

      let response: Response;

      try {
        response = await fetch(
          webhookUrl,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              "User-Agent":
                "Synapse-Connection-Test/1.0",
            },
            body: JSON.stringify(body),
            redirect: "error",
            signal,
          }
        );
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name ===
            "AbortError" ||
            error.name ===
              "TimeoutError")
        ) {
          return {
            status:
              "PROVIDER_UNAVAILABLE",
            message:
              "Connection test timed out.",
          };
        }

        return {
          status:
            "PROVIDER_UNAVAILABLE",
          message:
            "The provider could not be reached.",
        };
      }

      await response.body
        ?.cancel()
        .catch(() => undefined);

      if (response.ok) {
        return {
          status: "CONNECTED",
        };
      }

      if (
        response.status === 400 ||
        response.status === 401 ||
        response.status === 403 ||
        response.status === 404
      ) {
        return {
          status:
            "INVALID_CREDENTIALS",
          message:
            "The provider rejected these credentials.",
        };
      }

      return {
        status:
          "PROVIDER_UNAVAILABLE",
        message: `The provider returned status ${response.status}.`,
      };
    }
  );
}

const trelloTester =
  defineConnectionTester(
    "TRELLO",
    async ({
      credentials,
      signal,
    }) => {
      const apiKey = credentials.apiKey;
      const apiToken =
        credentials.apiToken;

      if (!apiKey || !apiToken) {
        return {
          status:
            "INVALID_CREDENTIALS",
          message:
            "Trello API key and token are required.",
        };
      }

      const request =
        createTrelloConnectionRequest({
          apiKey,
          apiToken,
          signal,
        });
      let response: Response;

      try {
        response = await fetch(
          request.url,
          request.init
        );
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name ===
            "AbortError" ||
            error.name ===
              "TimeoutError")
        ) {
          return {
            status:
              "PROVIDER_UNAVAILABLE",
            message:
              "Trello connection test timed out.",
          };
        }

        return {
          status:
            "PROVIDER_UNAVAILABLE",
          message:
            "Trello could not be reached.",
        };
      }

      const body = await readBoundedBody(
        response,
        MAX_TRELLO_RESPONSE_BYTES
      );

      if (body === null) {
        return {
          status:
            "PROVIDER_UNAVAILABLE",
          message:
            "Trello returned an unexpectedly large response.",
        };
      }

      if (!response.ok) {
        return classifyTrelloStatus(
          response.status
        );
      }

      try {
        const member =
          parseTrelloMember(body);

        return {
          status: "CONNECTED",
          externalAccountId: member.id,
          externalAccountName:
            member.fullName
              ? `${member.fullName} (@${member.username})`
              : `@${member.username}`,
          metadata: {
            username: member.username,
            fullName: member.fullName,
          },
        };
      } catch (error) {
        return {
          status:
            "PROVIDER_UNAVAILABLE",
          message:
            error instanceof Error
              ? error.message
              : "Trello returned an invalid response.",
        };
      }
    }
  );

const testers = {
  ...Object.fromEntries(
    apiKeyProviderValues.map(
      (provider) => [
        provider,
        apiKeyTester(provider),
      ]
    )
  ),
  SLACK: webhookTester("SLACK"),
  DISCORD: webhookTester("DISCORD"),
  TRELLO: trelloTester,
} as Partial<
  Record<
    IntegrationProvider,
    IntegrationConnectionTester
  >
>;

export function canTestConnection(
  provider: IntegrationProvider
): boolean {
  return provider in testers;
}

export async function testIntegrationConnection({
  provider,
  credentials,
}: {
  provider: IntegrationProvider;
  credentials: IntegrationCredentials;
}): Promise<ConnectionTestResult> {
  const tester = testers[
    provider as keyof typeof testers
  ] as
    | IntegrationConnectionTester
    | undefined;

  if (!tester) {
    return {
      status: "PROVIDER_UNAVAILABLE",
      message:
        "Connection testing is not implemented for this provider yet.",
    };
  }

  const validated =
    validateProviderCredentials(
      provider,
      credentials
    );
  const controller =
    new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TEST_TIMEOUT_MS
  );

  try {
    return await tester({
      provider,
      credentials: validated,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
