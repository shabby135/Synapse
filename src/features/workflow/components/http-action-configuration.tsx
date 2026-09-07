"use client";

import { Input } from "@/components/ui/input";

type HttpActionConfigurationProps = {
  configuration: Record<
    string,
    unknown
  >;
  canEdit: boolean;
  onChange: (
    changes: Record<string, unknown>
  ) => void;
};

const methods = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
] as const;

export function HttpActionConfiguration({
  configuration,
  canEdit,
  onChange,
}: HttpActionConfigurationProps) {
  const method =
    typeof configuration.method ===
    "string"
      ? configuration.method
      : "GET";

  const url =
    typeof configuration.url ===
    "string"
      ? configuration.url
      : "";

  const headersJson =
    typeof configuration.headersJson ===
    "string"
      ? configuration.headersJson
      : "{}";

  const body =
    typeof configuration.body ===
    "string"
      ? configuration.body
      : "";

  const timeoutMs =
    typeof configuration.timeoutMs ===
    "number"
      ? configuration.timeoutMs
      : 10_000;

  const failOnHttpError =
    configuration.failOnHttpError !==
    false;

  const supportsBody =
    method !== "GET";

  return (
    <div className="space-y-5 border-t pt-5">
      <div>
        <h4 className="font-medium">
          HTTP request
        </h4>

        <p className="mt-1 text-xs text-muted-foreground">
          Configure a public HTTP or HTTPS
          endpoint.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="http-method"
          className="text-sm font-medium"
        >
          Method
        </label>

        <select
          id="http-method"
          value={method}
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              method:
                event.target.value,
            })
          }
          className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {methods.map(
            (httpMethod) => (
              <option
                key={httpMethod}
                value={httpMethod}
              >
                {httpMethod}
              </option>
            )
          )}
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="http-url"
          className="text-sm font-medium"
        >
          URL
        </label>

        <Input
          id="http-url"
          type="url"
          value={url}
          placeholder="https://api.example.com/data"
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              url: event.target.value,
            })
          }
        />

        <p className="text-xs text-muted-foreground">
          Local and private network addresses
          are blocked.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="http-headers"
          className="text-sm font-medium"
        >
          Headers JSON
        </label>

        <textarea
          id="http-headers"
          value={headersJson}
          rows={5}
          spellCheck={false}
          disabled={!canEdit}
          placeholder={'{\n  "Content-Type": "application/json"\n}'}
          onChange={(event) =>
            onChange({
              headersJson:
                event.target.value,
            })
          }
          className="w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <p className="text-xs text-muted-foreground">
          Do not place API keys here. Secret
          storage will be added separately.
        </p>
      </div>

      {supportsBody && (
        <div className="space-y-2">
          <label
            htmlFor="http-body"
            className="text-sm font-medium"
          >
            Request body
          </label>

          <textarea
            id="http-body"
            value={body}
            rows={6}
            spellCheck={false}
            disabled={!canEdit}
            placeholder={'{\n  "message": "Hello"\n}'}
            onChange={(event) =>
              onChange({
                body:
                  event.target.value,
              })
            }
            className="w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="http-timeout"
          className="text-sm font-medium"
        >
          Timeout (milliseconds)
        </label>

        <Input
          id="http-timeout"
          type="number"
          min={1000}
          max={30000}
          step={1000}
          value={timeoutMs}
          disabled={!canEdit}
          onChange={(event) => {
            const nextValue =
              event.target.valueAsNumber;

            onChange({
              timeoutMs:
                Number.isFinite(
                  nextValue
                )
                  ? nextValue
                  : 10_000,
            });
          }}
        />
      </div>

      <label className="flex items-start gap-3 rounded-md border p-3">
        <input
          type="checkbox"
          checked={failOnHttpError}
          disabled={!canEdit}
          onChange={(event) =>
            onChange({
              failOnHttpError:
                event.target.checked,
            })
          }
          className="mt-0.5 size-4"
        />

        <span>
          <span className="block text-sm font-medium">
            Fail on HTTP errors
          </span>

          <span className="block text-xs text-muted-foreground">
            Mark the workflow step as failed
            when the response is not 2xx.
          </span>
        </span>
      </label>
    </div>
  );
}
