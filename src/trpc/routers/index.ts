import { router } from "../init";

import { userRouter } from "./user";
import { workflowRouter } from "./workflow";
import { integrationRouter } from "./integration";
import { workspaceRouter } from "./workspace";
import "server-only";
import {
  workflowWebhookRouter,
} from "./workflow-webhook";

import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { billingRouter } from "./billing";
import {
  monitoringRouter,
} from "./monitoring";

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

export const appRouter = router({
    integration: integrationRouter,
  user: userRouter,
  workspace: workspaceRouter,
  workflow: workflowRouter,
  monitoring: monitoringRouter,

  workflowWebhook:
    workflowWebhookRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;