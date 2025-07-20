import { internalMutation, internalQuery } from "./_generated/server";
import { type UserJSON } from "@clerk/backend";
import { v, type Validator } from "convex/values";
import { internal } from "./_generated/api";

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
      createdAt: Date.now(),
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

export const getBySubscriptionId = internalQuery({
  args: { subscriptionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_microsoft_subscription_id", (q) =>
        q.eq("microsoftSubscriptionId", args.subscriptionId)
      )
      .unique();
  },
});

export const getAllWithSubscriptions = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.neq(q.field("microsoftSubscriptionId"), undefined))
      .collect();
  },
});
