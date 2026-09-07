"use client";

import { Input } from "@/components/ui/input";

type AiActionConfigurationProps = {
  configuration: Record<string, unknown>;
  canEdit: boolean;
  onChange: (
    changes: Record<string, unknown>
  ) => void;
};

type AiProvider =
  | "OPENAI"
  | "GEMINI"
  | "CLAUDE";

const DEFAULT_MODELS: Record<
  AiProvider,
  string
> = {
  OPENAI: "gpt-4.1-mini",
  GEMINI: "gemini-3-flash-preview",
  CLAUDE:
    "claude-haiku-4-5-20251001",
};

function getString(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function getNumber(
  value: unknown,
  fallback: number
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

function getProvider(
  value: unknown,
  model: unknown
): AiProvider {
  if (
    value === "OPENAI" ||
    value === "GEMINI" ||
    value === "CLAUDE"
  ) {
    return value;
  }

  if (
    typeof model === "string"
  ) {
    if (
      model.startsWith("gpt-") ||
      model.startsWith("o")
    ) {
      return "OPENAI";
    }

    if (
      model.startsWith("claude-")
    ) {
      return "CLAUDE";
    }
  }

  return "GEMINI";
}

export function AiActionConfiguration({
  configuration,
  canEdit,
  onChange,
}: AiActionConfigurationProps) {
  const provider = getProvider(
  configuration.provider,
  configuration.model
);

  const model = getString(
    configuration.model,
    DEFAULT_MODELS[provider]
  );

  const systemPrompt = getString(
    configuration.systemPrompt
  );

  const prompt = getString(
    configuration.prompt
  );

  const maxOutputTokens = getNumber(
    configuration.maxOutputTokens,
    1000
  );

  function changeProvider(
    nextProvider: AiProvider
  ) {
    onChange({
      provider: nextProvider,
      model:
        DEFAULT_MODELS[nextProvider],
    });
  }

  return (
    <div className="space-y-5 border-t pt-5">
      <div className="space-y-2">
        <label
          htmlFor="ai-provider"
          className="text-sm font-medium"
        >
          AI provider
        </label>

        <select
          id="ai-provider"
          value={provider}
          disabled={!canEdit}
          onChange={(event) =>
            changeProvider(
              event.target
                .value as AiProvider
            )
          }
          className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="GEMINI">
            Google Gemini
          </option>

          <option value="OPENAI">
            OpenAI
          </option>

          <option value="CLAUDE">
             Anthropic Claude
          </option>
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="ai-model"
          className="text-sm font-medium"
        >
          Model
        </label>

        <Input
          id="ai-model"
          value={model}
          placeholder={
            DEFAULT_MODELS[provider]
          }
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              model:
                event.target.value,
            })
          }
        />

        <p className="text-xs text-muted-foreground">
          Enter a model available to the
          selected API provider.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="ai-system-prompt"
          className="text-sm font-medium"
        >
          System instructions
        </label>

        <textarea
          id="ai-system-prompt"
          value={systemPrompt}
          rows={4}
          maxLength={10_000}
          placeholder="Describe how the AI should behave."
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              systemPrompt:
                event.target.value,
            })
          }
          className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="ai-prompt"
          className="text-sm font-medium"
        >
          Prompt
        </label>

        <textarea
          id="ai-prompt"
          value={prompt}
          rows={7}
          maxLength={20_000}
          placeholder="Summarize the workflow input: {{input}}"
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              prompt:
                event.target.value,
            })
          }
          className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <p className="text-xs text-muted-foreground">
          Use{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            {"{{input}}"}
          </code>{" "}
          to insert the action input as JSON.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="ai-max-output-tokens"
          className="text-sm font-medium"
        >
          Maximum output tokens
        </label>

        <Input
          id="ai-max-output-tokens"
          type="number"
          min={1}
          max={16_000}
          value={maxOutputTokens}
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              maxOutputTokens:
                Number(
                  event.target.value
                ),
            })
          }
        />
      </div>

      <div className="rounded-md border bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">
          Provider API keys are read from
          server environment variables and
          are never stored in workflow
          definitions.
        </p>
      </div>
    </div>
  );
}