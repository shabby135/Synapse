import type {
  ConnectionTestResult,
} from "./connection-test";
import type {
  IntegrationProvider,
} from "./provider-registry";

export const apiKeyProviderValues = [
  "OPENAI",
  "ANTHROPIC",
  "GEMINI",
  "GROQ",
  "DEEPSEEK",
  "OPENROUTER",
] as const satisfies readonly IntegrationProvider[];

export type ApiKeyProvider =
  (typeof apiKeyProviderValues)[number];

type ApiKeyHeader =
  | "BEARER"
  | "X_API_KEY"
  | "X_GOOG_API_KEY";

export type ApiKeyProviderTestDefinition = {
  provider: ApiKeyProvider;
  url: string;
  authHeader: ApiKeyHeader;
  headers?: Readonly<
    Record<string, string>
  >;
};

export type ApiKeyTestRequest = {
  url: string;
  init: RequestInit;
};

export const apiKeyProviderTestRegistry = {
  OPENAI: {
    provider: "OPENAI",
    url: "https://api.openai.com/v1/models?limit=1",
    authHeader: "BEARER",
  },
  ANTHROPIC: {
    provider: "ANTHROPIC",
    url: "https://api.anthropic.com/v1/models?limit=1",
    authHeader: "X_API_KEY",
    headers: {
      "anthropic-version": "2023-06-01",
    },
  },
  GEMINI: {
    provider: "GEMINI",
    url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
    authHeader: "X_GOOG_API_KEY",
  },
  GROQ: {
    provider: "GROQ",
    url: "https://api.groq.com/openai/v1/models",
    authHeader: "BEARER",
  },
  DEEPSEEK: {
    provider: "DEEPSEEK",
    url: "https://api.deepseek.com/models",
    authHeader: "BEARER",
  },
  OPENROUTER: {
    provider: "OPENROUTER",
    url: "https://openrouter.ai/api/v1/auth/key",
    authHeader: "BEARER",
  },
} as const satisfies Record<
  ApiKeyProvider,
  ApiKeyProviderTestDefinition
>;

export function isApiKeyProvider(
  provider: IntegrationProvider
): provider is ApiKeyProvider {
  return (
    apiKeyProviderValues as readonly IntegrationProvider[]
  ).includes(provider);
}

export function createApiKeyTestRequest({
  provider,
  apiKey,
  signal,
}: {
  provider: ApiKeyProvider;
  apiKey: string;
  signal?: AbortSignal;
}): ApiKeyTestRequest {
  const definition: ApiKeyProviderTestDefinition =
    apiKeyProviderTestRegistry[
      provider
    ];
  const headers = new Headers({
    Accept: "application/json",
    "User-Agent":
      "Synapse-Connection-Test/1.0",
    ...definition.headers,
  });

  if (
    definition.authHeader ===
    "BEARER"
  ) {
    headers.set(
      "Authorization",
      `Bearer ${apiKey}`
    );
  }

  if (
    definition.authHeader ===
    "X_API_KEY"
  ) {
    headers.set("x-api-key", apiKey);
  }

  if (
    definition.authHeader ===
    "X_GOOG_API_KEY"
  ) {
    headers.set(
      "x-goog-api-key",
      apiKey
    );
  }

  return {
    url: definition.url,
    init: {
      method: "GET",
      headers,
      redirect: "error",
      cache: "no-store",
      signal,
    },
  };
}

export function classifyApiKeyTestStatus(
  status: number
): ConnectionTestResult {
  if (
    (status >= 200 && status < 300) ||
    status === 429
  ) {
    return {
      status: "CONNECTED",
      metadata:
        status === 429
          ? {
              verification:
                "RATE_LIMITED",
            }
          : undefined,
    };
  }

  if (
    status === 400 ||
    status === 401 ||
    status === 403
  ) {
    return {
      status: "INVALID_CREDENTIALS",
      message:
        "The provider rejected this API key.",
    };
  }

  return {
    status: "PROVIDER_UNAVAILABLE",
    message: `The provider returned status ${status}.`,
  };
}

