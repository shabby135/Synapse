import {
  createTRPCClient,
  httpBatchLink,
} from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "./routers";

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return "";
  }

  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
}

export const trpcClient =
  createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        transformer: superjson,
      }),
    ],
  });