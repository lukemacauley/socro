import { internalMutation, internalQuery, query } from "./_generated/server";
import { v, type Validator } from "convex/values";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";
import type {
  UserCreatedEvent,
  UserUpdatedEvent,
  OrganizationMembershipCreated,
  OrganizationMembershipUpdated,
} from "@workos-inc/node";

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

export const upsertFromWorkOS = internalMutation({
  args: { data: v.any() as Validator<UserWebhookEvent> }, // no runtime validation, trust WorkOS
  async handler(ctx, { data }) {
    const userAttributes = {
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      imageUrl: data.profilePictureUrl ? data.profilePictureUrl : undefined,
      workOSId: data.id,
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

    const organisation = await ctx.runQuery(
      internal.organisations.getByWorkOSId,
      {
        workOSId: data.organizationId,
      }
    );

    if (organisation === null) {
      console.warn(
        `Can't update organisation membership, organisation not found for WorkOS organisation ID: ${data.organizationId}`
      );
      return;
    }

    await ctx.db.patch(user._id, {
      organisationId: organisation._id,
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
      organisationId: undefined,
    });
  },
});

export const getLeaderboard = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    // const identity = await ctx.auth.getUserIdentity();
    // if (identity === null) {
    //   throw new Error("Not authenticated");
    // }

    const userStatsPage = await ctx.db
      .query("userStats")
      .withIndex("by_total_points", (q) => q.gt("totalPoints", 0))
      .order("desc")
      .paginate(args.paginationOpts);

    const leaderboard = await Promise.all(
      userStatsPage.page.map(async (stats) => {
        const user = await ctx.db.get(stats.userId);
        if (!user) {
          throw new Error(`User not found for ID: ${stats.userId}`);
        }
        return {
          ...stats,
          ...user,
          _id: user._id,
        };
      })
    );

    return {
      page: leaderboard,
      isDone: userStatsPage.isDone,
      continueCursor: userStatsPage.continueCursor,
    };
  },
});
