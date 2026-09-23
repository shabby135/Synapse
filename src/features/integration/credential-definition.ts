import type {
  IntegrationCredentials,
} from "./credential-codec";
import {
  IntegrationCredentialError,
  maskCredentialValue,
} from "./credential-codec";
import type {
  IntegrationProvider,
} from "./provider-registry";

export type CredentialFieldDefinition = {
  key: string;
  label: string;
  required: boolean;
  secret: boolean;
  format: "TEXT" | "HTTPS_URL";
};

const apiKeyFields = [
  {
    key: "apiKey",
    label: "API key",
    required: true,
    secret: true,
    format: "TEXT",
  },
] as const satisfies readonly CredentialFieldDefinition[];

const webhookFields = [
  {
    key: "webhookUrl",
    label: "Webhook URL",
    required: true,
    secret: true,
    format: "HTTPS_URL",
  },
] as const satisfies readonly CredentialFieldDefinition[];

const googleOAuthFields = [
  {
    key: "accessToken",
    label: "Access token",
    required: true,
    secret: true,
    format: "TEXT",
  },
  {
    key: "refreshToken",
    label: "Refresh token",
    required: true,
    secret: true,
    format: "TEXT",
  },
] as const satisfies readonly CredentialFieldDefinition[];

export const providerCredentialFields = {
  OPENAI: apiKeyFields,
  ANTHROPIC: apiKeyFields,
  GEMINI: apiKeyFields,
  GROQ: apiKeyFields,
  DEEPSEEK: apiKeyFields,
  OPENROUTER: apiKeyFields,
  SLACK: webhookFields,
  DISCORD: webhookFields,
  TELEGRAM: [
    {
      key: "botToken",
      label: "Bot token",
      required: true,
      secret: true,
      format: "TEXT",
    },
  ],
  MICROSOFT_TEAMS: webhookFields,
  GMAIL: googleOAuthFields,
  GOOGLE_SHEETS: googleOAuthFields,
  GOOGLE_CALENDAR: googleOAuthFields,
  AIRTABLE: apiKeyFields,
  GITHUB: [
    {
      key: "accessToken",
      label: "Access token",
      required: true,
      secret: true,
      format: "TEXT",
    },
    {
      key: "refreshToken",
      label: "Refresh token",
      required: false,
      secret: true,
      format: "TEXT",
    },
  ],
  TRELLO: [
    {
      key: "apiKey",
      label: "API key",
      required: true,
      secret: true,
      format: "TEXT",
    },
    {
      key: "apiToken",
      label: "API token",
      required: true,
      secret: true,
      format: "TEXT",
    },
  ],
  STRIPE: [
    {
      key: "secretKey",
      label: "Secret key",
      required: true,
      secret: true,
      format: "TEXT",
    },
    {
      key: "webhookSecret",
      label: "Webhook signing secret",
      required: true,
      secret: true,
      format: "TEXT",
    },
  ],
  RESEND: apiKeyFields,
  CUSTOM_API: [
    {
      key: "baseUrl",
      label: "Base URL",
      required: true,
      secret: false,
      format: "HTTPS_URL",
    },
    {
      key: "authHeader",
      label: "Authorization header",
      required: false,
      secret: false,
      format: "TEXT",
    },
    {
      key: "token",
      label: "Token",
      required: false,
      secret: true,
      format: "TEXT",
    },
  ],
} as const satisfies Record<
  IntegrationProvider,
  readonly CredentialFieldDefinition[]
>;

function validateHttpsUrl(
  value: string,
  label: string
) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new IntegrationCredentialError(
      `${label} must be a valid URL.`
    );
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password
  ) {
    throw new IntegrationCredentialError(
      `${label} must use HTTPS and cannot contain embedded credentials.`
    );
  }
}

