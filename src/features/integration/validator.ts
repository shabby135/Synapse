import { z } from "zod";

import {
  integrationProviderValues,
  type IntegrationProvider,
} from "./provider-registry";

export const integrationProviderSchema =
  z.enum(integrationProviderValues);

export const webhookIntegrationProviderSchema =
  z.enum([
    "SLACK",
    "DISCORD",
  ]);

export const integrationIdSchema =
  z.object({
    id: z
      .string()
      .uuid(
        "Invalid integration ID."
      ),
  });

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
  z
    .object({
      workspaceId: z
        .string()
        .uuid(
          "Invalid workspace ID."
        ),

      provider:
        webhookIntegrationProviderSchema,

      name: z
        .string()
        .trim()
        .min(
          2,
          "Integration name must contain at least 2 characters."
        )
        .max(
          50,
          "Integration name cannot exceed 50 characters."
        ),

      webhookUrl: z
        .string()
        .trim()
        .url(
          "Enter a valid webhook URL."
        )
        .max(
          2_000,
          "Webhook URL is too long."
        ),
    })
    .superRefine(
      (input, context) => {
        let url: URL;

        try {
          url = new URL(
            input.webhookUrl
          );
        } catch {
          return;
        }

        if (
          url.protocol !== "https:"
        ) {
          context.addIssue({
            code: "custom",
            path: ["webhookUrl"],
            message:
              "Webhook URLs must use HTTPS.",
          });

          return;
        }

        if (
          url.username ||
          url.password ||
          url.port
        ) {
          context.addIssue({
            code: "custom",
            path: ["webhookUrl"],
            message:
              "The webhook URL contains unsupported credentials or a port.",
          });

          return;
        }

        const hostname =
          url.hostname.toLowerCase();

        if (
          input.provider === "SLACK"
        ) {
          const allowedSlackHosts =
            new Set([
              "hooks.slack.com",
              "hooks.slack-gov.com",
            ]);

          const validSlackPath =
            /^\/services\/[^/]+\/[^/]+\/[^/]+\/?$/.test(
              url.pathname
            );

          if (
            !allowedSlackHosts.has(
              hostname
            ) ||
            !validSlackPath
          ) {
            context.addIssue({
              code: "custom",
              path: ["webhookUrl"],
              message:
                "Enter a valid Slack incoming-webhook URL.",
            });
          }
        }

        if (
          input.provider ===
          "DISCORD"
        ) {
          const allowedDiscordHosts =
            new Set([
              "discord.com",
              "discordapp.com",
              "canary.discord.com",
              "ptb.discord.com",
            ]);

          const validDiscordPath =
            /^\/api(?:\/v\d+)?\/webhooks\/\d+\/[^/]+\/?$/.test(
              url.pathname
            );

          if (
            !allowedDiscordHosts.has(
              hostname
            ) ||
            !validDiscordPath
          ) {
            context.addIssue({
              code: "custom",
              path: ["webhookUrl"],
              message:
                "Enter a valid Discord webhook URL.",
            });
          }
        }
      }
    );

export const updateIntegrationSchema =
  z
    .object({
      id: z
        .string()
        .uuid(
          "Invalid integration ID."
        ),

      name: z
        .string()
        .trim()
        .min(
          2,
          "Integration name must contain at least 2 characters."
        )
        .max(
          50,
          "Integration name cannot exceed 50 characters."
        )
        .optional(),

      webhookUrl: z
        .string()
        .trim()
        .url(
          "Enter a valid webhook URL."
        )
        .max(
          2_000,
          "Webhook URL is too long."
        )
        .optional(),
    })
    .refine(
      (input) =>
        input.name !== undefined ||
        input.webhookUrl !== undefined,
      {
        message:
          "Provide at least one integration field to update.",
      }
    );

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
