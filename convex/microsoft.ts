import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { api } from "./_generated/api";

// Constants
const WEBHOOK_EXPIRATION_HOURS = 70;
const WEBHOOK_EXPIRATION_MS = WEBHOOK_EXPIRATION_HOURS * 60 * 60 * 1000;

// Helper function to create subscription request body
function createSubscriptionRequest(
  webhookUrl: string,
  resource: string,
  clientState: string
) {
  return {
    changeType: "created",
    notificationUrl: webhookUrl,
    resource,
    expirationDateTime: new Date(
      Date.now() + WEBHOOK_EXPIRATION_MS
    ).toISOString(),
    clientState,
  };
}

// Helper function to create a single subscription
async function createSubscription(
  accessToken: string,
  subscriptionRequest: any
) {
  try {
    const response = await fetch(
      "https://graph.microsoft.com/v1.0/subscriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscriptionRequest),
      }
    );

    if (response.ok) {
      const subscription = await response.json();
      console.log(
        `[WEBHOOK] Created ${subscriptionRequest.clientState} subscription:`,
        subscription.id
      );
      return subscription;
    } else {
      const error = await response.json();
      console.error(
        `[WEBHOOK] Failed to create ${subscriptionRequest.clientState} subscription:`,
        error
      );
      return null;
    }
  } catch (error) {
    console.error(
      `[WEBHOOK] Error creating ${subscriptionRequest.clientState} subscription:`,
      error
    );
    return null;
  }
}

// Helper function to create both inbox and sent subscriptions
async function createMicrosoftSubscriptions(accessToken: string) {
  console.log("[WEBHOOK] Creating Microsoft Graph subscriptions...");
  const webhookUrl = `${process.env.CONVEX_SITE_URL}/webhook/microsoft`;

  const inboxRequest = createSubscriptionRequest(
    webhookUrl,
    "me/mailFolders/Inbox/messages",
    "inbox"
  );

  const sentRequest = createSubscriptionRequest(
    webhookUrl,
    "me/mailFolders/SentItems/messages",
    "sent"
  );

  // Create subscriptions in parallel for better performance
  const [inboxSubscription, sentSubscription] = await Promise.all([
    createSubscription(accessToken, inboxRequest),
    createSubscription(accessToken, sentRequest),
  ]);

  return {
    inbox: inboxSubscription,
    sent: sentSubscription,
  };
}

// Check if existing subscription is valid and matches our webhook URL
export const checkExistingSubscription = internalAction({
  args: {
    accessToken: v.string(),
    expectedWebhookUrl: v.string(),
  },
  handler: async (ctx, args): Promise<string | null> => {
    try {
      const response = await fetch(
        "https://graph.microsoft.com/v1.0/subscriptions",
        {
          headers: {
            Authorization: `Bearer ${args.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        console.error("[WEBHOOK] Failed to fetch existing subscriptions");
        return null;
      }

      const data = await response.json();
      const subscriptions = data.value || [];

      // Find a valid subscription that matches our webhook URL
      const validSubscription = subscriptions.find(
        (sub: any) =>
          sub.notificationUrl === args.expectedWebhookUrl &&
          new Date(sub.expirationDateTime) > new Date() &&
          (sub.resource.includes("Inbox") || sub.resource.includes("SentItems"))
      );

      return validSubscription?.id || null;
    } catch (error) {
      console.error("[WEBHOOK] Error checking existing subscriptions:", error);
      return null;
    }
  },
});

// Get Microsoft access token
export const getMicrosoftAccessToken = internalAction({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args): Promise<string> => {
    // This would integrate with your auth system to get the access token
    // Implementation depends on how you store Microsoft OAuth tokens
    throw new Error(
      "getMicrosoftAccessToken not implemented - integrate with your auth system"
    );
  },
});

// Update user with Microsoft auth info
export const updateUserMicrosoftAuth = internalMutation({
  args: {
    userId: v.id("users"),
    subscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Update user record with subscription info
    // Implementation depends on your user schema
    console.log(
      `[WEBHOOK] Updated user ${args.userId} with subscription ${args.subscriptionId}`
    );
  },
});

// Cleanup expired subscriptions
export const cleanupExpiredSubscriptions = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log(
      "[WEBHOOK] Starting cleanup of expired Microsoft subscriptions"
    );

    // This would query your database for users with Microsoft subscriptions
    // and check if they're expired, then clean them up
    // Implementation depends on your user schema and how you track subscriptions

    console.log("[WEBHOOK] Subscription cleanup completed");
  },
});

// Renew subscriptions before they expire
export const renewMicrosoftSubscriptions = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    console.log(
      `[WEBHOOK] Renewing Microsoft subscriptions for user: ${args.userId}`
    );

    // This would renew subscriptions that are close to expiring
    // Implementation depends on your user schema and subscription tracking

    console.log(
      `[WEBHOOK] Subscription renewal completed for user: ${args.userId}`
    );
  },
});
