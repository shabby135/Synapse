import { Buffer } from "node:buffer";

import type {
  ConnectionTestResult,
} from "./connection-test";

export type JiraAccount = {
  accountId: string;
  displayName: string;
  emailAddress: string | null;
  active: boolean;
};

export class JiraConnectionError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JiraConnectionError";
  }
}

export function normalizeJiraSiteUrl(
  value: string
): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new JiraConnectionError(
      "The Jira site URL is invalid."
    );
  }

  const hostname =
    url.hostname.toLowerCase();

  const validHostname =
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.atlassian\.net$/u.test(
      hostname
    );

  if (
    url.protocol !== "https:" ||
    !validHostname ||
    url.username ||
    url.password ||
    url.port ||
    (url.pathname !== "/" &&
      url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw new JiraConnectionError(
      "The Jira site URL must look like https://your-site.atlassian.net."
    );
  }

  return url.origin;
}

export function createJiraConnectionRequest({
  siteUrl,
  email,
  apiToken,
  signal,
}: {
  siteUrl: string;
  email: string;
  apiToken: string;
  signal?: AbortSignal;
}) {
  const normalizedSiteUrl =
    normalizeJiraSiteUrl(siteUrl);

  const authorization = Buffer.from(
    `${email}:${apiToken}`,
    "utf8"
  ).toString("base64");

  return {
    url: `${normalizedSiteUrl}/rest/api/3/myself`,
    init: {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization:
          `Basic ${authorization}`,
        "User-Agent":
          "Synapse-Connection-Test/1.0",
      },
      redirect: "error",
      cache: "no-store",
      signal,
    } satisfies RequestInit,
  };
}

export function classifyJiraStatus(
  status: number
): ConnectionTestResult {
  if (
    status === 400 ||
    status === 401 ||
    status === 403
  ) {
    return {
      status: "INVALID_CREDENTIALS",
      message:
        "Jira rejected the email address or API token.",
    };
  }

  if (status === 404) {
    return {
      status: "INVALID_CREDENTIALS",
      message:
        "The Jira site could not be found or is not accessible with these credentials.",
    };
  }

  if (status === 429) {
    return {
      status: "PROVIDER_UNAVAILABLE",
      message:
        "Jira temporarily rate-limited the connection test.",
    };
  }

  return {
    status: "PROVIDER_UNAVAILABLE",
    message: `Jira returned status ${status}.`,
  };
}

export function parseJiraAccount(
  body: string
): JiraAccount {
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    throw new JiraConnectionError(
      "Jira returned an invalid response."
    );
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new JiraConnectionError(
      "Jira returned an invalid response."
    );
  }

  const account = parsed as Record<
    string,
    unknown
  >;

  const accountId =
    typeof account.accountId === "string"
      ? account.accountId.trim()
      : "";

  const displayName =
    typeof account.displayName === "string"
      ? account.displayName.trim()
      : "";

  const emailAddress =
    typeof account.emailAddress === "string"
      ? account.emailAddress.trim()
      : "";

  const active = account.active;

  if (
    !accountId ||
    accountId.length > 256 ||
    !displayName ||
    displayName.length > 256 ||
    emailAddress.length > 254 ||
    typeof active !== "boolean"
  ) {
    throw new JiraConnectionError(
      "Jira returned an invalid account profile."
    );
  }

  return {
    accountId,
    displayName,
    emailAddress:
      emailAddress || null,
    active,
  };
}
