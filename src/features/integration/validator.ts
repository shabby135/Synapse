import { z } from "zod";

import {
  integrationProviderValues,
  type IntegrationProvider,
} from "./provider-registry";

export const integrationProviderSchema =
  z.enum(integrationProviderValues);

export const integrationIdSchema =
  z.object({
    id: z
      .string()
      .uuid(
        "Invalid integration ID."
      ),
  });

const integrationNameSchema = z
  .string()
  .trim()
  .min(
    2,
    "Integration name must contain at least 2 characters."
  )
  .max(
    50,
    "Integration name cannot exceed 50 characters."
  );

const integrationCredentialsSchema = z
  .record(
    z.string().min(1).max(64),
    z
      .string()
      .min(
        1,
        "Credential values cannot be empty."
      )
      .max(
        50_000,
        "A credential value is too long."
      )
  )
  .refine(
    (credentials) => {
      const count = Object.keys(
        credentials
      ).length;

      return count >= 1 && count <= 20;
    },
    "Provide between 1 and 20 credential fields."
  );

export const listIntegrationsSchema =
  z.object({
    workspaceId: z
      .string()
      .uuid(
        "Invalid workspace ID."
      ),
    provider:
      integrationProviderSchema
        .optional(),
  });

export const createIntegrationSchema =
  z.object({
    workspaceId: z
      .string()
      .uuid(
        "Invalid workspace ID."
      ),
    provider:
      integrationProviderSchema,
    name: integrationNameSchema,
    credentials:
      integrationCredentialsSchema,
  });

export const updateIntegrationSchema =
  z.object({
    id: z
      .string()
      .uuid(
        "Invalid integration ID."
      ),
    name: integrationNameSchema,
  });

export const reconnectIntegrationSchema =
  z.object({
    id: z
      .string()
      .uuid(
        "Invalid integration ID."
      ),
    credentials:
      integrationCredentialsSchema,
  });

export const testIntegrationSchema =
  integrationIdSchema;

export const deleteIntegrationSchema =
  integrationIdSchema;

export type { IntegrationProvider };

export type ListIntegrationsInput =
  z.infer<
    typeof listIntegrationsSchema
  >;

export type CreateIntegrationInput =
  z.infer<
    typeof createIntegrationSchema
  >;

export type UpdateIntegrationInput =
  z.infer<
    typeof updateIntegrationSchema
  >;
