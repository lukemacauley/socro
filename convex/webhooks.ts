import { internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { createClerkClient } from "@clerk/backend";
import type { Subscription } from "@microsoft/microsoft-graph-types";
import {
  fetchEmailFromMicrosoft,
  isProcessedFileAttachment,
} from "./lib/email";

// ==================== Constants ====================
export const MICROSOFT_GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
export const WEBHOOK_SUBSCRIPTION_DURATION_MINUTES = 4230; // ~70 hours

export const fetchAndProcessEmail = internalAction({
  args: {
    emailId: v.string(),
    subscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("[WEBHOOK] Starting to process email:", args.emailId);

    const user = await ctx.runQuery(internal.users.getBySubscriptionId, {
      subscriptionId: args.subscriptionId,
    });

    if (!user) {
      console.error(
        "[WEBHOOK] No user found for subscription:",
        args.subscriptionId
      );
      return;
    }

    // Get Microsoft access token
    const accessToken = await getMicrosoftAccessToken(user.externalId);

    // Fetch the full email from Microsoft Graph API
    const email = await fetchEmailFromMicrosoft(accessToken, args.emailId);

    if (!email) {
      return;
    }

    const attachments = email.attachments
      ?.filter(isProcessedFileAttachment)
      ?.map((a) => ({
        id: a.id,
        name: a.name,
        contentBytes: a.contentBytes,
        contentType: a.contentType,
        size: a.size,
      }));

    const { responseMessageId, emailMessageId, threadId } =
      await ctx.runMutation(internal.threads.processIncomingEmail, {
        subject: email.subject || "New Email",
        fromParticipants: {
          email: email.from?.emailAddress?.address,
          name: email.from?.emailAddress?.name,
        },
        toParticipants:
          email.toRecipients?.map((r) => ({
            email: r.emailAddress?.address,
            name: r.emailAddress?.name,
          })) || [],
        externalThreadId: email.conversationId ?? "",
        lastActivityAt: email.receivedDateTime
          ? new Date(email.receivedDateTime).getTime()
          : Date.now(),
        externalSubscriptionId: args.subscriptionId,
        content: email.body?.content,
        contentPreview: email.bodyPreview,
        hasAttachments: email.hasAttachments,
        attachments,
        accessToken,
      });

    if (emailMessageId && email.hasAttachments && email.conversationId) {
      await ctx.runAction(internal.attachments.processEmailAttachments, {
        emailId: email.conversationId,
        messageId: emailMessageId,
        userId: user._id,
        attachments,
        accessToken,
      });
    }

    await ctx.runAction(internal.messages.generateStreamingResponse, {
      threadId,
      responseMessageId,
    });
  },
});

// ==================== User Management ====================

export const updateUserMicrosoftAuth = internalMutation({
  args: {
    userId: v.id("users"),
    subscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      externalSubscriptionId: args.subscriptionId,
    });
  },
});

// ==================== Webhook Setup ====================

export const setupMicrosoftWebhook = internalAction({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    try {
      const user = await ctx.runQuery(internal.users.getByClerkId, {
        clerkId: args.clerkUserId,
      });

      if (!user) {
        throw new Error("User not found");
      }
      console.log({ user });

      const accessToken = await getMicrosoftAccessToken(args.clerkUserId);

      console.log({ accessToken });

      const webhookUrl = `${process.env.CONVEX_SITE_URL}/webhook/microsoft`;
      console.log("[WEBHOOK SETUP] Expected webhook URL:", webhookUrl);

      // Check for existing subscription
      const existingSubscriptionId = await checkExistingSubscription(
        webhookUrl,
        accessToken
      );

      if (existingSubscriptionId) {
        console.log(
          "[WEBHOOK SETUP] Found existing subscription:",
          existingSubscriptionId
        );
        await ctx.runMutation(internal.webhooks.updateUserMicrosoftAuth, {
          userId: user._id,
          subscriptionId: existingSubscriptionId,
        });
        return;
      }

      // Create new subscriptions
      const subscription = await createMicrosoftSubscription(
        webhookUrl,
        accessToken
      );

      if (!subscription?.id) {
        throw new Error("Failed to create any subscriptions");
      }

      await ctx.runMutation(internal.webhooks.updateUserMicrosoftAuth, {
        userId: user._id,
        subscriptionId: subscription.id,
      });

      console.log(
        "[WEBHOOK SETUP] Microsoft webhook setup complete for user:",
        user._id,
        subscription.id
      );
    } catch (error) {
      console.error(
        "[WEBHOOK SETUP] Error setting up Microsoft webhook:",
        error
      );
      throw error;
    }
  },
});

