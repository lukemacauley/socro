import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const submitDemoRequest = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(args.email)) {
      throw new Error("Invalid email address");
    }

    // Check if email already exists
    const existingRequest = await ctx.db
      .query("demoRequests")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingRequest) {
      return {
        success: true,
        message: "Demo request already submitted",
        exists: true,
      };
    }

    // Insert new demo request
    await ctx.db.insert("demoRequests", {
      email: args.email,
      status: "pending",
    });

    return {
      success: true,
      message: "Demo request submitted successfully",
      exists: false,
    };
  },
});

export const updateDemoRequest = mutation({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    company: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { email, ...updateData } = args;

    // Find the demo request by email
    const demoRequest = await ctx.db
      .query("demoRequests")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!demoRequest) {
      throw new Error("Demo request not found");
    }

    // Update the demo request with additional information
    await ctx.db.patch(demoRequest._id, updateData);

    return { success: true };
  },
});
