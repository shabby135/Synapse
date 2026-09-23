import type {
  ConnectionTestResult,
} from "./connection-test";

export type TrelloMember = {
  id: string;
  username: string;
  fullName: string | null;
};

export class TrelloConnectionError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrelloConnectionError";
  }
}

export function createTrelloConnectionRequest({
  apiKey,
  apiToken,
  signal,
}: {
  apiKey: string;
  apiToken: string;
  signal?: AbortSignal;
}) {
  const query = new URLSearchParams({
    fields: "id,username,fullName",
  });

  return {
    url: `https://api.trello.com/1/members/me?${query.toString()}`,
    init: {
      method: "GET",
      headers: {
        Authorization:
          `OAuth oauth_consumer_key="${apiKey}", oauth_token="${apiToken}"`,
        Accept: "application/json",
        "User-Agent":
          "Synapse-Connection-Test/1.0",
      },
      redirect: "error",
      signal,
    } satisfies RequestInit,
  };
}

export function classifyTrelloStatus(
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
        "Trello rejected the API key or token.",
    };
  }

  return {
    status: "PROVIDER_UNAVAILABLE",
    message: `Trello returned status ${status}.`,
  };
}

export function parseTrelloMember(
  body: string
): TrelloMember {
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    throw new TrelloConnectionError(
      "Trello returned an invalid response."
    );
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new TrelloConnectionError(
      "Trello returned an invalid response."
    );
  }

  const member = parsed as Record<
    string,
    unknown
  >;
  const id =
    typeof member.id === "string"
      ? member.id.trim()
      : "";
  const username =
    typeof member.username === "string"
      ? member.username.trim()
      : "";
  const fullName =
    typeof member.fullName === "string"
      ? member.fullName.trim()
      : "";

  if (
    !id ||
    id.length > 128 ||
    !username ||
    username.length > 128 ||
    fullName.length > 256
  ) {
    throw new TrelloConnectionError(
      "Trello returned an invalid member profile."
    );
  }

  return {
    id,
    username,
    fullName: fullName || null,
  };
}
