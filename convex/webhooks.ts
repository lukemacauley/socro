import {
  internalMutation,
  internalAction,
  internalQuery,
  action,
} from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { createClerkClient } from "@clerk/backend";
import { Id } from "./_generated/dataModel";

export const processEmailNotification = internalMutation({
  args: {
    notification: v.any(),
  },
  handler: async (ctx, args) => {
    const { notification } = args;
    console.log("[WEBHOOK] Received email notification:", {
      subscriptionId: notification.subscriptionId,
      changeType: notification.changeType,
      resource: notification.resource,
      clientState: notification.clientState,
    });

    // Extract email ID from the resource path
    // Resource format: "Users/{user-id}/Messages/{message-id}"
    const resource = notification.resource;
    const emailId = resource.split("/").pop();

    if (!emailId) {
      console.error(
        "[WEBHOOK] Could not extract email ID from resource:",
        resource
      );
      return;
    }

    console.log("[WEBHOOK] Extracted email ID:", emailId);
    console.log("[WEBHOOK] Scheduling email fetch and processing...");

    // Schedule action to fetch full email details
    await ctx.scheduler.runAfter(0, internal.webhooks.fetchAndProcessEmail, {
      emailId,
      subscriptionId: notification.subscriptionId,
    });

    console.log("[WEBHOOK] Email processing scheduled successfully");
  },
});

