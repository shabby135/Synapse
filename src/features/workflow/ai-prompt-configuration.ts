import type {
  WorkflowNodeData,
} from "./types";

export type AiProvider =
  | "OPENAI"
  | "GEMINI"
  | "CLAUDE";

export type AiPromptConfiguration = {
  provider: AiProvider;
  model: string;
  systemPrompt: string;
  prompt: string;
  maxOutputTokens: number;
};

const DEFAULT_MODELS: Record<
  AiProvider,
  string
> = {
  OPENAI: "gpt-4.1-mini",
  GEMINI: "gemini-3.8-flash",
  CLAUDE:
    "claude-haiku-4-5-20251001",
};

const LEGACY_GEMINI_MODELS =
  new Set([
    "gemini-2.5-flash",
    "gemini-3-flash-preview",
  ]);

const DEFAULT_MAX_OUTPUT_TOKENS =
  1_000;

const MAX_PROMPT_LENGTH = 20_000;
const MAX_SYSTEM_PROMPT_LENGTH =
  10_000;

export class AiPromptActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiPromptActionError";
  }
}

function readString(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value.trim()
    : fallback;
}

function resolveProvider(
  provider: unknown,
  model: unknown
): AiProvider {
  if (
    provider === "OPENAI" ||
    provider === "GEMINI" ||
    provider === "CLAUDE"
  ) {
    return provider;
  }

  if (typeof model === "string") {
    const normalizedModel =
      model.trim().toLowerCase();

    if (
      normalizedModel.startsWith(
        "gpt-"
      ) ||
      normalizedModel.startsWith("o")
    ) {
      return "OPENAI";
    }

    if (
      normalizedModel.startsWith(
        "claude-"
      )
    ) {
      return "CLAUDE";
    }

    if (
      normalizedModel.startsWith(
        "gemini-"
      )
    ) {
      return "GEMINI";
    }
  }

  return "GEMINI";
}

function resolveModel(
  provider: AiProvider,
  model: unknown
): string {
  const configuredModel = readString(
    model,
    DEFAULT_MODELS[provider]
  );

  if (
    provider === "GEMINI" &&
    LEGACY_GEMINI_MODELS.has(
      configuredModel
    )
  ) {
    return DEFAULT_MODELS.GEMINI;
  }

  return configuredModel;
}

function readNumber(
  value: unknown,
  fallback: number
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

export function parseAiPromptConfiguration(
  data: WorkflowNodeData
): AiPromptConfiguration {
  const configuration =
    data.configuration ?? {};

  const provider = resolveProvider(
    configuration.provider,
    configuration.model
  );

  const model = resolveModel(
    provider,
    configuration.model
  );

  const systemPrompt = readString(
    configuration.systemPrompt
  );

  const prompt = readString(
    configuration.prompt
  );

  const maxOutputTokens = readNumber(
    configuration.maxOutputTokens,
    DEFAULT_MAX_OUTPUT_TOKENS
  );

  if (!model) {
    throw new AiPromptActionError(
      "The AI model is required."
    );
  }

  if (model.length > 100) {
    throw new AiPromptActionError(
      "The AI model name is too long."
    );
  }

  if (!prompt) {
    throw new AiPromptActionError(
      "The AI prompt is required."
    );
  }

  if (
    prompt.length > MAX_PROMPT_LENGTH
  ) {
    throw new AiPromptActionError(
      `The AI prompt cannot exceed ${MAX_PROMPT_LENGTH} characters.`
    );
  }

  if (
    systemPrompt.length >
    MAX_SYSTEM_PROMPT_LENGTH
  ) {
    throw new AiPromptActionError(
      `System instructions cannot exceed ${MAX_SYSTEM_PROMPT_LENGTH} characters.`
    );
  }

  if (
    !Number.isInteger(
      maxOutputTokens
    ) ||
    maxOutputTokens < 1 ||
    maxOutputTokens > 16_000
  ) {
    throw new AiPromptActionError(
      "Maximum output tokens must be an integer between 1 and 16000."
    );
  }

  return {
    provider,
    model,
    systemPrompt,
    prompt,
    maxOutputTokens,
  };
}