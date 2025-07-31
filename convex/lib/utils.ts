import {
  customQuery,
  customCtx,
  customAction,
  customMutation,
} from "convex-helpers/server/customFunctions";
import { ConvexError } from "convex/values";
import { query, action, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";

type AuthedCtx = Promise<{
  user: Doc<"users">;
  userId: Id<"users">;
  organisationId: Id<"organisations"> | undefined;
}>;

export const authedQuery = customQuery(
  query,
  customCtx(async (ctx): AuthedCtx => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workOSId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    return {
      user,
      userId: user._id,
      organisationId: user.organisationId,
    };
  })
);

export const authedMutation = customMutation(
  mutation,
  customCtx(async (ctx): AuthedCtx => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workOSId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    return { user, userId: user._id, organisationId: user.organisationId };
  })
);

export const authedAction = customAction(
  action,
  customCtx(async (ctx): AuthedCtx => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("Not authenticated");
    }

    const user = await ctx.runQuery(internal.users.getByWorkOSId, {
      workOSId: identity.subject,
    });

    if (!user) {
      throw new ConvexError("User not found");
    }

    return {
      user,
      userId: user._id,
      organisationId: user.organisationId,
    };
  })
);
