import type { WorkflowNodeData } from "./types";

const ALLOWED_METHODS =
  new Set<string>([
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
  ]);

const BLOCKED_REQUEST_HEADERS =
  new Set([
    "connection",
    "content-length",
    "cookie",
    "host",
    "proxy-authorization",
    "te",
    "transfer-encoding",
    "upgrade",
  ]);

const MAX_REQUEST_BODY_BYTES =
  256 * 1024;

const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 30_000;

export type HttpConfiguration = {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  failOnHttpError: boolean;
};

export class HttpActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HttpActionError";
  }
}

function parseHeaders(
  value: unknown
): Record<string, string> {
  let parsed: unknown = value;

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new HttpActionError(
        "HTTP headers must be valid JSON."
      );
    }
  }

  if (
    parsed === undefined ||
    parsed === ""
  ) {
    return {};
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new HttpActionError(
      "HTTP headers must be a JSON object."
    );
  }

  const entries =
    Object.entries(parsed);

  if (entries.length > 50) {
    throw new HttpActionError(
      "HTTP requests cannot contain more than 50 headers."
    );
  }

  const headers: Record<
    string,
    string
  > = {};

  for (const [name, value] of entries) {
    const normalizedName =
      name.trim().toLowerCase();

    if (!normalizedName) {
      throw new HttpActionError(
        "HTTP header names cannot be empty."
      );
    }

    if (
      BLOCKED_REQUEST_HEADERS.has(
        normalizedName
      )
    ) {
      throw new HttpActionError(
        `Header ${name} is not allowed.`
      );
    }

    if (typeof value !== "string") {
      throw new HttpActionError(
        `Header ${name} must contain a string value.`
      );
    }

    if (value.length > 8_192) {
      throw new HttpActionError(
        `Header ${name} is too large.`
      );
    }

    headers[name] = value;
  }

  return headers;
}

export function parseHttpActionConfiguration(
  data: WorkflowNodeData
): HttpConfiguration {
  const configuration =
    data.configuration ?? {};

  const method =
    typeof configuration.method ===
    "string"
      ? configuration.method
          .trim()
          .toUpperCase()
      : "GET";

  if (!ALLOWED_METHODS.has(method)) {
    throw new HttpActionError(
      `HTTP method ${method} is not supported.`
    );
  }

  if (
    typeof configuration.url !==
      "string" ||
    !configuration.url.trim()
  ) {
    throw new HttpActionError(
      "The HTTP request URL is required."
    );
  }

  let url: URL;

  try {
    url = new URL(
      configuration.url.trim()
    );
  } catch {
    throw new HttpActionError(
      "The HTTP request URL is invalid."
    );
  }

  if (
    url.protocol !== "https:" &&
    url.protocol !== "http:"
  ) {
    throw new HttpActionError(
      "Only HTTP and HTTPS URLs are allowed."
    );
  }

  if (url.username || url.password) {
    throw new HttpActionError(
      "URLs cannot contain credentials."
    );
  }

  const expectedPort =
    url.protocol === "https:"
      ? "443"
      : "80";

  if (
    url.port &&
    url.port !== expectedPort
  ) {
    throw new HttpActionError(
      "Only ports 80 and 443 are allowed."
    );
  }

  const timeoutMs =
    typeof configuration.timeoutMs ===
    "number"
      ? configuration.timeoutMs
      : DEFAULT_TIMEOUT_MS;

  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < MIN_TIMEOUT_MS ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new HttpActionError(
      "HTTP timeout must be between 1000 and 30000 milliseconds."
    );
  }

  const body =
    typeof configuration.body ===
    "string"
      ? configuration.body
      : undefined;

  if (
    body &&
    new TextEncoder().encode(body)
      .byteLength >
      MAX_REQUEST_BODY_BYTES
  ) {
    throw new HttpActionError(
      "HTTP request body cannot exceed 256 KB."
    );
  }

  return {
    method,
    url,
    headers: parseHeaders(
      configuration.headersJson
    ),
    body,
    timeoutMs,
    failOnHttpError:
      configuration.failOnHttpError !==
      false,
  };
}