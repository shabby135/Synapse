import "server-only";

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

const TEST_TIMEOUT_MS = 15_000;

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

const testers = {
  SLACK: webhookTester("SLACK"),
  DISCORD: webhookTester("DISCORD"),
} satisfies Partial<
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
  const tester =
    testers[
      provider as keyof typeof testers
    ] as
      | IntegrationConnectionTester
      | undefined;

  if (!tester) {
    return {
      status:
        "PROVIDER_UNAVAILABLE",
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