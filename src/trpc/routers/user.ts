import {
  asc,
  eq,
} from "drizzle-orm";

import { account } from "@/lib/db/schema";

import {
  protectedProcedure,
  router,
} from "../init";

export const userRouter = router({
  me: protectedProcedure.query(({ ctx }) => {
    return ctx.session;
  }),

  listAccounts: protectedProcedure.query(
    async ({ ctx }) => {
      return ctx.db
        .select({
          id: account.id,
          providerId: account.providerId,
          createdAt: account.createdAt,
        })
        .from(account)
        .where(
          eq(
            account.userId,
            ctx.session.user.id
          )
        )
        .orderBy(asc(account.createdAt));
    }
  ),
});
