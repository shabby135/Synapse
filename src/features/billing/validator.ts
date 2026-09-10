import { z } from "zod";

export const workspaceBillingSchema =
  z.object({
    workspaceId: z
      .string()
      .uuid(
        "Invalid workspace ID."
      ),
  });

export type WorkspaceBillingInput =
  z.infer<
    typeof workspaceBillingSchema
  >;