import type {
  IntegrationTriggerCursor,
} from "@/lib/db/schema/workflow-integration-trigger";

export type IntegrationTriggerEvent = {
  key: string;
  input: Record<string, unknown>;
};

export type IntegrationTriggerPollResult = {
  events: IntegrationTriggerEvent[];
  cursor: IntegrationTriggerCursor;
  pollIntervalMinutes: number;
};

export type IntegrationTriggerPollOptions = {
  workflowId: string;
  nodeId: string;
  configuration: Record<
    string,
    unknown
  >;
  cursor:
    | IntegrationTriggerCursor
    | null;
};

export type IntegrationTriggerHandler = {
  type: string;
  provider: string;
  poll: (
    options: IntegrationTriggerPollOptions
  ) => Promise<IntegrationTriggerPollResult>;
};

const handlers = new Map<
  string,
  IntegrationTriggerHandler
>();

export function registerIntegrationTriggerHandler(
  handler: IntegrationTriggerHandler
) {
  if (handlers.has(handler.type)) {
    throw new Error(
      `Integration trigger ${handler.type} is registered more than once.`
    );
  }

  handlers.set(
    handler.type,
    handler
  );
}

export function getIntegrationTriggerHandler(
  triggerType: string
): IntegrationTriggerHandler | null {
  return (
    handlers.get(triggerType) ?? null
  );
}

export function isIntegrationTriggerType(
  triggerType: string
): boolean {
  return handlers.has(triggerType);
}