import type {
  WorkflowNodeData,
} from "./types";

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
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]);

const MAX_REQUEST_BODY_BYTES =
  256 * 1024;

const MAX_HEADERS = 50;

const MAX_HEADER_VALUE_LENGTH =
  8_192;

const DEFAULT_TIMEOUT_MS =
  10_000;

const MIN_TIMEOUT_MS =
  1_000;

const MAX_TIMEOUT_MS =
  30_000;

export type HttpConfiguration = {
  method: string;
  url: URL;
  headers: Record<
    string,
    string
  >;
  body?: string;
  timeoutMs: number;
  failOnHttpError: boolean;
};

export class HttpActionError extends Error {
  constructor(message: string) {
    super(message);

    this.name =
      "HttpActionError";
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
      parsed =
        JSON.parse(value);
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

  if (
    entries.length >
    MAX_HEADERS
  ) {
    throw new HttpActionError(
      `HTTP requests cannot contain more than ${MAX_HEADERS} headers.`
    );
  }

  const headers: Record<
    string,
    string
  > = {};

  for (
    const [
      rawName,
      value,
    ] of entries
  ) {
    const name =
      rawName.trim();

    const normalizedName =
      name.toLowerCase();

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
        `Header ${rawName} is not allowed.`
      );
    }

    if (
      typeof value !==
      "string"
    ) {
      throw new HttpActionError(
        `Header ${rawName} must contain a string value.`
      );
    }

    if (
      value.length >
      MAX_HEADER_VALUE_LENGTH
    ) {
      throw new HttpActionError(
        `Header ${rawName} is too large.`
      );
    }

    if (
      /[\r\n]/.test(name) ||
      /[\r\n]/.test(value)
    ) {
      throw new HttpActionError(
        `Header ${rawName} contains invalid characters.`
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

  if (
    !ALLOWED_METHODS.has(
      method
    )
  ) {
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

  /*
   * Production workflow actions should
   * never transmit credentials over
   * plaintext HTTP.
   */
  if (
    url.protocol !== "https:"
  ) {
    throw new HttpActionError(
      "HTTP actions require an HTTPS URL."
    );
  }

  if (
    url.username ||
    url.password
  ) {
    throw new HttpActionError(
      "URLs cannot contain credentials."
    );
  }

  /*
   * Keep the outbound network surface
   * deliberately narrow.
   */
  if (
    url.port &&
    url.port !== "443"
  ) {
    throw new HttpActionError(
      "Only HTTPS port 443 is allowed."
    );
  }

  const timeoutMs =
    typeof configuration.timeoutMs ===
    "number"
      ? configuration.timeoutMs
      : DEFAULT_TIMEOUT_MS;

  if (
    !Number.isInteger(
      timeoutMs
    ) ||
    timeoutMs <
      MIN_TIMEOUT_MS ||
    timeoutMs >
      MAX_TIMEOUT_MS
  ) {
    throw new HttpActionError(
      `HTTP timeout must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} milliseconds.`
    );
  }

  const body =
    typeof configuration.body ===
    "string"
      ? configuration.body
      : undefined;

  if (
    body !== undefined &&
    new TextEncoder().encode(
      body
    ).byteLength >
      MAX_REQUEST_BODY_BYTES
  ) {
    throw new HttpActionError(
      "HTTP request body cannot exceed 256 KB."
    );
  }

  return {
    method,
    url,
    headers:
      parseHeaders(
        configuration.headersJson
      ),
    body,
    timeoutMs,

    failOnHttpError:
      configuration
        .failOnHttpError !==
      false,
  };
}