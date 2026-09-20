import "server-only";

import {
  CURRENT_CREDENTIAL_FORMAT_VERSION,
  parseIntegrationCredentials,
  serializeIntegrationCredentials,
  type IntegrationCredentials,
} from "./credential-codec";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  type EncryptedIntegrationSecret,
} from "./encryption";
import type {
  IntegrationProvider,
} from "./provider-registry";

export type EncryptedIntegrationCredentials =
  EncryptedIntegrationSecret & {
    credentialFormatVersion: number;
  };

export function encryptIntegrationCredentials({
  credentials,
  context,
}: {
  credentials: IntegrationCredentials;
  context: string;
}): EncryptedIntegrationCredentials {
  const encrypted =
    encryptIntegrationSecret({
      value:
        serializeIntegrationCredentials(
          credentials
        ),
      context,
    });

  return {
    ...encrypted,
    credentialFormatVersion:
      CURRENT_CREDENTIAL_FORMAT_VERSION,
  };
}

export function decryptIntegrationCredentials({
  provider,
  credentialFormatVersion,
  context,
  ...encrypted
}: EncryptedIntegrationSecret & {
  provider: IntegrationProvider;
  credentialFormatVersion: number;
  context: string;
}): IntegrationCredentials {
  const serialized =
    decryptIntegrationSecret({
      ...encrypted,
      context,
    });

  return parseIntegrationCredentials({
    serialized,
    formatVersion:
      credentialFormatVersion,
    provider,
  });
}
