import { v } from "convex/values";

export const threadStatus = v.union(
  v.literal("active"),
  v.literal("pinned"),
  v.literal("archived")
);
