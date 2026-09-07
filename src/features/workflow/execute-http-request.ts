import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import {
  HttpActionError,
  parseHttpActionConfiguration,
} from "./http-request-configuration";
import type { WorkflowNodeData } from "./types";

type ExecuteHttpRequestOptions = {
  data: WorkflowNodeData;
  input: Record<string, unknown>;
};

const MAX_RESPONSE_BODY_BYTES =
  1024 * 1024;

function isPublicIpv4(
  address: string
): boolean {
  const parts = address
    .split(".")
    .map(Number);

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255
    )
  ) {
    return false;
  }

  const [first, second, third] =
    parts;

  if (
    first === undefined ||
    second === undefined ||
    third === undefined
  ) {
    return false;
  }

  if (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224
  ) {
    return false;
  }

  if (
    first === 100 &&
    second >= 64 &&
    second <= 127
  ) {
    return false;
  }

  if (
    first === 169 &&
    second === 254
  ) {
    return false;
  }

  if (
    first === 172 &&
    second >= 16 &&
    second <= 31
  ) {
    return false;
  }

  if (
    first === 192 &&
    second === 168
  ) {
    return false;
  }

  if (
    first === 192 &&
    second === 0 &&
    third === 0
  ) {
    return false;
  }

  if (
    first === 192 &&
    second === 0 &&
    third === 2
  ) {
    return false;
  }

  if (
    first === 192 &&
    second === 88 &&
    third === 99
  ) {
    return false;
  }

  if (
    first === 198 &&
    (second === 18 ||
      second === 19)
  ) {
    return false;
  }

  if (
    first === 198 &&
    second === 51 &&
    third === 100
  ) {
    return false;
  }

  if (
    first === 203 &&
    second === 0 &&
    third === 113
  ) {
    return false;
  }

  return true;
}

function isPublicIpv6(
  address: string
): boolean {
  const normalized =
    address.toLowerCase();

  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith(
      "::ffff:"
    )
  ) {
    return false;
  }

  const firstSection =
    normalized.split(":")[0];

  const firstValue =
    Number.parseInt(
      firstSection || "0",
      16
    );

  if (
    firstValue < 0x2000 ||
    firstValue > 0x3fff
  ) {
    return false;
  }

  if (
    normalized.startsWith(
      "2001:db8:"
    )
  ) {
    return false;
  }

  if (
    normalized.startsWith("2001:0:")
  ) {
    return false;
  }

  if (
    normalized.startsWith("2002:")
  ) {
    return false;
  }

  return true;
}

function isPublicIp(
  address: string
): boolean {
  const version = isIP(address);

  if (version === 4) {
    return isPublicIpv4(address);
  }

  if (version === 6) {
    return isPublicIpv6(address);
  }

  return false;
}

function getAllowedHosts(): string[] {
  return (
    process.env
      .HTTP_ACTION_ALLOWED_HOSTS ?? ""
  )
    .split(",")
    .map((host) =>
      host.trim().toLowerCase()
    )
    .filter(Boolean);
}

async function assertSafeUrl(
  url: URL
): Promise<void> {
  const hostname = url.hostname
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost")
  ) {
    throw new HttpActionError(
      "Local network destinations are not allowed."
    );
  }

  const allowedHosts =
    getAllowedHosts();

  if (
    allowedHosts.length > 0 &&
    !allowedHosts.includes(hostname)
  ) {
    throw new HttpActionError(
      `Host ${hostname} is not allowed.`
    );
  }

  const ipVersion = isIP(hostname);

  if (ipVersion !== 0) {
    if (!isPublicIp(hostname)) {
      throw new HttpActionError(
        "Private and reserved IP addresses are not allowed."
      );
    }

    return;
  }

  let addresses: Array<{
    address: string;
    family: number;
  }>;

  try {
    addresses = await lookup(
      hostname,
      {
        all: true,
        verbatim: true,
      }
    );
  } catch {
    throw new HttpActionError(
      "The destination hostname could not be resolved."
    );
  }

  if (addresses.length === 0) {
    throw new HttpActionError(
      "The destination hostname could not be resolved."
    );
  }

  if (
    addresses.some(
      ({ address }) =>
        !isPublicIp(address)
    )
  ) {
    throw new HttpActionError(
      "The destination resolves to a private or reserved IP address."
    );
  }
}

async function readLimitedBody(
  response: Response
): Promise<string> {
  const contentLength =
    response.headers.get(
      "content-length"
    );

  if (contentLength) {
    const parsedLength =
      Number(contentLength);

    if (
      Number.isFinite(parsedLength) &&
      parsedLength >
        MAX_RESPONSE_BODY_BYTES
    ) {
      throw new HttpActionError(
        "HTTP response exceeded the 1 MB limit."
      );
    }
  }

  if (!response.body) {
    return "";
  }

  const reader =
    response.body.getReader();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } =
      await reader.read();

    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    totalBytes += value.byteLength;

    if (
      totalBytes >
      MAX_RESPONSE_BODY_BYTES
    ) {
      await reader.cancel();

      throw new HttpActionError(
        "HTTP response exceeded the 1 MB limit."
      );
    }

    chunks.push(value);
  }

  const combined =
    new Uint8Array(totalBytes);

  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(
    combined
  );
}

function parseResponseBody(
  body: string,
  contentType: string
): unknown {
  if (!body) {
    return null;
  }

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  return body;
}

export async function executeHttpRequest({
  data,
  input,
}: ExecuteHttpRequestOptions): Promise<
  Record<string, unknown>
> {
  const configuration =
    parseHttpActionConfiguration(
      data
    );

  await assertSafeUrl(
    configuration.url
  );

  const startedAt = Date.now();

  let response: Response;

  try {
    response = await fetch(
      configuration.url,
      {
        method:
          configuration.method,
        headers:
          configuration.headers,
        body:
          configuration.method ===
          "GET"
            ? undefined
            : configuration.body,
        redirect: "manual",
        signal: AbortSignal.timeout(
          configuration.timeoutMs
        ),
      }
    );
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name ===
        "TimeoutError" ||
        error.name === "AbortError")
    ) {
      throw new HttpActionError(
        `HTTP request timed out after ${configuration.timeoutMs} ms.`
      );
    }

    throw new HttpActionError(
      error instanceof Error
        ? `HTTP request failed: ${error.message}`
        : "HTTP request failed."
    );
  }

  if (
    response.status >= 300 &&
    response.status < 400
  ) {
    throw new HttpActionError(
      "HTTP redirects are not followed."
    );
  }

  const rawBody =
    await readLimitedBody(response);

  const contentType =
    response.headers.get(
      "content-type"
    ) ?? "";

  const responseHeaders =
    Object.fromEntries(
      [
        ...response.headers.entries(),
      ].filter(
        ([name]) =>
          name.toLowerCase() !==
          "set-cookie"
      )
    );

  const result = {
    ok: response.ok,
    status: response.status,
    statusText:
      response.statusText,
    headers: responseHeaders,
    body: parseResponseBody(
      rawBody,
      contentType
    ),
    durationMs:
      Date.now() - startedAt,
    receivedInput: input,
  };

  if (
    !response.ok &&
    configuration.failOnHttpError
  ) {
    throw new HttpActionError(
      `HTTP request returned status ${response.status}.`
    );
  }

  return result;
}