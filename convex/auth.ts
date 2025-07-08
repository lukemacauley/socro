import { query, mutation } from "./_generated/server";
import { getCurrentUser, getCurrentUserId } from "./lib/utils";
import { internal } from "./_generated/api";

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

