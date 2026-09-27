import type {
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
} from "./types";
import {
  createActionConfiguration,
  type WorkflowActionType,
} from "./workflow-node-catalog";

export type WorkflowTemplateId =
  | "FORM_AI_SLACK"
  | "GMAIL_AI_TRELLO"
  | "GITHUB_TO_JIRA"
  | "MANUAL_AI_EMAIL";

export type WorkflowTemplate = {
  id: WorkflowTemplateId;
  name: string;
  description: string;
  steps: readonly string[];
};

export const workflowTemplates = [
  {
    id: "FORM_AI_SLACK",
    name: "Form response triage",
    description:
      "Classify each Google Forms response and notify Slack.",
    steps: [
      "Google Forms",
      "AI prompt",
      "Slack",
    ],
  },
  {
    id: "GMAIL_AI_TRELLO",
    name: "Email to task",
    description:
      "Summarize a new Gmail message and create a Trello card.",
    steps: [
      "Gmail",
      "AI prompt",
      "Trello",
    ],
  },
  {
    id: "GITHUB_TO_JIRA",
    name: "Issue escalation",
    description:
      "Copy new GitHub issues into a Jira project.",
    steps: [
      "GitHub",
      "Jira",
    ],
  },
  {
    id: "MANUAL_AI_EMAIL",
    name: "AI email assistant",
    description:
      "Run an AI prompt manually and send the result with Gmail.",
    steps: [
      "Manual",
      "AI prompt",
      "Gmail",
    ],
  },
] as const satisfies readonly WorkflowTemplate[];

function triggerNode({
  label,
  description,
  configuration,
}: {
  label: string;
  description: string;
  configuration: Record<
    string,
    unknown
  >;
}): WorkflowCanvasNode {
  return {
    id: "trigger-1",
    type: "trigger",
    position: {
      x: 80,
      y: 220,
    },
    data: {
      label,
      description,
      configuration,
    },
    deletable: false,
  };
}

function actionNode(
  id: string,
  order: number,
  label: string,
  description: string,
  actionType: WorkflowActionType,
  configuration?: Record<
    string,
    unknown
  >
): WorkflowCanvasNode {
  return {
    id,
    type: "action",
    position: {
      x: 410 + (order - 1) * 340,
      y: 220,
    },
    data: {
      label,
      description,
      configuration: {
        ...createActionConfiguration(
          actionType
        ),
        ...configuration,
      },
    },
  };
}

function connect(
  source: string,
  target: string
): WorkflowCanvasEdge {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    type: "smoothstep",
    animated: true,
  };
}

export function createWorkflowTemplateDefinition(
  templateId: WorkflowTemplateId
): {
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
} {
  switch (templateId) {
    case "FORM_AI_SLACK": {
      const nodes: WorkflowCanvasNode[] = [
        triggerNode({
          label: "New form response",
          description:
            "Starts when a response is submitted.",
          configuration: {
            triggerType:
              "GOOGLE_FORMS_NEW_RESPONSE",
            integrationId: "",
            formId: "",
            startMode: "FROM_NOW",
            pollIntervalMinutes: 1,
          },
        }),
        actionNode(
          "action-ai",
          1,
          "Classify response",
          "Summarize and classify the submitted response.",
          "AI_PROMPT",
          {
            prompt:
              "Summarize this form response and classify its priority as low, medium, or high:\n\n{{input}}",
          }
        ),
        actionNode(
          "action-slack",
          2,
          "Notify the team",
          "Send the AI result to Slack.",
          "SLACK_MESSAGE",
          {
            message:
              "New form response triaged:\n\n{{input}}",
          }
        ),
      ];

      return {
        nodes,
        edges: [
          connect(
            "trigger-1",
            "action-ai"
          ),
          connect(
            "action-ai",
            "action-slack"
          ),
        ],
      };
    }

    case "GMAIL_AI_TRELLO": {
      const nodes: WorkflowCanvasNode[] = [
        triggerNode({
          label: "New support email",
          description:
            "Starts when a matching Gmail message arrives.",
          configuration: {
            triggerType:
              "GMAIL_NEW_EMAIL",
            integrationId: "",
            labelId: "INBOX",
            searchQuery: "",
            startMode: "FROM_NOW",
            pollIntervalMinutes: 1,
          },
        }),
        actionNode(
          "action-ai",
          1,
          "Summarize request",
          "Turn the email into a concise task summary.",
          "AI_PROMPT",
          {
            prompt:
              "Convert this email into a concise task with a title, summary, and priority:\n\n{{input}}",
          }
        ),
        actionNode(
          "action-trello",
          2,
          "Create Trello task",
          "Add the summarized request to Trello.",
          "TRELLO_CREATE_CARD",
          {
            name:
              "Support request from workflow",
            description: "{{input}}",
          }
        ),
      ];

      return {
        nodes,
        edges: [
          connect(
            "trigger-1",
            "action-ai"
          ),
          connect(
            "action-ai",
            "action-trello"
          ),
        ],
      };
    }

    case "GITHUB_TO_JIRA": {
      const nodes: WorkflowCanvasNode[] = [
        triggerNode({
          label: "New GitHub issue",
          description:
            "Starts when an issue is opened in a repository.",
          configuration: {
            triggerType:
              "GITHUB_NEW_ISSUE",
            integrationId: "",
            repository: "",
            labels: "",
            startMode: "FROM_NOW",
            pollIntervalMinutes: 1,
          },
        }),
        actionNode(
          "action-jira",
          1,
          "Create Jira issue",
          "Escalate the GitHub issue to Jira.",
          "JIRA_CREATE_ISSUE",
          {
            summary:
              "GitHub issue: {{input.title}}",
            description:
              "{{input.body}}",
          }
        ),
      ];

      return {
        nodes,
        edges: [
          connect(
            "trigger-1",
            "action-jira"
          ),
        ],
      };
    }

    case "MANUAL_AI_EMAIL": {
      const nodes: WorkflowCanvasNode[] = [
        triggerNode({
          label: "Manual trigger",
          description:
            "Starts when the workflow is run manually.",
          configuration: {
            triggerType: "MANUAL",
          },
        }),
        actionNode(
          "action-ai",
          1,
          "Draft an email",
          "Generate an email from the run input.",
          "AI_PROMPT",
          {
            prompt:
              "Write a clear professional email from this input. Return only the email body:\n\n{{input}}",
          }
        ),
        actionNode(
          "action-gmail",
          2,
          "Send email",
          "Send the generated result with Gmail.",
          "GMAIL_SEND_EMAIL",
          {
            subject:
              "Message from Synapse",
            body: "{{input}}",
          }
        ),
      ];

      return {
        nodes,
        edges: [
          connect(
            "trigger-1",
            "action-ai"
          ),
          connect(
            "action-ai",
            "action-gmail"
          ),
        ],
      };
    }
  }
}