import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import {
  integrationProviderValues,
} from "@/features/integration/provider-registry";

import { user } from "./auth";
import { workspace } from "./workspace";

export const integrationProvider =
  pgEnum(
    "integration_provider",
    integrationProviderValues
  );

export const integrationConnectionStatus =
  pgEnum(
    "integration_connection_status",
    [
      "ACTIVE",
      "NEEDS_REAUTH",
      "ERROR",
      "DISABLED",
    ]
  );

export const workspaceIntegration =
  pgTable(
    "workspace_integration",
    {
      id: text("id").primaryKey(),

      workspaceId: text(
        "workspace_id"
      )
        .notNull()
        .references(
          () => workspace.id,
          {
            onDelete: "cascade",
          }
        ),

      provider:
        integrationProvider(
          "provider"
        ).notNull(),

      name: text("name").notNull(),

      status:
        integrationConnectionStatus(
          "status"
        )
          .default("ACTIVE")
          .notNull(),

      encryptedValue: text(
        "encrypted_value"
      ).notNull(),

      initializationVector: text(
        "initialization_vector"
      ).notNull(),

      authenticationTag: text(
        "authentication_tag"
      ).notNull(),

      keyVersion: integer(
        "key_version"
      )
        .default(1)
        .notNull(),

      credentialFormatVersion: integer(
        "credential_format_version"
      )
        .default(1)
        .notNull(),

      metadata: jsonb("metadata")
        .$type<Record<string, unknown>>()
        .default({})
        .notNull(),

      externalAccountId: text(
        "external_account_id"
      ),

      externalAccountName: text(
        "external_account_name"
      ),

      expiresAt: timestamp(
        "expires_at"
      ),

      lastTestedAt: timestamp(
        "last_tested_at"
      ),

      lastError: text("last_error"),

      disabledAt: timestamp(
        "disabled_at"
      ),

      createdBy: text(
        "created_by"
      ).references(() => user.id, {
        onDelete: "set null",
      }),

      createdAt: timestamp(
        "created_at"
      )
        .defaultNow()
        .notNull(),

      updatedAt: timestamp(
        "updated_at"
      )
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
    },
    (table) => [
      uniqueIndex(
        "workspace_integration_workspace_provider_name_idx"
      ).on(
        table.workspaceId,
        table.provider,
        table.name
      ),

      index(
        "workspace_integration_workspace_id_idx"
      ).on(table.workspaceId),

      index(
        "workspace_integration_workspace_provider_idx"
      ).on(
        table.workspaceId,
        table.provider
      ),

      index(
        "workspace_integration_workspace_status_idx"
      ).on(
        table.workspaceId,
        table.status
      ),
    ]
  );

export const workspaceIntegrationRelations =
  relations(
    workspaceIntegration,
    ({ one }) => ({
      workspace: one(workspace, {
        fields: [
          workspaceIntegration.workspaceId,
        ],
        references: [workspace.id],
      }),

      creator: one(user, {
        fields: [
          workspaceIntegration.createdBy,
        ],
        references: [user.id],
      }),
    })
  );