export const fetchAndProcessEmail = internalAction({
  args: {
    emailId: v.string(),
    subscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("[WEBHOOK] Starting to process email:", args.emailId);

    // Find user by subscription ID
    console.log(
      "[WEBHOOK] Looking up user by subscription ID:",
      args.subscriptionId
    );
    const userSettings = await ctx.runQuery(
      internal.webhooks.findUserBySubscription,
      {
        subscriptionId: args.subscriptionId,
      }
    );

    let accessToken = userSettings?.microsoftAccessToken;
    let userId: Id<"users"> | undefined = userSettings?.userId;

    if (!userSettings) {
      console.error(
        "[WEBHOOK] No user settings found for subscription:",
        args.subscriptionId
      );
      return;
    }

    if (!accessToken) {
      console.error(
        "[WEBHOOK] No Microsoft access token found for user:",
        userId
      );
      return;
    }

    console.log("[WEBHOOK] Found user settings, user ID:", userId);

    // Fetch the full email from Microsoft Graph API
    let email;
    try {
      console.log("[WEBHOOK] Fetching email from Microsoft Graph API...");
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${args.emailId}?$select=id,subject,from,body,receivedDateTime,isRead`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[WEBHOOK] Microsoft Graph API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });

        if (response.status === 401) {
          console.error(
            "[WEBHOOK] Microsoft access token expired for user:",
            userId
          );
          // TODO: Implement token refresh logic here
          return;
        }
        throw new Error(
          `Failed to fetch email: ${response.status} ${response.statusText}`
        );
      }

      email = await response.json();
      console.log("[WEBHOOK] Successfully fetched email:", {
        id: email.id,
        subject: email.subject,
        from: email.from?.emailAddress?.address,
        receivedDateTime: email.receivedDateTime,
      });
    } catch (error) {
      console.error(
        "[WEBHOOK] Error fetching email from Microsoft Graph:",
        error
      );
      return;
    }

    // Check if conversation already exists for this email
    console.log("[WEBHOOK] Checking if conversation already exists...");
    const existingConversation = await ctx.runQuery(
      internal.webhooks.findConversationByEmailId,
      {
        emailId: email.id,
      }
    );

    if (existingConversation) {
      console.log("[WEBHOOK] Conversation already exists for email:", email.id);
      return;
    }

    if (!userId) {
      console.error(
        "[WEBHOOK] No user ID available, cannot create conversation"
      );
      return;
    }

    // Create conversation
    console.log("[WEBHOOK] Creating new conversation...");
    const conversationId = await ctx.runMutation(
      internal.webhooks.createConversation,
      {
        userId,
        emailId: email.id,
        subject: email.subject || "(No subject)",
        fromEmail: email.from?.emailAddress?.address || "unknown@email.com",
        fromName: email.from?.emailAddress?.name,
      }
    );
    console.log("[WEBHOOK] Created conversation:", conversationId);

    // Extract plain text content from email body
    let emailContent = "";
    if (email.body?.contentType === "text") {
      emailContent = email.body.content;
      console.log("[WEBHOOK] Email body is plain text");
    } else if (email.body?.contentType === "html") {
      // Strip HTML tags for a basic plain text version
      emailContent = email.body.content.replace(/<[^>]*>/g, " ").trim();
      console.log("[WEBHOOK] Email body is HTML, stripped tags");
    }

    // Add email message
    console.log("[WEBHOOK] Adding email message to conversation...");
    await ctx.runMutation(internal.webhooks.addEmailMessage, {
      conversationId,
      content: emailContent,
      emailId: email.id,
      sender: email.from?.emailAddress?.address || "unknown@email.com",
    });
    console.log("[WEBHOOK] Email message added successfully");

    // Generate AI response if auto-response is enabled
    if (userSettings?.autoResponseEnabled) {
      console.log(
        "[WEBHOOK] Auto-response is enabled, generating AI response..."
      );
      try {
        await ctx.runAction(api.ai.generateResponse, {
          conversationId,
          emailContent: emailContent,
          emailSubject: email.subject || "(No subject)",
          senderName: email.from?.emailAddress?.name,
        });
        console.log("[WEBHOOK] AI response generated successfully");
      } catch (error) {
        console.error("[WEBHOOK] Error generating AI response:", error);
      }
    } else {
      console.log(
        "[WEBHOOK] Auto-response is disabled, skipping AI generation"
      );
    }

    console.log("[WEBHOOK] Successfully processed email:", email.id);
  },
});

export const findUserBySubscription = internalQuery({
  args: { subscriptionId: v.string() },
  handler: async (ctx, args) => {
    const userSettings = await ctx.db
      .query("userSettings")
      .filter((q) =>
        q.eq(q.field("webhookSubscriptionId"), args.subscriptionId)
      )
      .first();

    return userSettings;
  },
});

export const findConversationByEmailId = internalQuery({
  args: { emailId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conversations")
      .withIndex("by_email_id", (q) => q.eq("emailId", args.emailId))
      .first();
  },
});

export const createConversation = internalMutation({
  args: {
    userId: v.id("users"),
    emailId: v.string(),
    subject: v.string(),
    fromEmail: v.string(),
    fromName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("conversations", {
      userId: args.userId,
      emailId: args.emailId,
      subject: args.subject,
      fromEmail: args.fromEmail,
      fromName: args.fromName,
      status: "new",
      lastActivity: Date.now(),
    });
  },
});

export const addEmailMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    emailId: v.string(),
    sender: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      content: args.content,
      type: "email",
      sender: args.sender,
      timestamp: Date.now(),
      emailId: args.emailId,
    });
  },
});

export const updateUserMicrosoftAuth = internalMutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        microsoftAccessToken: args.accessToken,
        ...(args.refreshToken && { microsoftRefreshToken: args.refreshToken }),
        ...(args.subscriptionId && {
          webhookSubscriptionId: args.subscriptionId,
        }),
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId: args.userId,
        microsoftAccessToken: args.accessToken,
        microsoftRefreshToken: args.refreshToken,
        webhookSubscriptionId: args.subscriptionId,
        autoResponseEnabled: false,
      });
    }
  },
});

// Public action to store Microsoft auth data from the frontend
export const storeMicrosoftAuth = action({
  args: {
    clerkUserId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.current);

    if (!user) {
      throw new Error("User not found");
    }

    // Update the user's Microsoft auth settings
    await ctx.runMutation(internal.webhooks.updateUserMicrosoftAuth, {
      userId: user._id,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      subscriptionId: args.subscriptionId,
    });
  },
});

// Internal action to set up Microsoft webhook automatically
export const setupMicrosoftWebhook = internalAction({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(
      "[WEBHOOK SETUP] Starting Microsoft webhook setup for user:",
      args.clerkUserId
    );

    try {
      // Get user from Convex
      const user = await ctx.runQuery(api.users.getByClerkId, {
        clerkId: args.clerkUserId,
      });

      if (!user) {
        console.error(
          "[WEBHOOK SETUP] User not found in Convex:",
          args.clerkUserId
        );
        return;
      }

      // Get Microsoft access token from Clerk
      const clerk = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY!,
      });

      console.log(
        "[WEBHOOK SETUP] Getting Microsoft OAuth token from Clerk..."
      );
      const microsoftAuth = await clerk.users.getUserOauthAccessToken(
        args.clerkUserId,
        "microsoft"
      );

      const accessToken = microsoftAuth.data?.[0]?.token;

      if (!accessToken) {
        console.error("[WEBHOOK SETUP] No Microsoft access token found");
        return;
      }

      console.log(
        "[WEBHOOK SETUP] Got Microsoft access token, checking existing subscriptions..."
      );

      // Create webhook URL first
      const webhookUrl = `${process.env.CONVEX_SITE_URL}/webhook/microsoft`;

      // Check if we already have an active subscription with the correct URL
      const existingSubscription = await checkExistingSubscription(
        accessToken,
        webhookUrl
      );

      if (existingSubscription) {
        console.log(
          "[WEBHOOK SETUP] Active subscription already exists with correct URL, updating access token only"
        );
        // Just update the access token
        await ctx.runMutation(internal.webhooks.updateUserMicrosoftAuth, {
          userId: user._id,
          accessToken: accessToken,
        });
        return;
      }
      console.log(
        "[WEBHOOK SETUP] Creating new subscription with URL:",
        webhookUrl
      );

      const subscriptionResponse = await fetch(
        "https://graph.microsoft.com/v1.0/subscriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            changeType: "created",
            notificationUrl: webhookUrl,
            resource: "me/messages",
            expirationDateTime: new Date(
              Date.now() + 4230 * 60 * 1000 // ~70 hours
            ).toISOString(),
          }),
        }
      );

      if (!subscriptionResponse.ok) {
        const error = await subscriptionResponse.json();
        console.error("[WEBHOOK SETUP] Failed to create subscription:", error);
        return;
      }

      const subscription = await subscriptionResponse.json();
      console.log(
        "[WEBHOOK SETUP] Subscription created successfully:",
        subscription.id
      );

      // Store auth and subscription ID in Convex
      await ctx.runMutation(internal.webhooks.updateUserMicrosoftAuth, {
        userId: user._id,
        accessToken: accessToken,
        subscriptionId: subscription.id,
      });

      console.log(
        "[WEBHOOK SETUP] Microsoft webhook setup complete for user:",
        args.clerkUserId
      );
    } catch (error) {
      console.error(
        "[WEBHOOK SETUP] Error setting up Microsoft webhook:",
        error
      );
    }
  },
});

async function checkExistingSubscription(
  accessToken: string,
  expectedWebhookUrl: string
): Promise<boolean> {
  try {
    const response = await fetch(
      "https://graph.microsoft.com/v1.0/subscriptions",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      // Check if we have an active subscription for messages with the correct URL
      const activeSubscription = data.value.find(
        (sub: any) =>
          sub.resource === "me/messages" &&
          new Date(sub.expirationDateTime) > new Date() &&
          sub.notificationUrl === expectedWebhookUrl
      );

      if (activeSubscription) {
        console.log(
          "[WEBHOOK SETUP] Found active subscription with correct URL:",
          activeSubscription.id
        );
        return true;
      }

      // Log if we found subscriptions with wrong URLs
      const wrongUrlSubscriptions = data.value.filter(
        (sub: any) =>
          sub.resource === "me/messages" &&
          new Date(sub.expirationDateTime) > new Date() &&
          sub.notificationUrl !== expectedWebhookUrl
      );

      if (wrongUrlSubscriptions.length > 0) {
        console.log(
          "[WEBHOOK SETUP] Found subscriptions with incorrect URLs, will create new one:"
        );
        wrongUrlSubscriptions.forEach((sub: any) => {
          console.log(`  - ${sub.id}: ${sub.notificationUrl}`);
        });
      }
    }
  } catch (error) {
    console.error("[WEBHOOK SETUP] Error checking subscriptions:", error);
  }
  return false;
}
