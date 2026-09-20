import { z } from "zod";

import type {
  IntegrationProvider,
} from "./provider-registry";

export const CURRENT_CREDENTIAL_FORMAT_VERSION =
  2;

const MAX_CREDENTIAL_FIELDS = 20;
const MAX_CREDENTIAL_VALUE_LENGTH =
  50_000;
const MAX_SERIALIZED_CREDENTIAL_LENGTH =
  100_000;
const CREDENTIAL_KEY_PATTERN =
  /^[a-z][A-Za-z0-9]{0,63}$/;

export type IntegrationCredentials =
  Readonly<Record<string, string>>;

const credentialValuesSchema = z
  .record(z.string(), z.string())
  .superRefine((values, context) => {
    const entries = Object.entries(values);

    if (
      entries.length === 0 ||
      entries.length > MAX_CREDENTIAL_FIELDS
    ) {
      context.addIssue({
        code: "custom",
        message: `Credentials must contain between 1 and ${MAX_CREDENTIAL_FIELDS} fields.`,
      });
    }

    for (const [key, value] of entries) {
      if (!CREDENTIAL_KEY_PATTERN.test(key)) {
        context.addIssue({
          code: "custom",
          path: [key],
          message:
            "Credential field names must use camelCase letters and numbers.",
        });
      }

      if (!value) {
        context.addIssue({
          code: "custom",
          path: [key],
          message:
            "Credential values cannot be empty.",
        });
      }

      if (
        value.length >
        MAX_CREDENTIAL_VALUE_LENGTH
      ) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: `Credential values cannot exceed ${MAX_CREDENTIAL_VALUE_LENGTH} characters.`,
        });
      }
    }
  });

const credentialPayloadSchema = z
  .object({
    version: z.literal(
      CURRENT_CREDENTIAL_FORMAT_VERSION
    ),
    values: credentialValuesSchema,
  })
  .strict();

export class IntegrationCredentialError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "IntegrationCredentialError";
  }
}

function parseCredentialValues(
  values: unknown
): IntegrationCredentials {
  const parsed =
    credentialValuesSchema.safeParse(
      values
    );

  if (!parsed.success) {
    throw new IntegrationCredentialError(
      parsed.error.issues[0]?.message ??
        "Integration credentials are invalid."
    );
  }

  return Object.freeze({
    ...parsed.data,
  });
}

export function serializeIntegrationCredentials(
  values: IntegrationCredentials
): string {
  const payload = {
    version:
      CURRENT_CREDENTIAL_FORMAT_VERSION,
    values: parseCredentialValues(values),
  } as const;

  const serialized = JSON.stringify(
    payload
  );

  if (
    serialized.length >
    MAX_SERIALIZED_CREDENTIAL_LENGTH
  ) {
    throw new IntegrationCredentialError(
      "Integration credentials are too large."
    );
  }

  return serialized;
}

export function parseIntegrationCredentials({
  serialized,
  formatVersion,
  provider,
}: {
  serialized: string;
  formatVersion: number;
  provider: IntegrationProvider;
}): IntegrationCredentials {
  if (formatVersion === 1) {
    if (
      provider !== "SLACK" &&
      provider !== "DISCORD"
    ) {
      throw new IntegrationCredentialError(
        `Legacy credentials are not supported for ${provider}.`
      );
    }

    return parseCredentialValues({
      webhookUrl: serialized,
    });
  }

  if (
    formatVersion !==
    CURRENT_CREDENTIAL_FORMAT_VERSION
  ) {
    throw new IntegrationCredentialError(
      `Unsupported credential format version: ${formatVersion}.`
    );
  }

  if (
    serialized.length >
    MAX_SERIALIZED_CREDENTIAL_LENGTH
  ) {
    throw new IntegrationCredentialError(
      "Integration credentials are too large."
    );
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(serialized);
  } catch {
    throw new IntegrationCredentialError(
      "Integration credentials contain invalid JSON."
    );
  }

  const parsed =
    credentialPayloadSchema.safeParse(
      decoded
    );

  if (!parsed.success) {
    throw new IntegrationCredentialError(
      parsed.error.issues[0]?.message ??
        "Integration credentials are invalid."
    );
  }

  return Object.freeze({
    ...parsed.data.values,
  });
}

export function maskCredentialValue(
  value: string
): string {
  if (value.length <= 4) {
    return "••••";
  }

  return `••••${value.slice(-4)}`;
}
