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
} from "./encryption";
import {
  decryptIntegrationCredentials,
} from "./credential-store";
import {
  validateProviderCredentials,
} from "./credential-definition";
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
  credentials: Readonly<
    Record<string, string>
  >;
};

export type ResolvedWebhookWorkflowIntegration =
  ResolvedWorkflowIntegration & {
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
      credentialFormatVersion:
        workspaceIntegration
          .credentialFormatVersion,
      status:
        workspaceIntegration.status,
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

  if (
    integration.status !== "ACTIVE"
  ) {
    throw new WorkflowIntegrationError(
      `The selected ${provider.toLowerCase()} integration is not active.`
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

  let credentials: Readonly<
    Record<string, string>
  >;

  try {
    credentials =
      validateProviderCredentials(
        integration.provider,
        decryptIntegrationCredentials({
          provider:
            integration.provider,
          credentialFormatVersion:
            integration
              .credentialFormatVersion,
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
        })
      );
  } catch {
    throw new WorkflowIntegrationError(
      `The ${provider.toLowerCase()} integration credential could not be decrypted.`
    );
  }

  return {
    id: integration.id,
    workspaceId:
      integration.workspaceId,
    provider:
      integration.provider,
    name: integration.name,
    credentials,
  };
}

export async function resolveWorkflowWebhookIntegration(
  options: ResolveWorkflowIntegrationOptions
): Promise<ResolvedWebhookWorkflowIntegration> {
  const integration =
    await resolveWorkflowIntegration(
      options
    );

  const webhookUrl =
    integration.credentials.webhookUrl;

  if (!webhookUrl) {
    throw new WorkflowIntegrationError(
      `The ${options.provider.toLowerCase()} integration does not contain a webhook URL.`
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
      `The stored ${options.provider.toLowerCase()} webhook URL is invalid.`
    );
  }

  return {
    ...integration,
    webhookUrl,
  };
}
