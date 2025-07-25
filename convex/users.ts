import { internalMutation, internalQuery, query } from "./_generated/server";
import { type UserJSON } from "@clerk/backend";
import { v, type Validator } from "convex/values";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";

export const getByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> }, // no runtime validation, trust Clerk
  async handler(ctx, { data }) {
    const userAttributes = {
      name: `${data.first_name} ${data.last_name}`.trim(),
      email: data.email_addresses[0].email_address,
      imageUrl: data.image_url,
      clerkId: data.id,
    };

    const user = await ctx.runQuery(internal.users.getByClerkId, {
      clerkId: data.id,
    });

    if (user === null) {
      await ctx.db.insert("users", userAttributes);
    } else {
      await ctx.db.patch(user._id, userAttributes);
    }
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const user = await ctx.runQuery(internal.users.getByClerkId, {
      clerkId: clerkUserId,
    });

    if (user !== null) {
      await ctx.db.delete(user._id);
    } else {
      console.warn(
        `Can't delete user, there is none for Clerk user ID: ${clerkUserId}`
      );
    }
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
