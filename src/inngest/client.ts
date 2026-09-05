import {
  eventType,
  Inngest,
  staticSchema,
} from "inngest";

type WorkflowRunRequestedPayload = {
  runId: string;
};

export const workflowRunRequested =
  eventType(
    "workflow/run.requested",
    {
      schema:
        staticSchema<WorkflowRunRequestedPayload>(),
    }
  );

export const inngest = new Inngest({
  id: "synapse",
});