import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import {
  executeWorkflow,
} from "@/inngest/functions/execute-workflow";
import {
  pollIntegrationTriggers,
} from "@/inngest/functions/poll-integration-triggers";

export const {
  GET,
  POST,
  PUT,
} = serve({
  client: inngest,
  functions: [
    executeWorkflow,
    pollIntegrationTriggers,
  ],
});