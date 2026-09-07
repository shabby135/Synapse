import "server-only";

import OpenAI from "openai";

import {
  AiPromptActionError,
  parseAiPromptConfiguration,
} from "./ai-prompt-configuration";
import { executeClaudePrompt } from "./execute-claude-prompt";
import { executeGeminiPrompt } from "./execute-gemini-prompt";
import type { WorkflowNodeData } from "./types";

type ExecuteAiPromptOptions = {
  data: WorkflowNodeData;
  input: Record<string, unknown>;
};

const MAX_INPUT_LENGTH = 100_000;
const REQUEST_TIMEOUT_MS = 60_000;

function serializeInput(
  input: Record<string, unknown>
): string {
  let serialized: string | undefined;

  try {
    serialized = JSON.stringify(
      input,
      null,
      2
    );
  } catch {
    throw new AiPromptActionError(
      "The workflow input could not be converted to JSON."
    );
  }

  if (typeof serialized !== "string") {
    throw new AiPromptActionError(
      "The workflow input could not be converted to JSON."
    );
  }

  if (
    serialized.length > MAX_INPUT_LENGTH
  ) {
    throw new AiPromptActionError(
      "The workflow input is too large for an AI prompt."
    );
  }

  return serialized;
}

function buildPrompt(
  prompt: string,
  serializedInput: string
): string {
  if (prompt.includes("{{input}}")) {
    return prompt.replaceAll(
      "{{input}}",
      serializedInput
    );
  }

  return [
    prompt,
    "",
    "Workflow input:",
    serializedInput,
  ].join("\n");
}

export async function executeAiPrompt({
  data,
  input,
}: ExecuteAiPromptOptions): Promise<
  Record<string, unknown>
> {
  const configuration =
    parseAiPromptConfiguration(data);

  const serializedInput =
    serializeInput(input);

  const resolvedPrompt = buildPrompt(
    configuration.prompt,
    serializedInput
  );

  if (
    configuration.provider ===
    "CLAUDE"
  ) {
    return executeClaudePrompt({
      configuration,
      prompt: resolvedPrompt,
    });
  }

  if (
    configuration.provider ===
    "GEMINI"
  ) {
    return executeGeminiPrompt({
      configuration,
      prompt: resolvedPrompt,
    });
  }

  if (
    configuration.provider !==
    "OPENAI"
  ) {
    throw new AiPromptActionError(
      `AI provider ${configuration.provider} is not supported.`
    );
  }

  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new AiPromptActionError(
      "OPENAI_API_KEY is not configured."
    );
  }

  const client = new OpenAI({
    apiKey,
  });

  try {
    const response =
      await client.responses.create(
        {
          model: configuration.model,
          instructions:
            configuration.systemPrompt ||
            undefined,
          input: resolvedPrompt,
          max_output_tokens:
            configuration.maxOutputTokens,
          store: false,
        },
        {
          timeout: REQUEST_TIMEOUT_MS,
        }
      );

    if (
      response.status === "incomplete"
    ) {
      const reason =
        response.incomplete_details
          ?.reason ??
        "unknown reason";

      throw new AiPromptActionError(
        `The AI response was incomplete: ${reason}.`
      );
    }

    if (response.status === "failed") {
      throw new AiPromptActionError(
        "OpenAI failed to generate a response."
      );
    }

    const outputText =
      response.output_text.trim();

    if (!outputText) {
      throw new AiPromptActionError(
        "OpenAI returned an empty response."
      );
    }

    return {
      success: true,
      provider: "OPENAI",
      model: response.model,
      responseId: response.id,
      text: outputText,
      usage: response.usage
        ? {
            inputTokens:
              response.usage
                .input_tokens,
            outputTokens:
              response.usage
                .output_tokens,
            totalTokens:
              response.usage
                .total_tokens,
          }
        : null,
    };
  } catch (error) {
    if (
      error instanceof
      AiPromptActionError
    ) {
      throw error;
    }

    if (
      error instanceof OpenAI.APIError
    ) {
      const status =
        error.status ??
        "unknown status";

      throw new AiPromptActionError(
        `OpenAI request failed (${status}): ${error.message}`
      );
    }

    if (error instanceof Error) {
      throw new AiPromptActionError(
        `OpenAI request failed: ${error.message}`
      );
    }

    throw new AiPromptActionError(
      "OpenAI request failed for an unknown reason."
    );
  }
}