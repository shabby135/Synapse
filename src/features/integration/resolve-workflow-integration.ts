import "server-only";

import {
  and,
  eq,
} from "drizzle-orm";

import { db } from "@/lib/db";
import {
  workspaceIntegration,
} from "@/lib/db/schema/workspace-integration";
import {
  workflow,
} from "@/lib/db/schema/workflow";

import {
  createIntegrationSecretContext,
  decryptIntegrationSecret,
} from "./encryption";
import {
  createIntegrationSchema,
  type IntegrationProvider,
} from "./validator";

type ResolveWorkflowIntegrationOptions = {
  workflowId: string;
  integrationId: string;
  provider: IntegrationProvider;
};

export type ResolvedWorkflowIntegration = {
  id: string;
  workspaceId: string;
  provider: IntegrationProvider;
  name: string;
  webhookUrl: string;
};

export class WorkflowIntegrationError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "WorkflowIntegrationError";
  }
}

export async function resolveWorkflowIntegration({
  workflowId,
  integrationId,
  provider,
}: ResolveWorkflowIntegrationOptions): Promise<ResolvedWorkflowIntegration> {
  const rows = await db
    .select({
      id: workspaceIntegration.id,
      workspaceId:
        workspaceIntegration.workspaceId,
      provider:
        workspaceIntegration.provider,
      name: workspaceIntegration.name,
      encryptedValue:
        workspaceIntegration.encryptedValue,
      initializationVector:
        workspaceIntegration
          .initializationVector,
      authenticationTag:
        workspaceIntegration
          .authenticationTag,
      keyVersion:
        workspaceIntegration.keyVersion,
    })
    .from(workspaceIntegration)
    .innerJoin(
      workflow,
      eq(
        workflow.workspaceId,
        workspaceIntegration.workspaceId
      )
    )
    .where(
      and(
        eq(workflow.id, workflowId),
        eq(
          workspaceIntegration.id,
          integrationId
        ),
        eq(
          workspaceIntegration.provider,
          provider
        )
      )
    )
    .limit(1);

  const integration = rows[0];

  if (!integration) {
    throw new WorkflowIntegrationError(
      `The selected ${provider.toLowerCase()} integration does not exist in this workspace.`
    );
  }

  const context =
    createIntegrationSecretContext({
      workspaceId:
        integration.workspaceId,
      provider:
        integration.provider,
      integrationId:
        integration.id,
    });

  let webhookUrl: string;

  try {
    webhookUrl =
      decryptIntegrationSecret({
        encryptedValue:
          integration.encryptedValue,
        initializationVector:
          integration
            .initializationVector,
        authenticationTag:
          integration.authenticationTag,
        keyVersion:
          integration.keyVersion,
        context,
      });
  } catch {
    throw new WorkflowIntegrationError(
      `The ${provider.toLowerCase()} integration credential could not be decrypted.`
    );
  }

  const validation =
    createIntegrationSchema.safeParse({
      workspaceId:
        integration.workspaceId,
      provider:
        integration.provider,
      name: integration.name,
      webhookUrl,
    });

  if (!validation.success) {
    throw new WorkflowIntegrationError(
      `The stored ${provider.toLowerCase()} webhook URL is invalid.`
    );
  }

  return {
    id: integration.id,
    workspaceId:
      integration.workspaceId,
    provider:
      integration.provider,
    name: integration.name,
    webhookUrl,
  };
}