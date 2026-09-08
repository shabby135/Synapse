import "server-only";

import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const WEBHOOK_SECRET_BYTES = 32;

export function generateWebhookSecret(): string {
  return randomBytes(
    WEBHOOK_SECRET_BYTES
  ).toString("base64url");
}

export function hashWebhookSecret(
  secret: string
): string {
  return createHash("sha256")
    .update(secret, "utf8")
    .digest("hex");
}

export function verifyWebhookSecret({
  secret,
  expectedHash,
}: {
  secret: string;
  expectedHash: string;
}): boolean {
  const actualHash =
    hashWebhookSecret(secret);

  const actualBuffer = Buffer.from(
    actualHash,
    "hex"
  );

  const expectedBuffer = Buffer.from(
    expectedHash,
    "hex"
  );

  if (
    actualBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    actualBuffer,
    expectedBuffer
  );
}