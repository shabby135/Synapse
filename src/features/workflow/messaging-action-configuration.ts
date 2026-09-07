import type {
  WorkflowNodeData,
} from "./types";

export type MessagingProvider =
  | "SLACK"
  | "DISCORD";

export type MessagingActionType =
  | "SLACK_MESSAGE"
  | "DISCORD_MESSAGE";

export type MessagingActionConfiguration = {
  actionType: MessagingActionType;
  provider: MessagingProvider;
  integrationId: string;
  message: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_SLACK_MESSAGE_LENGTH = 4_000;
const MAX_DISCORD_MESSAGE_LENGTH = 2_000;
const MAX_SERIALIZED_INPUT_LENGTH =
  100_000;

export class MessagingActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessagingActionError";
  }
}

export function parseMessagingActionConfiguration(
  data: WorkflowNodeData
): MessagingActionConfiguration {
  const configuration =
    data.configuration ?? {};

  const actionType =
    configuration.actionType;

  if (
    actionType !== "SLACK_MESSAGE" &&
    actionType !== "DISCORD_MESSAGE"
  ) {
    throw new MessagingActionError(
      `${data.label} does not contain a supported messaging action.`
    );
  }

  const provider: MessagingProvider =
    actionType === "SLACK_MESSAGE"
      ? "SLACK"
      : "DISCORD";

  const integrationId =
    typeof configuration.integrationId ===
    "string"
      ? configuration.integrationId.trim()
      : "";

  if (
    !integrationId ||
    !UUID_PATTERN.test(integrationId)
  ) {
    throw new MessagingActionError(
      `${data.label} requires a valid ${provider === "SLACK" ? "Slack" : "Discord"} integration.`
    );
  }

  const message =
    typeof configuration.message ===
    "string"
      ? configuration.message
      : "";

  if (!message.trim()) {
    throw new MessagingActionError(
      `${data.label} requires a message.`
    );
  }

  const maximumLength =
    provider === "SLACK"
      ? MAX_SLACK_MESSAGE_LENGTH
      : MAX_DISCORD_MESSAGE_LENGTH;

  if (message.length > maximumLength) {
    throw new MessagingActionError(
      `${provider === "SLACK" ? "Slack" : "Discord"} messages cannot exceed ${maximumLength} characters.`
    );
  }

  return {
    actionType,
    provider,
    integrationId,
    message,
  };
}

export function resolveMessagingTemplate(
  message: string,
  input: Record<string, unknown>
): string {
  let serializedInput: string;

  try {
    serializedInput = JSON.stringify(
      input,
      null,
      2
    );
  } catch {
    throw new MessagingActionError(
      "The workflow input could not be converted to JSON."
    );
  }

  if (
    serializedInput.length >
    MAX_SERIALIZED_INPUT_LENGTH
  ) {
    throw new MessagingActionError(
      "The workflow input is too large for a message."
    );
  }

  return message.includes("{{input}}")
    ? message.replaceAll(
        "{{input}}",
        serializedInput
      )
    : message;
}