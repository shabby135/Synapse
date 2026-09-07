import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const CURRENT_KEY_VERSION = 1;

export type EncryptedIntegrationSecret = {
  encryptedValue: string;
  initializationVector: string;
  authenticationTag: string;
  keyVersion: number;
};

type DecryptIntegrationSecretOptions =
  EncryptedIntegrationSecret & {
    context: string;
  };

function getEncryptionKey(): Buffer {
  const encodedKey =
    process.env
      .INTEGRATION_ENCRYPTION_KEY;

  if (!encodedKey) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY is not configured."
    );
  }

  let key: Buffer;

  try {
    key = Buffer.from(
      encodedKey,
      "base64"
    );
  } catch {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY is invalid."
    );
  }

  if (
    key.length !== KEY_LENGTH_BYTES
  ) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY must decode to exactly 32 bytes."
    );
  }

  return key;
}

export function createIntegrationSecretContext({
  workspaceId,
  provider,
  integrationId,
}: {
  workspaceId: string;
  provider: string;
  integrationId: string;
}): string {
  return [
    workspaceId,
    provider,
    integrationId,
  ].join(":");
}

export function encryptIntegrationSecret({
  value,
  context,
}: {
  value: string;
  context: string;
}): EncryptedIntegrationSecret {
  if (!value) {
    throw new Error(
      "Integration secret cannot be empty."
    );
  }

  const key = getEncryptionKey();
  const initializationVector =
    randomBytes(IV_LENGTH_BYTES);

  const cipher = createCipheriv(
    ALGORITHM,
    key,
    initializationVector
  );

  cipher.setAAD(
    Buffer.from(context, "utf8")
  );

  const encryptedValue =
    Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);

  const authenticationTag =
    cipher.getAuthTag();

  return {
    encryptedValue:
      encryptedValue.toString(
        "base64"
      ),
    initializationVector:
      initializationVector.toString(
        "base64"
      ),
    authenticationTag:
      authenticationTag.toString(
        "base64"
      ),
    keyVersion:
      CURRENT_KEY_VERSION,
  };
}

export function decryptIntegrationSecret({
  encryptedValue,
  initializationVector,
  authenticationTag,
  keyVersion,
  context,
}: DecryptIntegrationSecretOptions): string {
  if (
    keyVersion !==
    CURRENT_KEY_VERSION
  ) {
    throw new Error(
      `Unsupported integration encryption key version: ${keyVersion}.`
    );
  }

  try {
    const key = getEncryptionKey();

    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(
        initializationVector,
        "base64"
      )
    );

    decipher.setAAD(
      Buffer.from(context, "utf8")
    );

    decipher.setAuthTag(
      Buffer.from(
        authenticationTag,
        "base64"
      )
    );

    const decryptedValue =
      Buffer.concat([
        decipher.update(
          Buffer.from(
            encryptedValue,
            "base64"
          )
        ),
        decipher.final(),
      ]);

    return decryptedValue.toString(
      "utf8"
    );
  } catch {
    throw new Error(
      "Integration credential could not be decrypted."
    );
  }
}