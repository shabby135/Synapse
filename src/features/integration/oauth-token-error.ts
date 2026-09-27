export const oauthTokenFailureKindValues = [
  "REAUTH_REQUIRED",
  "TEMPORARY",
  "CONFIGURATION",
  "REJECTED",
] as const;

export type OAuthTokenFailureKind =
  (typeof oauthTokenFailureKindValues)[number];

export type ParsedOAuthProviderError = {
  code: string | null;
  description: string | null;
};

const REAUTH_REQUIRED_CODES =
  new Set([
    "invalid_grant",
    "invalid_token",
    "bad_refresh_token",
    "expired_token",
    "revoked_token",
  ]);

const CONFIGURATION_ERROR_CODES =
  new Set([
    "invalid_client",
    "unauthorized_client",
    "unsupported_grant_type",
  ]);

const MAX_ERROR_CODE_LENGTH = 128;
const MAX_DESCRIPTION_LENGTH = 500;

function record(
  value: unknown
): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<
        string,
        unknown
      >)
    : null;
}

function normalizedText(
  value: unknown,
  maximumLength: number
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = value.trim();

  if (!parsed) {
    return null;
  }

  return parsed.slice(
    0,
    maximumLength
  );
}

export function parseOAuthProviderError(
  payload: unknown
): ParsedOAuthProviderError {
  const source = record(payload);

  if (!source) {
    return {
      code: null,
      description: null,
    };
  }

  const code = normalizedText(
    source.error,
    MAX_ERROR_CODE_LENGTH
  );

  const description =
    normalizedText(
      source.error_description,
      MAX_DESCRIPTION_LENGTH
    ) ??
    normalizedText(
      source.message,
      MAX_DESCRIPTION_LENGTH
    );

  return {
    code: code?.toLowerCase() ?? null,
    description,
  };
}

export function classifyOAuthTokenFailure({
  status,
  providerCode,
}: {
  status: number | null;
  providerCode: string | null;
}): OAuthTokenFailureKind {
  const normalizedCode =
    providerCode
      ?.trim()
      .toLowerCase() ?? null;

  if (
    status === null ||
    status === 408 ||
    status === 425 ||
    status === 429 ||
    (status >= 500 && status <= 599)
  ) {
    return "TEMPORARY";
  }

  if (
    normalizedCode &&
    REAUTH_REQUIRED_CODES.has(
      normalizedCode
    )
  ) {
    return "REAUTH_REQUIRED";
  }

  if (
    normalizedCode &&
    CONFIGURATION_ERROR_CODES.has(
      normalizedCode
    )
  ) {
    return "CONFIGURATION";
  }

  return "REJECTED";
}

function failureMessage(
  kind: OAuthTokenFailureKind
): string {
  if (kind === "REAUTH_REQUIRED") {
    return "The OAuth connection is no longer authorized and must be reconnected.";
  }

  if (kind === "TEMPORARY") {
    return "The OAuth provider is temporarily unavailable.";
  }

  if (kind === "CONFIGURATION") {
    return "The OAuth client configuration was rejected.";
  }

  return "The OAuth provider rejected the token request.";
}

export class OAuthTokenRequestError
  extends Error {
  readonly kind: OAuthTokenFailureKind;
  readonly status: number | null;
  readonly providerCode: string | null;
  readonly providerDescription:
    | string
    | null;

  constructor({
    kind,
    status,
    providerCode,
    providerDescription,
    message,
  }: {
    kind: OAuthTokenFailureKind;
    status: number | null;
    providerCode?: string | null;
    providerDescription?:
      | string
      | null;
    message?: string;
  }) {
    super(
      message ?? failureMessage(kind)
    );

    this.name =
      "OAuthTokenRequestError";
    this.kind = kind;
    this.status = status;
    this.providerCode =
      providerCode ?? null;
    this.providerDescription =
      providerDescription ?? null;
  }
}

export function createOAuthTokenRequestError({
  status,
  payload,
}: {
  status: number;
  payload: unknown;
}): OAuthTokenRequestError {
  const providerError =
    parseOAuthProviderError(payload);

  const kind =
    classifyOAuthTokenFailure({
      status,
      providerCode:
        providerError.code,
    });

  return new OAuthTokenRequestError({
    kind,
    status,
    providerCode:
      providerError.code,
    providerDescription:
      providerError.description,
  });
}