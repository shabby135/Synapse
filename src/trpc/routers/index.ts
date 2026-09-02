import { router } from "../init";

import { userRouter } from "./user";
import { workflowRouter } from "./workflow";
import { workspaceRouter } from "./workspace";

export const appRouter = router({
  user: userRouter,
  workspace: workspaceRouter,
  workflow: workflowRouter,
});

export type AppRouter = typeof appRouter;