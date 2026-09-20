import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import {
  integrationProvider,
  workspaceIntegration,
} from "./workspace-integration";
import { workspace } from "./workspace";

export const integrationOAuthState =
  pgTable(
    "integration_oauth_state",
    {
      id: text("id").primaryKey(),
      stateHash: text("state_hash")
        .notNull(),
      workspaceId: text(
        "workspace_id"
      )
        .notNull()
        .references(() => workspace.id, {
          onDelete: "cascade",
        }),
      provider:
        integrationProvider(
          "provider"
        ).notNull(),
      connectionName: text(
        "connection_name"
      ).notNull(),
      integrationId: text(
        "integration_id"
      ).references(
        () => workspaceIntegration.id,
        {
          onDelete: "cascade",
        }
      ),
      userId: text("user_id")
        .notNull()
        .references(() => user.id, {
          onDelete: "cascade",
        }),
      redirectUri: text(
        "redirect_uri"
      ).notNull(),
      encryptedCodeVerifier: text(
        "encrypted_code_verifier"
      ).notNull(),
      initializationVector: text(
        "initialization_vector"
      ).notNull(),
      authenticationTag: text(
        "authentication_tag"
      ).notNull(),
      keyVersion: integer(
        "key_version"
      ).notNull(),
      expiresAt: timestamp(
        "expires_at"
      ).notNull(),
      createdAt: timestamp(
        "created_at"
      )
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex(
        "integration_oauth_state_hash_idx"
      ).on(table.stateHash),
      index(
        "integration_oauth_state_expiry_idx"
      ).on(table.expiresAt),
      index(
        "integration_oauth_state_workspace_idx"
      ).on(table.workspaceId),
    ]
  );
