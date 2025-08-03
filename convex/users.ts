import { internalMutation, internalQuery } from "./_generated/server";
import { ConvexError, v, type Validator } from "convex/values";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";
import type {
  UserCreatedEvent,
  UserUpdatedEvent,
  OrganizationMembershipCreated,
  OrganizationMembershipUpdated,
} from "@workos-inc/node";
import { authedQuery } from "./lib/utils";

function camelToSnakeCase(str: string) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

type UserWebhookEvent = (UserCreatedEvent | UserUpdatedEvent)["data"];
type UserMembershipWebhookEvent = (
  | OrganizationMembershipCreated
  | OrganizationMembershipUpdated
)["data"];

export const getByWorkOSId = internalQuery({
  args: { workOSId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workOSId", args.workOSId))
      .first();
  },
});

export const current = authedQuery({
  handler: async (ctx) => {
    if (!ctx.orgId) {
      throw new ConvexError("User is not part of an organisation");
    }

    const user = ctx.user;
    const org = await ctx.db.get(ctx.orgId);

    return {
      ...user,
      org,
    };
  },
});

export const upsertFromWorkOS = internalMutation({
  args: { data: v.any() as Validator<UserWebhookEvent> }, // no runtime validation, trust WorkOS
  async handler(ctx, { data }) {
    const userAttributes = {
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      imageUrl: data.profilePictureUrl ? data.profilePictureUrl : undefined,
      workOSId: data.id,
      lastActivityAt: Date.now(),
    };

    const user = await ctx.runQuery(internal.users.getByWorkOSId, {
      workOSId: data.id,
    });

    if (user === null) {
      await ctx.db.insert("users", userAttributes);
    } else {
      await ctx.db.patch(user._id, userAttributes);
    }
  },
});

export const deleteFromWorkOS = internalMutation({
  args: { workOSId: v.string() },
  async handler(ctx, args) {
    const user = await ctx.runQuery(internal.users.getByWorkOSId, {
      workOSId: args.workOSId,
    });

    if (user !== null) {
      await ctx.db.delete(user._id);
    } else {
      console.warn(
        `Can't delete user, there is none for WorkOS user ID: ${args.workOSId}`
      );
    }
  },
});

export const updateOrganisationMembership = internalMutation({
  args: { data: v.any() as Validator<UserMembershipWebhookEvent> }, // no runtime validation, trust WorkOS
  async handler(ctx, { data }) {
    const user = await ctx.runQuery(internal.users.getByWorkOSId, {
      workOSId: data.userId,
    });

    if (user === null) {
      console.warn(
        `Can't update organisation membership, user not found for WorkOS user ID: ${data.userId}`
      );
      return;
    }

    const org = await ctx.runQuery(internal.organisations.getByWorkOSId, {
      workOSId: data.organizationId,
    });

    if (org === null) {
      console.warn(
        `Can't update organisation membership, organisation not found for WorkOS organisation ID: ${data.organizationId}`
      );
      return;
    }

    await ctx.db.patch(user._id, {
      orgId: org._id,
    });
  },
});

export const removeOrganisationMembership = internalMutation({
  args: { workOSUserId: v.string() },
  async handler(ctx, args) {
    const user = await ctx.runQuery(internal.users.getByWorkOSId, {
      workOSId: args.workOSUserId,
    });

    if (user === null) {
      console.warn(
        `Can't remove organisation membership, user not found for WorkOS user ID: ${args.workOSUserId}`
      );
      return;
    }

    await ctx.db.patch(user._id, {
      orgId: undefined,
    });
  },
});

export const getLeaderboard = authedQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const sortBy = args.sortBy || "totalPoints";
    const sortOrder = args.sortOrder || "desc";

    // Convert camelCase to snake_case for index name
    const indexName = `by_${camelToSnakeCase(sortBy)}`;

    let userStatsPage;
    let sortError = false;
    try {
      userStatsPage = await ctx.db
        .query("userStats")
        .withIndex(indexName as any, (q) => q.eq("orgId", ctx.orgId))
        .order(sortOrder)
        .paginate(args.paginationOpts);
    } catch {
      userStatsPage = await ctx.db
        .query("userStats")
        .withIndex("by_total_points", (q) => q.eq("orgId", ctx.orgId))
        .order(sortOrder)
        .paginate(args.paginationOpts);
      sortError = true;
    }

    // console.log({
    //   userOrg: ctx.orgId,
    //   indexName,
    //   sortError,
    //   stats: userStatsPage.page,
    // });

    const leaderboard = await Promise.all(
      userStatsPage.page.map(async (stats) => {
        const user = await ctx.db.get(stats.userId);
        if (!user) {
          console.error(`User not found for ID: ${stats.userId}`);
          return;
        }
        return {
          ...stats,
          ...user,
          _id: user._id,
        };
      })
    );

    let sortedLeaderboard = leaderboard;

    if (sortError) {
      sortedLeaderboard = leaderboard.sort((a, b) => {
        const aValue = (a as any)[sortBy] || 0;
        const bValue = (b as any)[sortBy] || 0;
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
      });
    }

    return {
      page: sortedLeaderboard,
      isDone: userStatsPage.isDone,
      continueCursor: userStatsPage.continueCursor,
    };
  },
});
