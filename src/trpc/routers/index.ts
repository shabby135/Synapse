import { router } from "../init";
import { userRouter } from "./user";
import { workspaceRouter } from "./workspace";

export const appRouter = router({
  user: userRouter,
  workspace: workspaceRouter,
});

export type AppRouter = typeof appRouter;