function validateWebhookUrl(
  provider: IntegrationProvider,
  value: string
) {
  if (
    provider !== "SLACK" &&
    provider !== "DISCORD"
  ) {
    return;
  }

  const url = new URL(value);
  const hostname =
    url.hostname.toLowerCase();

  if (provider === "SLACK") {
    const validHost = new Set([
      "hooks.slack.com",
      "hooks.slack-gov.com",
    ]).has(hostname);
    const validPath =
      /^\/services\/[^/]+\/[^/]+\/[^/]+\/?$/.test(
        url.pathname
      );

    if (!validHost || !validPath) {
      throw new IntegrationCredentialError(
        "Enter a valid Slack incoming-webhook URL."
      );
    }
  }

  if (provider === "DISCORD") {
    const validHost = new Set([
      "discord.com",
      "discordapp.com",
      "canary.discord.com",
      "ptb.discord.com",
    ]).has(hostname);
    const validPath =
      /^\/api(?:\/v\d+)?\/webhooks\/\d+\/[^/]+\/?$/.test(
        url.pathname
      );

    if (!validHost || !validPath) {
      throw new IntegrationCredentialError(
        "Enter a valid Discord webhook URL."
      );
    }
  }
}

function validateTrelloCredential(
  provider: IntegrationProvider,
  key: string,
  value: string
) {
  if (provider !== "TRELLO") {
    return;
  }

  const maximumLength =
    key === "apiKey" ? 128 : 512;

  if (
    value.length < 16 ||
    value.length > maximumLength ||
    !/^[A-Za-z0-9_-]+$/u.test(value)
  ) {
    throw new IntegrationCredentialError(
      key === "apiKey"
        ? "Enter a valid Trello API key."
        : "Enter a valid Trello API token."
    );
  }
}

export function validateProviderCredentials(
  provider: IntegrationProvider,
  credentials: IntegrationCredentials
): IntegrationCredentials {
  const definitions =
    providerCredentialFields[provider] as readonly CredentialFieldDefinition[];

  const allowedKeys = new Set(
    definitions.map(
      (definition) => definition.key
    )
  );

  for (const key of Object.keys(
    credentials
  )) {
    if (!allowedKeys.has(key)) {
      throw new IntegrationCredentialError(
        `${key} is not a supported credential field for ${provider}.`
      );
    }
  }

  for (const definition of definitions) {
    const value =
      credentials[definition.key];

    if (
      definition.required &&
      !value
    ) {
      throw new IntegrationCredentialError(
        `${definition.label} is required for ${provider}.`
      );
    }

    if (
      value &&
      definition.format ===
        "HTTPS_URL"
    ) {
      validateHttpsUrl(
        value,
        definition.label
      );

      if (
        definition.key ===
        "webhookUrl"
      ) {
        validateWebhookUrl(
          provider,
          value
        );
      }
    }

    if (value) {
      validateTrelloCredential(
        provider,
        definition.key,
        value
      );
    }
  }

  return credentials;
}

export type CredentialPreview = {
  key: string;
  label: string;
  configured: boolean;
  displayValue: string | null;
};

export function readCredentialPreview(
  metadata: unknown
): CredentialPreview[] {
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    !("credentialPreview" in metadata) ||
    !Array.isArray(
      metadata.credentialPreview
    )
  ) {
    return [];
  }

  return metadata.credentialPreview.filter(
    (
      value
    ): value is CredentialPreview =>
      typeof value === "object" &&
      value !== null &&
      "key" in value &&
      typeof value.key === "string" &&
      "label" in value &&
      typeof value.label === "string" &&
      "configured" in value &&
      typeof value.configured ===
        "boolean" &&
      "displayValue" in value &&
      (typeof value.displayValue ===
        "string" ||
        value.displayValue === null)
  );
}

export function createCredentialPreview(
  provider: IntegrationProvider,
  credentials: IntegrationCredentials
): CredentialPreview[] {
  const validated =
    validateProviderCredentials(
      provider,
      credentials
    );

  return (
    providerCredentialFields[
      provider
    ] as readonly CredentialFieldDefinition[]
  ).map((definition) => {
    const value =
      validated[definition.key];

    return {
      key: definition.key,
      label: definition.label,
      configured: Boolean(value),
      displayValue: value
        ? definition.secret
          ? maskCredentialValue(value)
          : value
        : null,
    };
  });
}
