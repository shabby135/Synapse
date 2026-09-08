import { z } from "zod";

export const workflowWebhookIdSchema =
  z.object({
    id: z
      .string()
      .uuid(
        "Invalid workflow webhook ID."
      ),
  });

export const workflowWebhookByWorkflowSchema =
  z.object({
    workflowId: z
      .string()
      .uuid(
        "Invalid workflow ID."
      ),
  });

export const setWorkflowWebhookEnabledSchema =
  z.object({
    workflowId: z
      .string()
      .uuid(
        "Invalid workflow ID."
      ),

    enabled: z.boolean(),
  });

export type WorkflowWebhookByWorkflowInput =
  z.infer<
    typeof workflowWebhookByWorkflowSchema
  >;

export type SetWorkflowWebhookEnabledInput =
  z.infer<
    typeof setWorkflowWebhookEnabledSchema
  >;