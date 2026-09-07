import "server-only";

import { GoogleGenAI } from "@google/genai";

import {
  AiPromptActionError,
  type AiPromptConfiguration,
} from "./ai-prompt-configuration";

type ExecuteGeminiPromptOptions = {
  configuration: AiPromptConfiguration;
  prompt: string;
};

const REQUEST_TIMEOUT_MS = 60_000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeout:
    | ReturnType<typeof setTimeout>
    | undefined;

  const timeoutPromise =
    new Promise<never>(
      (_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(
            new AiPromptActionError(
              `Gemini request timed out after ${timeoutMs} ms.`
            )
          );
        }, timeoutMs);
      }
    );

  try {
    return await Promise.race([
      promise,
      timeoutPromise,
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function executeGeminiPrompt({
  configuration,
  prompt,
}: ExecuteGeminiPromptOptions): Promise<
  Record<string, unknown>
> {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new AiPromptActionError(
      "GEMINI_API_KEY is not configured."
    );
  }

  const client = new GoogleGenAI({
    apiKey,
  });

  try {
    const response = await withTimeout(
      client.models.generateContent({
        model: configuration.model,
        contents: prompt,
        config: {
          systemInstruction:
            configuration.systemPrompt ||
            undefined,
          maxOutputTokens:
            configuration.maxOutputTokens,
        },
      }),
      REQUEST_TIMEOUT_MS
    );

    const outputText =
      response.text?.trim();

    if (!outputText) {
      const finishReason =
        response.candidates?.[0]
          ?.finishReason;

      throw new AiPromptActionError(
        finishReason
          ? `Gemini returned no text. Finish reason: ${finishReason}.`
          : "Gemini returned an empty response."
      );
    }

    const usage =
      response.usageMetadata;

    return {
      success: true,
      provider: "GEMINI",
      model:
        response.modelVersion ??
        configuration.model,
      responseId:
        response.responseId ?? null,
      text: outputText,
      usage: usage
        ? {
            inputTokens:
              usage.promptTokenCount ??
              null,
            outputTokens:
              usage.candidatesTokenCount ??
              null,
            totalTokens:
              usage.totalTokenCount ??
              null,
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

    if (error instanceof Error) {
      throw new AiPromptActionError(
        `Gemini request failed: ${error.message}`
      );
    }

    throw new AiPromptActionError(
      "Gemini request failed for an unknown reason."
    );
  }
}