import {
  createHash,
} from "node:crypto";

import {
  and,
  eq,
} from "drizzle-orm";
import {
  NextResponse,
} from "next/server";

import {
  DuplicateWebhookRequestError,
  queueWorkflowRun,
  WorkflowRunQueueError,
} from "@/features/workflow/queue-workflow-run";
import {
  verifyWebhookSecret,
} from "@/features/workflow/webhook-secret";
import { db } from "@/lib/db";
import {
  workflowRun,
  workflowWebhook,
  workflowWebhookRequest,
} from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES =
  256 * 1024;

const MAX_IDEMPOTENCY_KEY_LENGTH =
  200;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{
    workflowId: string;
    secret: string;
  }>;
};

function jsonResponse(
  body: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function readLimitedBody(
  request: Request
): Promise<string> {
  const contentLength =
    request.headers.get(
      "content-length"
    );

  if (contentLength) {
    const parsedLength =
      Number(contentLength);

    if (
      !Number.isFinite(
        parsedLength
      ) ||
      parsedLength < 0 ||
      parsedLength >
        MAX_REQUEST_BYTES
    ) {
      throw new Error(
        "PAYLOAD_TOO_LARGE"
      );
    }
  }

  if (!request.body) {
    return "";
  }

  const reader =
    request.body.getReader();

  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let body = "";

  try {
    while (true) {
      const chunk =
        await reader.read();

      if (chunk.done) {
        break;
      }

      receivedBytes +=
        chunk.value.byteLength;

      if (
        receivedBytes >
        MAX_REQUEST_BYTES
      ) {
        throw new Error(
          "PAYLOAD_TOO_LARGE"
        );
      }

      body += decoder.decode(
        chunk.value,
        {
          stream: true,
        }
      );
    }

    body += decoder.decode();

    return body;
  } finally {
    await reader
      .cancel()
      .catch(() => undefined);
  }
}

function hashPayload(
  body: string
): string {
  return createHash("sha256")
    .update(body, "utf8")
    .digest("hex");
}

async function findWebhookRequest({
  webhookId,
  idempotencyKey,
}: {
  webhookId: string;
  idempotencyKey: string;
}) {
  const [existingRequest] =
    await db
      .select({
        runId:
          workflowWebhookRequest.runId,
        payloadHash:
          workflowWebhookRequest
            .payloadHash,
        runStatus:
          workflowRun.status,
      })
      .from(workflowWebhookRequest)
      .innerJoin(
        workflowRun,
        eq(
          workflowRun.id,
          workflowWebhookRequest.runId
        )
      )
      .where(
        and(
          eq(
            workflowWebhookRequest
              .webhookId,
            webhookId
          ),
          eq(
            workflowWebhookRequest
              .idempotencyKey,
            idempotencyKey
          )
        )
      )
      .limit(1);

  return existingRequest ?? null;
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  const {
    workflowId,
    secret,
  } = await context.params;

  if (
    !UUID_PATTERN.test(
      workflowId
    ) ||
    !secret ||
    secret.length > 200
  ) {
    return jsonResponse(
      {
        error:
          "Webhook not found.",
      },
      404
    );
  }

  const [webhook] = await db
    .select({
      id: workflowWebhook.id,
      workflowId:
        workflowWebhook.workflowId,
      secretHash:
        workflowWebhook.secretHash,
      enabled:
        workflowWebhook.enabled,
    })
    .from(workflowWebhook)
    .where(
      eq(
        workflowWebhook.workflowId,
        workflowId
      )
    )
    .limit(1);

  if (
    !webhook ||
    !verifyWebhookSecret({
      secret,
      expectedHash:
        webhook.secretHash,
    })
  ) {
    return jsonResponse(
      {
        error:
          "Webhook not found.",
      },
      404
    );
  }

  if (!webhook.enabled) {
    return jsonResponse(
      {
        error:
          "This webhook is disabled.",
      },
      403
    );
  }

  const contentType =
    request.headers
      .get("content-type")
      ?.toLowerCase() ?? "";

  if (
    !contentType.startsWith(
      "application/json"
    )
  ) {
    return jsonResponse(
      {
        error:
          "Content-Type must be application/json.",
      },
      415
    );
  }

  const idempotencyKey =
    request.headers
      .get("idempotency-key")
      ?.trim();

  if (
    !idempotencyKey ||
    idempotencyKey.length >
      MAX_IDEMPOTENCY_KEY_LENGTH
  ) {
    return jsonResponse(
      {
        error:
          "Provide an Idempotency-Key header containing 1 to 200 characters.",
      },
      400
    );
  }

  let rawBody: string;

  try {
    rawBody =
      await readLimitedBody(
        request
      );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "PAYLOAD_TOO_LARGE"
    ) {
      return jsonResponse(
        {
          error:
            "Webhook payload cannot exceed 256 KB.",
        },
        413
      );
    }

    return jsonResponse(
      {
        error:
          "Unable to read the webhook payload.",
      },
      400
    );
  }

  let input: unknown;

  try {
    input = JSON.parse(rawBody);
  } catch {
    return jsonResponse(
      {
        error:
          "The webhook body must contain valid JSON.",
      },
      400
    );
  }

  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    return jsonResponse(
      {
        error:
          "The webhook JSON body must be an object.",
      },
      400
    );
  }

  const payloadHash =
    hashPayload(rawBody);

  const existingRequest =
    await findWebhookRequest({
      webhookId: webhook.id,
      idempotencyKey,
    });

  if (existingRequest) {
    if (
      existingRequest.payloadHash !==
      payloadHash
    ) {
      return jsonResponse(
        {
          error:
            "This Idempotency-Key was already used with a different payload.",
        },
        409
      );
    }

    return jsonResponse(
      {
        accepted: true,
        duplicate: true,
        runId:
          existingRequest.runId,
        status:
          existingRequest.runStatus,
      },
      200
    );
  }

  try {
    const run =
      await queueWorkflowRun({
        workflowId:
          webhook.workflowId,
        triggerType: "WEBHOOK",
        input:
          input as Record<
            string,
            unknown
          >,
        triggeredBy: null,
        webhookRequest: {
          webhookId: webhook.id,
          idempotencyKey,
          payloadHash,
        },
      });

    return jsonResponse(
      {
        accepted: true,
        duplicate: false,
        runId: run.id,
        status: run.status,
      },
      202
    );
  } catch (error) {
    if (
      error instanceof
      DuplicateWebhookRequestError
    ) {
      const duplicateRequest =
        await findWebhookRequest({
          webhookId: webhook.id,
          idempotencyKey,
        });

      if (
        duplicateRequest &&
        duplicateRequest.payloadHash ===
          payloadHash
      ) {
        return jsonResponse(
          {
            accepted: true,
            duplicate: true,
            runId:
              duplicateRequest.runId,
            status:
              duplicateRequest.runStatus,
          },
          200
        );
      }

      return jsonResponse(
        {
          error:
            "This Idempotency-Key was already used with a different payload.",
        },
        409
      );
    }

    if (
      error instanceof
      WorkflowRunQueueError
    ) {
      const badWorkflowState =
        error.message ===
          "Workflow not found." ||
        error.message ===
          "Only active workflows can be executed." ||
        error.message ===
          "The workflow has no published version.";

      return jsonResponse(
        {
          error: badWorkflowState
            ? error.message
            : "Failed to queue workflow execution.",
        },
        badWorkflowState
          ? 409
          : 500
      );
    }

    console.error(
      "Webhook execution failed.",
      error
    );

    return jsonResponse(
      {
        error:
          "Failed to process the webhook.",
      },
      500
    );
  }
}
