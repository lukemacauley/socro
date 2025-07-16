import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "refreshMicrosoftWebhooks",
  { minutes: 50 },
  internal.webhooks.refreshAllMicrosoftSubscriptions
);

export default crons;
