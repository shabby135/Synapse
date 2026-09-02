import { TRPCError } from "@trpc/server";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
} from "drizzle-orm";

import {
  user,
  workspace,
  workspaceMember,
} from "@/lib/db/schema";

import { generateSlug } from "@/lib/slug";

import { WorkspaceService } from "@/features/workspace/service";
import { requireWorkspacePermission } from "@/features/workspace/authorization";

import {
  addWorkspaceMemberSchema,
  createWorkspaceSchema,
  removeWorkspaceMemberSchema,
  updateWorkspaceMemberRoleSchema,
  workspaceIdSchema,
} from "@/features/workspace/validator";

import {
  protectedProcedure,
  router,
} from "../init";

export const workspaceRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        image: workspace.image,
        role: workspaceMember.role,
        createdAt: workspace.createdAt,
      })
      .from(workspaceMember)
      .innerJoin(
        workspace,
        eq(
          workspaceMember.workspaceId,
          workspace.id
        )
      )
      .where(
        eq(
          workspaceMember.userId,
          ctx.session.user.id
        )
      )
      .orderBy(desc(workspace.createdAt));
  }),

  getById: protectedProcedure
    .input(workspaceIdSchema)
    .query(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .select({
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          image: workspace.image,
          ownerId: workspace.ownerId,
          role: workspaceMember.role,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
        })
        .from(workspaceMember)
        .innerJoin(
          workspace,
          eq(
            workspaceMember.workspaceId,
            workspace.id
          )
        )
        .where(
          and(
            eq(workspace.id, input.id),
            eq(
              workspaceMember.userId,
              ctx.session.user.id
            )
          )
        )
        .limit(1);

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Workspace not found or access denied.",
        });
      }

      return result;
    }),

  listMembers: protectedProcedure
    .input(workspaceIdSchema)
    .query(async ({ ctx, input }) => {
      await requireWorkspacePermission({
        database: ctx.db,
        workspaceId: input.id,
        userId: ctx.session.user.id,
        permission: "member:read",
      });

      return ctx.db
        .select({
          userId: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: workspaceMember.role,
          joinedAt: workspaceMember.joinedAt,
        })
        .from(workspaceMember)
        .innerJoin(
          user,
          eq(
            workspaceMember.userId,
            user.id
          )
        )
        .where(
          eq(
            workspaceMember.workspaceId,
            input.id
          )
        )
        .orderBy(
          asc(workspaceMember.joinedAt)
        );
    }),

  addMember: protectedProcedure
    .input(addWorkspaceMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const { role: currentUserRole } =
        await requireWorkspacePermission({
          database: ctx.db,
          workspaceId: input.workspaceId,
          userId: ctx.session.user.id,
          permission: "member:manage",
        });

      if (
        currentUserRole === "ADMIN" &&
        input.role === "ADMIN"
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Admins cannot create other admins.",
        });
      }

      const targetUser =
        await ctx.db.query.user.findFirst({
          where: ilike(
            user.email,
            input.email
          ),
        });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "No registered user was found with this email.",
        });
      }

      const [createdMembership] =
        await ctx.db
          .insert(workspaceMember)
          .values({
            workspaceId: input.workspaceId,
            userId: targetUser.id,
            role: input.role,
          })
          .onConflictDoNothing()
          .returning();

      if (!createdMembership) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "This user is already a workspace member.",
        });
      }

      return {
        userId: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        image: targetUser.image,
        role: createdMembership.role,
        joinedAt: createdMembership.joinedAt,
      };
    }),

  updateMemberRole: protectedProcedure
    .input(updateWorkspaceMemberRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const { role: currentUserRole } =
        await requireWorkspacePermission({
          database: ctx.db,
          workspaceId: input.workspaceId,
          userId: ctx.session.user.id,
          permission: "member:manage",
        });

      const targetMembership =
        await ctx.db.query.workspaceMember.findFirst({
          where: and(
            eq(
              workspaceMember.workspaceId,
              input.workspaceId
            ),
            eq(
              workspaceMember.userId,
              input.userId
            )
          ),
        });

      if (!targetMembership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Workspace member was not found.",
        });
      }

      if (targetMembership.role === "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "The workspace owner's role cannot be changed.",
        });
      }

      if (
        currentUserRole === "ADMIN" &&
        (targetMembership.role === "ADMIN" ||
          input.role === "ADMIN")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Admins cannot manage or promote other admins.",
        });
      }

      const [updatedMembership] =
        await ctx.db
          .update(workspaceMember)
          .set({
            role: input.role,
          })
          .where(
            and(
              eq(
                workspaceMember.workspaceId,
                input.workspaceId
              ),
              eq(
                workspaceMember.userId,
                input.userId
              )
            )
          )
          .returning();

      return updatedMembership;
    }),

  removeMember: protectedProcedure
    .input(removeWorkspaceMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const { role: currentUserRole } =
        await requireWorkspacePermission({
          database: ctx.db,
          workspaceId: input.workspaceId,
          userId: ctx.session.user.id,
          permission: "member:manage",
        });

      const targetMembership =
        await ctx.db.query.workspaceMember.findFirst({
          where: and(
            eq(
              workspaceMember.workspaceId,
              input.workspaceId
            ),
            eq(
              workspaceMember.userId,
              input.userId
            )
          ),
        });

      if (!targetMembership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Workspace member was not found.",
        });
      }

      if (targetMembership.role === "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "The workspace owner cannot be removed.",
        });
      }

      if (
        currentUserRole === "ADMIN" &&
        targetMembership.role === "ADMIN"
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Admins cannot remove other admins.",
        });
      }

      await ctx.db
        .delete(workspaceMember)
        .where(
          and(
            eq(
              workspaceMember.workspaceId,
              input.workspaceId
            ),
            eq(
              workspaceMember.userId,
              input.userId
            )
          )
        );

      return {
        success: true,
        userId: input.userId,
      };
    }),

  create: protectedProcedure
    .input(createWorkspaceSchema)
    .mutation(async ({ ctx, input }) => {
      const slug = generateSlug(input.name);

      const existing =
        await ctx.db.query.workspace.findFirst({
          where: eq(
            workspace.slug,
            slug
          ),
        });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Workspace slug already exists.",
        });
      }

      return WorkspaceService.create({
        userId: ctx.session.user.id,
        name: input.name,
      });
    }),
});