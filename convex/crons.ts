import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Renew Microsoft webhook subscriptions every 48 hours
// This ensures subscriptions don't expire (they last ~70 hours)
crons.interval(
  "renew microsoft webhook subscriptions",
  { hours: 48 },
  internal.webhooks.renewAllWebhookSubscriptions
);

// Refresh OAuth tokens every 45 minutes
// Microsoft access tokens expire after 1 hour, so this keeps them fresh
// Clerk automatically uses refresh tokens when we call getUserOauthAccessToken
crons.interval(
  "refresh microsoft oauth tokens",
  { minutes: 45 },
  internal.webhooks.refreshAllUserTokens
);

export default crons;