import "server-only";

import {
  GoogleGenAI,
} from "@google/genai";

import {
  AiPromptActionError,
  type AiPromptConfiguration,
} from "./ai-prompt-configuration";

type ExecuteGeminiPromptOptions = {
  configuration: AiPromptConfiguration;
  prompt: string;
};

type GeminiResponse = Awaited<
  ReturnType<
    GoogleGenAI["models"]["generateContent"]
  >
>;

const TOTAL_TIMEOUT_MS = 60_000;
const ATTEMPT_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS_PER_MODEL = 3;
const FALLBACK_MODEL =
  "gemini-3.5-flash-lite";

const RETRYABLE_STATUS_CODES =
  new Set([
    408,
    429,
    500,
    502,
    503,
    504,
  ]);

function wait(
  milliseconds: number
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function retryDelay(
  attempt: number
): number {
  const exponentialDelay =
    750 * 2 ** (attempt - 1);

  const jitter = Math.floor(
    Math.random() * 300
  );

  return exponentialDelay + jitter;
}

function errorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown Gemini error.";
  }
}

function errorStatus(
  error: unknown
): number | null {
  if (
    error === null ||
    typeof error !== "object"
  ) {
    return null;
  }

  const candidate =
    error as Record<string, unknown>;

  if (
    typeof candidate.status ===
    "number"
  ) {
    return candidate.status;
  }

  if (
    typeof candidate.code ===
    "number"
  ) {
    return candidate.code;
  }

  if (
    candidate.error !== null &&
    typeof candidate.error ===
      "object"
  ) {
    return errorStatus(
      candidate.error
    );
  }

  return null;
}

function isRetryableError(
  error: unknown
): boolean {
  const status = errorStatus(error);

  if (
    status !== null &&
    RETRYABLE_STATUS_CODES.has(
      status
    )
  ) {
    return true;
  }

  const message =
    errorMessage(error).toLowerCase();

  return [
    "timed out",
    "timeout",
    "econnreset",
    "econnrefused",
    "fetch failed",
    "network",
    "socket",
    "high demand",
    "unavailable",
    "resource_exhausted",
    '"code":429',
    '"code":500',
    '"code":502',
    '"code":503',
    '"code":504',
  ].some((value) =>
    message.includes(value)
  );
}

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

async function requestModel({
  client,
  configuration,
  prompt,
  model,
  deadline,
}: {
  client: GoogleGenAI;
  configuration: AiPromptConfiguration;
  prompt: string;
  model: string;
  deadline: number;
}): Promise<GeminiResponse> {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS_PER_MODEL;
    attempt += 1
  ) {
    const remainingTime =
      deadline - Date.now();

    if (remainingTime <= 0) {
      throw new AiPromptActionError(
        `Gemini request timed out after ${TOTAL_TIMEOUT_MS} ms.`
      );
    }

    try {
      return await withTimeout(
        client.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction:
              configuration.systemPrompt ||
              undefined,
            maxOutputTokens:
              configuration.maxOutputTokens,
          },
        }),
        Math.min(
          ATTEMPT_TIMEOUT_MS,
          remainingTime
        )
      );
    } catch (error) {
      lastError = error;

      if (
        !isRetryableError(error) ||
        attempt ===
          MAX_ATTEMPTS_PER_MODEL
      ) {
        throw error;
      }

      const delay =
        retryDelay(attempt);

      if (
        Date.now() + delay >=
        deadline
      ) {
        throw error;
      }

      await wait(delay);
    }
  }

  throw lastError;
}

function modelCandidates(
  requestedModel: string
): string[] {
  if (
    requestedModel ===
    FALLBACK_MODEL
  ) {
    return [requestedModel];
  }

  return [
    requestedModel,
    FALLBACK_MODEL,
  ];
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

  const deadline =
    Date.now() + TOTAL_TIMEOUT_MS;

  let lastError: unknown;

  for (const model of modelCandidates(
    configuration.model
  )) {
    try {
      const response =
        await requestModel({
          client,
          configuration,
          prompt,
          model,
          deadline,
        });

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
        requestedModel:
          configuration.model,
        model:
          response.modelVersion ??
          model,
        usedFallbackModel:
          model !==
          configuration.model,
        responseId:
          response.responseId ??
          null,
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
      lastError = error;

      if (
        !isRetryableError(error)
      ) {
        break;
      }
    }
  }

  const message =
    errorMessage(lastError);

  throw new AiPromptActionError(
    `Gemini request failed after retries: ${message}`
  );
}