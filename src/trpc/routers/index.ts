import "server-only";

import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import {
  router,
} from "../init";

import {
  billingRouter,
} from "./billing";
import {
  integrationRouter,
} from "./integration";
import {
  monitoringRouter,
} from "./monitoring";
import {
  userRouter,
} from "./user";
import {
  workflowFolderRouter,
} from "./workflow-folder";
import {
  workflowWebhookRouter,
} from "./workflow-webhook";
import {
  workflowRouter,
} from "./workflow";
import {
  workspaceRouter,
} from "./workspace";

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
    .update(
      secret,
      "utf8"
    )
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

  const actualBuffer =
    Buffer.from(
      actualHash,
      "hex"
    );

  const expectedBuffer =
    Buffer.from(
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

export const appRouter =
  router({
    user: userRouter,

    workspace:
      workspaceRouter,

    workflow:
      workflowRouter,

    workflowFolder:
      workflowFolderRouter,

    workflowWebhook:
      workflowWebhookRouter,

    integration:
      integrationRouter,

    monitoring:
      monitoringRouter,

    billing:
      billingRouter,
  });

export type AppRouter =
  typeof appRouter;