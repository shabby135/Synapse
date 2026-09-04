import type { WorkflowNodeData } from "./types";

type ExecuteActionOptions = {
  runId: string;
  workflowId: string;
  nodeId: string;
  data: WorkflowNodeData;
  input: Record<string, unknown>;
};

export class UnsupportedWorkflowActionError extends Error {
  constructor(actionType: string) {
    super(
      `Action type ${actionType} is not implemented yet.`
    );

    this.name =
      "UnsupportedWorkflowActionError";
  }
}

export async function executeAction({
  runId,
  workflowId,
  nodeId,
  data,
  input,
}: ExecuteActionOptions): Promise<
  Record<string, unknown>
> {
  const actionType =
    data.configuration?.actionType;

  if (
    typeof actionType !== "string" ||
    !actionType.trim()
  ) {
    throw new Error(
      `Node ${data.label} has no action type.`
    );
  }

  switch (actionType) {
    case "NO_OP":
      return {
        success: true,
        message:
          "Test action completed.",
        runId,
        workflowId,
        nodeId,
        receivedInput: input,
      };

    default:
      throw new UnsupportedWorkflowActionError(
        actionType
      );
  }
}