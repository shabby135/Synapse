import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import {
  AiPromptActionError,
  type AiPromptConfiguration,
} from "./ai-prompt-configuration";

type ExecuteClaudePromptOptions = {
  configuration: AiPromptConfiguration;
  prompt: string;
};

const REQUEST_TIMEOUT_MS = 60_000;

export async function executeClaudePrompt({
  configuration,
  prompt,
}: ExecuteClaudePromptOptions): Promise<
  Record<string, unknown>
> {
  const apiKey =
    process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new AiPromptActionError(
      "ANTHROPIC_API_KEY is not configured."
    );
  }

  const client = new Anthropic({
    apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 0,
  });

  try {
    const message =
      await client.messages.create({
        model: configuration.model,
        max_tokens:
          configuration.maxOutputTokens,
        system:
          configuration.systemPrompt ||
          undefined,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

    const outputText = message.content
      .filter(
        (
          block
        ): block is Anthropic.TextBlock =>
          block.type === "text"
      )
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!outputText) {
      throw new AiPromptActionError(
        "Claude returned an empty response."
      );
    }

    return {
      success: true,
      provider: "CLAUDE",
      model: message.model,
      responseId: message.id,
      text: outputText,
      stopReason:
        message.stop_reason,
      usage: {
        inputTokens:
          message.usage.input_tokens,
        outputTokens:
          message.usage.output_tokens,
        totalTokens:
          message.usage.input_tokens +
          message.usage.output_tokens,
      },
    };
  } catch (error) {
    if (
      error instanceof
      AiPromptActionError
    ) {
      throw error;
    }

    if (
      error instanceof
      Anthropic.APIError
    ) {
      const status =
        error.status ??
        "unknown status";

      throw new AiPromptActionError(
        `Claude request failed (${status}): ${error.message}`
      );
    }

    if (error instanceof Error) {
      throw new AiPromptActionError(
        `Claude request failed: ${error.message}`
      );
    }

    throw new AiPromptActionError(
      "Claude request failed for an unknown reason."
    );
  }
}