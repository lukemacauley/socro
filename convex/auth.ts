import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";

export const loggedInUserId = internalQuery({
  handler: async (ctx): Promise<Id<"users"> | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.runQuery(internal.users.getByWorkOSId, {
      workOSId: identity.subject,
    });

    return user ? user._id : null;
  },
});
