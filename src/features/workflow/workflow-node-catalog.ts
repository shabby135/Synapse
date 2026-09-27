export type WorkflowActionCategory =
  | "AI"
  | "Communication"
  | "Productivity"
  | "Development"
  | "Utilities";

export const workflowActionCatalog = [
  {
    actionType: "AI_PROMPT",
    label: "AI prompt",
    description:
      "Generate, classify, or extract data with an AI model.",
    category: "AI",
  },
  {
    actionType: "SLACK_MESSAGE",
    label: "Send Slack message",
    description:
      "Post a mapped message to a Slack channel.",
    category: "Communication",
  },
  {
    actionType: "DISCORD_MESSAGE",
    label: "Send Discord message",
    description:
      "Post a mapped message through Discord.",
    category: "Communication",
  },
  {
    actionType: "GMAIL_SEND_EMAIL",
    label: "Send Gmail email",
    description:
      "Compose and send an email with Gmail.",
    category: "Communication",
  },
  {
    actionType:
      "GOOGLE_CALENDAR_CREATE_EVENT",
    label: "Create calendar event",
    description:
      "Add an event to Google Calendar.",
    category: "Productivity",
  },
  {
    actionType:
      "GOOGLE_SHEETS_APPEND_ROW",
    label: "Add Google Sheets row",
    description:
      "Append mapped values to a spreadsheet.",
    category: "Productivity",
  },
  {
    actionType: "TRELLO_CREATE_CARD",
    label: "Create Trello card",
    description:
      "Create a card in a selected Trello list.",
    category: "Productivity",
  },
  {
    actionType: "GITHUB_CREATE_ISSUE",
    label: "Create GitHub issue",
    description:
      "Open an issue in a GitHub repository.",
    category: "Development",
  },
  {
    actionType: "JIRA_CREATE_ISSUE",
    label: "Create Jira issue",
    description:
      "Create an issue in a Jira project.",
    category: "Development",
  },
  {
    actionType: "HTTP_REQUEST",
    label: "HTTP request",
    description:
      "Call a secure external API endpoint.",
    category: "Utilities",
  },
  {
    actionType: "NO_OP",
    label: "Test step",
    description:
      "Pass input through without changing it.",
    category: "Utilities",
  },
] as const satisfies readonly {
  actionType: string;
  label: string;
  description: string;
  category: WorkflowActionCategory;
}[];

export type WorkflowActionType =
  (typeof workflowActionCatalog)[number]["actionType"];

export function getWorkflowAction(
  actionType: string
) {
  return (
    workflowActionCatalog.find(
      (action) =>
        action.actionType === actionType
    ) ??
    workflowActionCatalog[
      workflowActionCatalog.length - 1
    ]
  );
}

export function createActionConfiguration(
  actionType: WorkflowActionType
): Record<string, unknown> {
  switch (actionType) {
    case "HTTP_REQUEST":
      return {
        actionType,
        method: "GET",
        url: "",
        headersJson: "{}",
        body: "",
        timeoutMs: 10_000,
        failOnHttpError: true,
      };

    case "AI_PROMPT":
      return {
        actionType,
        provider: "GEMINI",
        model:
          "gemini-3-flash-preview",
        systemPrompt:
          "You are a helpful assistant.",
        prompt:
          "Process the following workflow input:\n\n{{input}}",
        maxOutputTokens: 1_000,
      };

    case "SLACK_MESSAGE":
    case "DISCORD_MESSAGE":
      return {
        actionType,
        integrationId: "",
        message:
          "Workflow completed:\n\n{{input}}",
      };

    case "GOOGLE_CALENDAR_CREATE_EVENT":
      return {
        actionType,
        integrationId: "",
        calendarId: "primary",
        title: "Workflow event",
        description:
          "Created by Synapse",
        location: "",
        startDateTime: "",
        endDateTime: "",
        timeZone: "Asia/Kolkata",
        attendees: "",
        sendUpdates: false,
      };

    case "GOOGLE_SHEETS_APPEND_ROW":
      return {
        actionType,
        integrationId: "",
        spreadsheetId: "",
        range: "Sheet1!A:Z",
        valuesJson:
          '["{{input.name}}", "{{input.email}}"]',
        valueInputOption:
          "USER_ENTERED",
      };

    case "GMAIL_SEND_EMAIL":
      return {
        actionType,
        integrationId: "",
        to: "",
        cc: "",
        bcc: "",
        replyTo: "",
        subject:
          "Synapse workflow notification",
        body:
          "Workflow completed:\n\n{{input}}",
        contentType: "PLAIN_TEXT",
      };

    case "GITHUB_CREATE_ISSUE":
      return {
        actionType,
        integrationId: "",
        repository: "",
        title:
          "Issue from Synapse workflow",
        body:
          "Created automatically by Synapse.\n\n{{input}}",
        labels: "",
        assignees: "",
      };

    case "JIRA_CREATE_ISSUE":
      return {
        actionType,
        integrationId: "",
        projectKey: "",
        issueTypeId: "",
        summary:
          "Issue from Synapse workflow",
        description:
          "Created automatically by Synapse.\n\n{{input}}",
        labels: "",
        priorityId: "",
        assigneeAccountId: "",
      };

    case "TRELLO_CREATE_CARD":
      return {
        actionType,
        integrationId: "",
        listId: "",
        name:
          "Card from Synapse workflow",
        description:
          "Created automatically by Synapse.\n\n{{input}}",
        position: "bottom",
        due: "",
        dueComplete: false,
        memberIds: "",
        labelIds: "",
      };

    case "NO_OP":
      return {
        actionType,
      };
  }
}

export function actionNeedsIntegration(
  actionType: string
): boolean {
  return ![
    "NO_OP",
    "HTTP_REQUEST",
    "AI_PROMPT",
  ].includes(actionType);
}
