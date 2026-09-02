import {
  protectedProcedure,
  router,
} from "../init";

export const userRouter = router({
  me: protectedProcedure.query(
    ({ ctx }) => {
      return ctx.session;
    }
  ),
});