export const checkExistingSubscription = async (
  expectedWebhookUrl: string,
  accessToken: string
): Promise<string | null> => {
  try {
    const response = await fetch(`${MICROSOFT_GRAPH_BASE_URL}/subscriptions`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    console.log({ data });
    const activeSubscriptions = data.value.filter(
      (sub: Subscription) =>
        sub.resource === "me/messages" &&
        new Date(sub.expirationDateTime || "") > new Date() &&
        sub.notificationUrl === expectedWebhookUrl
    );

    if (activeSubscriptions.length === 0) {
      console.log("[WEBHOOK SETUP] No active subscriptions found");
      return null;
    }

    console.log({ activeSubscriptions });

    return activeSubscriptions[0].id;
  } catch (error) {
    console.error("[WEBHOOK SETUP] Error checking subscriptions:", error);
    return null;
  }
};

// ==================== Authentication ====================

export const getMicrosoftAccessToken = async (
  clerkUserId: string
): Promise<string> => {
  const clerk = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
  });

  try {
    const microsoftAuth = await clerk.users.getUserOauthAccessToken(
      clerkUserId,
      "microsoft"
    );

    const accessToken = microsoftAuth.data?.[0]?.token;

    if (!accessToken) {
      throw new Error("No access token received from Clerk");
    }

    // Log token details for debugging
    console.log("[AUTH] Token received from Clerk:", {
      tokenLength: accessToken.length,
      tokenPrefix: accessToken.substring(0, 20) + "...",
      hasBearer: accessToken.startsWith("Bearer "),
      microsoftAuthData: microsoftAuth.data?.[0],
    });

    return accessToken;
  } catch (error) {
    console.error("[AUTH] Error getting access token from Clerk:", error);
    throw new Error(`Failed to get Microsoft access token: ${error}`);
  }
};

export const createMicrosoftSubscription = async (
  webhookUrl: string,
  accessToken: string
): Promise<Subscription | null> => {
  const expirationDateTime = new Date(
    Date.now() + WEBHOOK_SUBSCRIPTION_DURATION_MINUTES * 60 * 1000
  ).toISOString();

  try {
    console.log(`[WEBHOOK SETUP] Webhook URL: ${webhookUrl}`);
    console.log(`[WEBHOOK SETUP] Access token details:`, {
      tokenLength: accessToken.length,
      tokenPrefix: accessToken.substring(0, 20) + "...",
      hasBearer: accessToken.startsWith("Bearer "),
    });

    const response = await fetch(`${MICROSOFT_GRAPH_BASE_URL}/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        changeType: "created",
        notificationUrl: webhookUrl,
        resource: "me/messages",
        expirationDateTime,
      }),
    });

    console.log({ response });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[WEBHOOK SETUP] Failed to create subscription: ${response.status} ${response.statusText}`,
        errorText
      );
      throw new Error(`Failed to create subscription: ${errorText}`);
    }

    const subscription = await response.json();
    return subscription;
  } catch (error) {
    console.error(
      `[WEBHOOK SETUP] Failed to create inbox subscription:`,
      error
    );
    throw new Error(`Failed to create inbox subscription: ${error}`);
  }
};

// ==================== Subscription Refresh ====================

export const refreshAllMicrosoftSubscriptions = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("[CRON] Starting Microsoft subscription refresh...");

    // Get all users with Microsoft subscriptions
    const users = await ctx.runQuery(internal.users.getAllWithSubscriptions);

    if (!users || users.length === 0) {
      console.log("[CRON] No users with Microsoft subscriptions found");
      return;
    }

    const webhookUrl = `${process.env.CONVEX_SITE_URL}/webhook/microsoft`;
    let refreshedCount = 0;
    let createdCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        console.log(`[CRON] Processing subscription for user: ${user._id}`);

        // Get fresh access token from Clerk - this is the key part!
        // Even if the subscription hasn't expired, we get a fresh token
        const accessToken = await getMicrosoftAccessToken(user.externalId);

        if (user.externalSubscriptionId) {
          // Try to renew the existing subscription
          const renewed = await renewSubscription(
            user.externalSubscriptionId,
            accessToken
          );

          if (renewed) {
            refreshedCount++;
            console.log(
              `[CRON] Successfully renewed subscription for user: ${user._id}`
            );
          } else {
            // If renewal fails (e.g., subscription not found), create a new one
            console.log(
              `[CRON] Subscription renewal failed for user: ${user._id}, creating new subscription`
            );

            const newSubscription = await createMicrosoftSubscription(
              webhookUrl,
              accessToken
            );

            if (newSubscription?.id) {
              await ctx.runMutation(internal.webhooks.updateUserMicrosoftAuth, {
                userId: user._id,
                subscriptionId: newSubscription.id,
              });
              createdCount++;
              console.log(
                `[CRON] Successfully created new subscription for user: ${user._id}`
              );
            } else {
              throw new Error("Failed to create new subscription");
            }
          }
        }
      } catch (error) {
        errorCount++;
        console.error(
          `[CRON] Error processing subscription for user ${user._id}:`,
          error
        );
      }
    }

    console.log(
      `[CRON] Subscription refresh complete. Renewed: ${refreshedCount}, Created: ${createdCount}, Errors: ${errorCount}`
    );
  },
});

async function renewSubscription(
  subscriptionId: string,
  accessToken: string
): Promise<boolean> {
  try {
    const expirationDateTime = new Date(
      Date.now() + WEBHOOK_SUBSCRIPTION_DURATION_MINUTES * 60 * 1000
    ).toISOString();

    const response = await fetch(
      `${MICROSOFT_GRAPH_BASE_URL}/subscriptions/${subscriptionId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expirationDateTime,
        }),
      }
    );

    if (response.ok) {
      console.log(
        `[CRON] Successfully renewed subscription: ${subscriptionId}`
      );
      return true;
    } else {
      const errorText = await response.text();
      console.error(
        `[CRON] Failed to renew subscription: ${response.status}`,
        errorText
      );
      return false;
    }
  } catch (error) {
    console.error("[CRON] Error renewing subscription:", error);
    return false;
  }
}
