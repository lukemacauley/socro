import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserId } from "./lib/utils";

export const get = query({
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    // Return default settings if none exist
    return settings || {
      userId,
      autoResponseEnabled: false,
      webhookSubscriptionId: null,
      responseTemplate: null,
    };
  },
});

export const update = mutation({
  args: {
    autoResponseEnabled: v.optional(v.boolean()),
    responseTemplate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    
    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, args);
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        autoResponseEnabled: args.autoResponseEnabled ?? false,
        responseTemplate: args.responseTemplate,
        webhookSubscriptionId: undefined,
      });
    }
  },
});

export const enableAutoResponse = mutation({
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    
    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        autoResponseEnabled: true,
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        autoResponseEnabled: true,
        webhookSubscriptionId: undefined,
        responseTemplate: undefined,
      });
    }
  },
});