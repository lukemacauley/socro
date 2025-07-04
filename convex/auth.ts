import { query } from "./_generated/server";
import { getCurrentUser, getCurrentUserId } from "./lib/utils";

export const loggedInUser = query({
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const loggedInUserId = query({
  handler: async (ctx) => {
    return await getCurrentUserId(ctx);
  },
});
