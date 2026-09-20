export const integrationProviderValues = [
  "OPENAI",
  "ANTHROPIC",
  "GEMINI",
  "GROQ",
  "DEEPSEEK",
  "OPENROUTER",
  "SLACK",
  "DISCORD",
  "TELEGRAM",
  "MICROSOFT_TEAMS",
  "GMAIL",
  "GOOGLE_SHEETS",
  "GOOGLE_CALENDAR",
  "AIRTABLE",
  "GITHUB",
  "STRIPE",
  "RESEND",
  "CUSTOM_API",
] as const;

export type IntegrationProvider =
  (typeof integrationProviderValues)[number];

export type IntegrationCategory =
  | "AI"
  | "COMMUNICATION"
  | "PRODUCTIVITY"
  | "DATA"
  | "DEVELOPMENT"
  | "PAYMENTS"
  | "EMAIL"
  | "GENERIC";

export type IntegrationAuthStrategy =
  | "API_KEY"
  | "WEBHOOK"
  | "BOT_TOKEN"
  | "OAUTH2"
  | "SIGNING_SECRET"
  | "CUSTOM";

export type IntegrationCapability =
  | "AI_GENERATE"
  | "AI_CLASSIFY"
  | "AI_EXTRACT"
  | "SEND_MESSAGE"
  | "MESSAGE_TRIGGER"
  | "APPROVAL"
  | "SEND_EMAIL"
  | "EMAIL_TRIGGER"
  | "ROW_TRIGGER"
  | "APPEND_ROW"
  | "EVENT_TRIGGER"
  | "CREATE_EVENT"
  | "RECORD_TRIGGER"
  | "CREATE_RECORD"
  | "ISSUE_TRIGGER"
  | "CREATE_ISSUE"
  | "PAYMENT_TRIGGER"
  | "CUSTOM_HTTP";

export type IntegrationProviderDefinition = {
  provider: IntegrationProvider;
  label: string;
  category: IntegrationCategory;
  authStrategy: IntegrationAuthStrategy;
  capabilities: readonly IntegrationCapability[];
  availability: "ACTIVE" | "PLANNED";
};

const aiCapabilities = [
  "AI_GENERATE",
  "AI_CLASSIFY",
  "AI_EXTRACT",
] as const satisfies readonly IntegrationCapability[];

export const integrationProviderRegistry = {
  OPENAI: {
    provider: "OPENAI",
    label: "OpenAI",
    category: "AI",
    authStrategy: "API_KEY",
    capabilities: aiCapabilities,
    availability: "PLANNED",
  },
  ANTHROPIC: {
    provider: "ANTHROPIC",
    label: "Anthropic",
    category: "AI",
    authStrategy: "API_KEY",
    capabilities: aiCapabilities,
    availability: "PLANNED",
  },
  GEMINI: {
    provider: "GEMINI",
    label: "Google Gemini",
    category: "AI",
    authStrategy: "API_KEY",
    capabilities: aiCapabilities,
    availability: "PLANNED",
  },
  GROQ: {
    provider: "GROQ",
    label: "Groq",
    category: "AI",
    authStrategy: "API_KEY",
    capabilities: aiCapabilities,
    availability: "PLANNED",
  },
  DEEPSEEK: {
    provider: "DEEPSEEK",
    label: "DeepSeek",
    category: "AI",
    authStrategy: "API_KEY",
    capabilities: aiCapabilities,
    availability: "PLANNED",
  },
  OPENROUTER: {
    provider: "OPENROUTER",
    label: "OpenRouter",
    category: "AI",
    authStrategy: "API_KEY",
    capabilities: aiCapabilities,
    availability: "PLANNED",
  },
  SLACK: {
    provider: "SLACK",
    label: "Slack",
    category: "COMMUNICATION",
    authStrategy: "WEBHOOK",
    capabilities: [
      "SEND_MESSAGE",
      "APPROVAL",
    ],
    availability: "ACTIVE",
  },
  DISCORD: {
    provider: "DISCORD",
    label: "Discord",
    category: "COMMUNICATION",
    authStrategy: "WEBHOOK",
    capabilities: [
      "SEND_MESSAGE",
      "APPROVAL",
    ],
    availability: "ACTIVE",
  },
  TELEGRAM: {
    provider: "TELEGRAM",
    label: "Telegram",
    category: "COMMUNICATION",
    authStrategy: "BOT_TOKEN",
    capabilities: [
      "MESSAGE_TRIGGER",
      "SEND_MESSAGE",
      "APPROVAL",
    ],
    availability: "PLANNED",
  },
  MICROSOFT_TEAMS: {
    provider: "MICROSOFT_TEAMS",
    label: "Microsoft Teams",
    category: "COMMUNICATION",
    authStrategy: "WEBHOOK",
    capabilities: ["SEND_MESSAGE"],
    availability: "PLANNED",
  },
  GMAIL: {
    provider: "GMAIL",
    label: "Gmail",
    category: "EMAIL",
    authStrategy: "OAUTH2",
    capabilities: [
      "EMAIL_TRIGGER",
      "SEND_EMAIL",
    ],
    availability: "PLANNED",
  },
  GOOGLE_SHEETS: {
    provider: "GOOGLE_SHEETS",
    label: "Google Sheets",
    category: "PRODUCTIVITY",
    authStrategy: "OAUTH2",
    capabilities: [
      "ROW_TRIGGER",
      "APPEND_ROW",
    ],
    availability: "PLANNED",
  },
  GOOGLE_CALENDAR: {
    provider: "GOOGLE_CALENDAR",
    label: "Google Calendar",
    category: "PRODUCTIVITY",
    authStrategy: "OAUTH2",
    capabilities: [
      "EVENT_TRIGGER",
      "CREATE_EVENT",
    ],
    availability: "PLANNED",
  },
  AIRTABLE: {
    provider: "AIRTABLE",
    label: "Airtable",
    category: "DATA",
    authStrategy: "API_KEY",
    capabilities: [
      "RECORD_TRIGGER",
      "CREATE_RECORD",
    ],
    availability: "PLANNED",
  },
  GITHUB: {
    provider: "GITHUB",
    label: "GitHub",
    category: "DEVELOPMENT",
    authStrategy: "OAUTH2",
    capabilities: [
      "ISSUE_TRIGGER",
      "CREATE_ISSUE",
    ],
    availability: "PLANNED",
  },
  STRIPE: {
    provider: "STRIPE",
    label: "Stripe",
    category: "PAYMENTS",
    authStrategy: "SIGNING_SECRET",
    capabilities: ["PAYMENT_TRIGGER"],
    availability: "PLANNED",
  },
  RESEND: {
    provider: "RESEND",
    label: "Resend",
    category: "EMAIL",
    authStrategy: "API_KEY",
    capabilities: ["SEND_EMAIL"],
    availability: "PLANNED",
  },
  CUSTOM_API: {
    provider: "CUSTOM_API",
    label: "Custom API",
    category: "GENERIC",
    authStrategy: "CUSTOM",
    capabilities: ["CUSTOM_HTTP"],
    availability: "PLANNED",
  },
} as const satisfies Record<
  IntegrationProvider,
  IntegrationProviderDefinition
>;

export function getIntegrationProvider(
  provider: IntegrationProvider
): IntegrationProviderDefinition {
  return integrationProviderRegistry[
    provider
  ];
}

export function providerSupportsCapability(
  provider: IntegrationProvider,
  capability: IntegrationCapability
): boolean {
  return getIntegrationProvider(
    provider
  ).capabilities.includes(
    capability
  );
}
