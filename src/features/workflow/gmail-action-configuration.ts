import type {
  WorkflowNodeData,
} from "./types";

export type GmailActionConfiguration = {
  actionType: "GMAIL_SEND_EMAIL";
  integrationId: string;
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo: string | null;
  subject: string;
  body: string;
  contentType:
    | "PLAIN_TEXT"
    | "HTML";
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_RECIPIENTS = 100;
const MAX_ADDRESS_SOURCE_LENGTH =
  20_000;
const MAX_BODY_BYTES = 5_000_000;
const MAX_SUBJECT_LENGTH = 998;

export class GmailActionError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GmailActionError";
  }
}

function readText(
  value: unknown
): string {
  return typeof value === "string"
    ? value
    : "";
}

function parseAddresses(
  value: unknown,
  label: string
): string[] {
  const source = readText(value);

  if (
    source.length >
    MAX_ADDRESS_SOURCE_LENGTH
  ) {
    throw new GmailActionError(
      `${label} recipients are too long.`
    );
  }

  const addresses = source
    .split(/[\n,;]/)
    .map((address) =>
      address.trim()
    )
    .filter(Boolean);

  const uniqueAddresses = new Map<
    string,
    string
  >();

  for (const address of addresses) {
    if (
      address.length > 254 ||
      !EMAIL_PATTERN.test(address)
    ) {
      throw new GmailActionError(
        `Invalid ${label.toLowerCase()} email: ${address}.`
      );
    }

    const normalizedAddress =
      address.toLowerCase();

    if (
      !uniqueAddresses.has(
        normalizedAddress
      )
    ) {
      uniqueAddresses.set(
        normalizedAddress,
        address
      );
    }
  }

  return [
    ...uniqueAddresses.values(),
  ];
}

export function parseGmailActionConfiguration(
  data: WorkflowNodeData
): GmailActionConfiguration {
  const configuration =
    data.configuration ?? {};

  if (
    configuration.actionType !==
    "GMAIL_SEND_EMAIL"
  ) {
    throw new GmailActionError(
      `${data.label} is not a Gmail send-email action.`
    );
  }

  const integrationId = readText(
    configuration.integrationId
  ).trim();

  if (
    !UUID_PATTERN.test(
      integrationId
    )
  ) {
    throw new GmailActionError(
      `${data.label} requires a valid Gmail integration.`
    );
  }

  const seenAddresses =
    new Set<string>();

  function removeCrossFieldDuplicates(
    addresses: string[]
  ): string[] {
    return addresses.filter(
      (address) => {
        const normalizedAddress =
          address.toLowerCase();

        if (
          seenAddresses.has(
            normalizedAddress
          )
        ) {
          return false;
        }

        seenAddresses.add(
          normalizedAddress
        );

        return true;
      }
    );
  }

  const to =
    removeCrossFieldDuplicates(
      parseAddresses(
        configuration.to,
        "To"
      )
    );

  const cc =
    removeCrossFieldDuplicates(
      parseAddresses(
        configuration.cc,
        "Cc"
      )
    );

  const bcc =
    removeCrossFieldDuplicates(
      parseAddresses(
        configuration.bcc,
        "Bcc"
      )
    );

  if (to.length === 0) {
    throw new GmailActionError(
      `${data.label} requires at least one recipient.`
    );
  }

  if (
    to.length +
      cc.length +
      bcc.length >
    MAX_RECIPIENTS
  ) {
    throw new GmailActionError(
      `Add at most ${MAX_RECIPIENTS} recipients.`
    );
  }

  const replyToValue = readText(
    configuration.replyTo
  ).trim();

  if (
    replyToValue &&
    (replyToValue.length > 254 ||
      !EMAIL_PATTERN.test(
        replyToValue
      ))
  ) {
    throw new GmailActionError(
      "Enter a valid reply-to email address."
    );
  }

  const subject = readText(
    configuration.subject
  ).trim();

  if (
    !subject ||
    subject.length >
      MAX_SUBJECT_LENGTH ||
    /[\r\n]/.test(subject)
  ) {
    throw new GmailActionError(
      `${data.label} requires a single-line subject of at most ${MAX_SUBJECT_LENGTH} characters.`
    );
  }

  const body = readText(
    configuration.body
  );

  if (!body.trim()) {
    throw new GmailActionError(
      `${data.label} requires an email body.`
    );
  }

  if (
    Buffer.byteLength(
      body,
      "utf8"
    ) > MAX_BODY_BYTES
  ) {
    throw new GmailActionError(
      "Email body cannot exceed 5 MB."
    );
  }

  const contentType =
    configuration.contentType ===
    "HTML"
      ? "HTML"
      : configuration.contentType ===
          "PLAIN_TEXT"
        ? "PLAIN_TEXT"
        : null;

  if (!contentType) {
    throw new GmailActionError(
      "Select a valid email content type."
    );
  }

  return {
    actionType:
      "GMAIL_SEND_EMAIL",
    integrationId,
    to,
    cc,
    bcc,
    replyTo:
      replyToValue || null,
    subject,
    body,
    contentType,
  };
}