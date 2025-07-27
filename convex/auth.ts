import type { Id } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";

export const loggedInUserId = internalQuery({
  handler: async (ctx): Promise<Id<"users"> | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_work_os_id", (q) => q.eq("workOSId", identity.subject))
      .first();

    if (!user) {
      return null;
    }

    return user ? user._id : null;
  },
});
