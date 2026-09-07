import { router } from "../init";

import { userRouter } from "./user";
import { workflowRouter } from "./workflow";
import { integrationRouter } from "./integration";
import { workspaceRouter } from "./workspace";

export const appRouter = router({
    integration: integrationRouter,
  user: userRouter,
  workspace: workspaceRouter,
  workflow: workflowRouter,
});

export type AppRouter = typeof appRouter;