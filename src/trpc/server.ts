import "server-only";

import { cache } from "react";

import { createTRPCContext } from "./context";
import { createCallerFactory } from "./init";
import { appRouter } from "./routers";

export const getCaller = cache(async () => {
  const ctx = await createTRPCContext();

  return createCallerFactory(appRouter)(ctx);
});