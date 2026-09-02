import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function createTRPCContext() {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  return {
    db,
    session,
    headers: requestHeaders,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;