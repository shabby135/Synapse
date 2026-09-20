import type {
  IntegrationCredentials,
} from "./credential-codec";
import type {
  IntegrationProvider,
} from "./provider-registry";

export type ConnectionTestStatus =
  | "CONNECTED"
  | "INVALID_CREDENTIALS"
  | "PROVIDER_UNAVAILABLE";

export type ConnectionTestResult = {
  status: ConnectionTestStatus;
  externalAccountId?: string;
  externalAccountName?: string;
  metadata?: Record<
    string,
    unknown
  >;
  message?: string;
};

export type ConnectionTestContext = {
  provider: IntegrationProvider;
  credentials: IntegrationCredentials;
  signal: AbortSignal;
};

export type IntegrationConnectionTester =
  (
    context: ConnectionTestContext
  ) => Promise<ConnectionTestResult>;

export function defineConnectionTester(
  provider: IntegrationProvider,
  tester: IntegrationConnectionTester
): IntegrationConnectionTester {
  return async (context) => {
    if (
      context.provider !== provider
    ) {
      throw new Error(
        `Connection tester for ${provider} cannot test ${context.provider}.`
      );
    }

    return tester(context);
  };
}
