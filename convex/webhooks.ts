import {
  internalMutation,
  internalAction,
  internalQuery,
  action,
} from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { createClerkClient } from "@clerk/backend";
import { getUserSettingsByUserId, getMicrosoftAccessToken } from "./lib/utils";
import { attachmentValidator } from "./lib/validators";

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

    if (!userSettings) {
      console.error(
        "[WEBHOOK] No user settings found for subscription:",
        args.subscriptionId
      );
      return;
    }

    const userId = userSettings.userId;
    console.log("[WEBHOOK] Found user settings, user ID:", userId);

    // Get user to fetch their Clerk ID
    const user = await ctx.runQuery(internal.users.getById, { userId });
    if (!user) {
      console.error("[WEBHOOK] User not found:", userId);
      return;
    }

    const accessToken = await getMicrosoftAccessToken(user.externalId);

    // Fetch the full email from Microsoft Graph API including attachments
    let email;
    try {
      console.log("[WEBHOOK] Fetching email from Microsoft Graph API...");
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${args.emailId}?$select=id,subject,from,body,receivedDateTime,isRead,hasAttachments&$expand=attachments($select=id,name,contentType,size)`,
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
        hasAttachments: email.hasAttachments,
        attachmentCount: email.attachments?.length || 0,
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

    // Add email message with attachments
    console.log("[WEBHOOK] Adding email message to conversation...");

    // Process attachments if any
    let attachments = undefined;
    if (email.hasAttachments && email.attachments) {
      console.log(
        `[WEBHOOK] Processing ${email.attachments.length} attachments`
      );
      attachments = email.attachments.map((att: any) => ({
        id: att.id,
        name: att.name,
        contentType: att.contentType,
        size: att.size,
      }));

      // Log attachment details
      attachments.forEach((att: any) => {
        console.log(
          `[WEBHOOK] Attachment: ${att.name} (${att.contentType}, ${(
            att.size / 1024
          ).toFixed(2)} KB)`
        );
      });
    }

    await ctx.runMutation(internal.webhooks.addEmailMessage, {
      conversationId,
      content: emailContent,
      emailId: email.id,
      sender: email.from?.emailAddress?.address || "unknown@email.com",
      attachments,
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

export const getUserSettings = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await getUserSettingsByUserId(ctx, args.userId);
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
    attachments: v.optional(v.array(attachmentValidator)),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      content: args.content,
      type: "email",
      sender: args.sender,
      timestamp: Date.now(),
      emailId: args.emailId,
      attachments: args.attachments,
    });
  },
});

export const updateUserMicrosoftAuth = internalMutation({
  args: {
    userId: v.id("users"),
    subscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingSettings = await getUserSettingsByUserId(ctx, args.userId);

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        ...(args.subscriptionId && {
          webhookSubscriptionId: args.subscriptionId,
        }),
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId: args.userId,
        webhookSubscriptionId: args.subscriptionId,
        autoResponseEnabled: false,
      });
    }
  },
});

// Public action to store Microsoft webhook subscription ID
export const storeMicrosoftAuth = action({
  args: {
    clerkUserId: v.string(),
    subscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.current);

    if (!user) {
      throw new Error("User not found");
    }

    // Update the user's Microsoft webhook subscription
    await ctx.runMutation(internal.webhooks.updateUserMicrosoftAuth, {
      userId: user._id,
      subscriptionId: args.subscriptionId,
    });
  },
});

// Public action to download attachment
export const downloadAttachment = action({
  args: {
    emailId: v.string(),
    attachmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.current);
    if (!user) {
      throw new Error("User not found");
    }

    const accessToken = await getMicrosoftAccessToken(user.externalId);

    try {
      // Download attachment from Microsoft Graph
      const response: Response = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${args.emailId}/attachments/${args.attachmentId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        console.error(
          "[DOWNLOAD] Failed to download attachment:",
          response.status
        );
        throw new Error("Failed to download attachment");
      }

      const attachment = await response.json();

      return {
        content: attachment.contentBytes, // Base64 encoded content
        contentType: attachment.contentType,
        size: attachment.size,
      };
    } catch (error) {
      console.error("[DOWNLOAD] Error downloading attachment:", error);
      throw new Error("Failed to download attachment");
    }
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
      const accessToken = await getMicrosoftAccessToken(user.externalId);

      console.log(
        "[WEBHOOK SETUP] Got Microsoft access token, checking existing subscriptions..."
      );

      // Create webhook URL first
      const webhookUrl = `${process.env.CONVEX_SITE_URL}/webhook/microsoft`;

      // Check if we already have an active subscription with the correct URL
      const existingSubscriptionId = await checkExistingSubscription(
        accessToken,
        webhookUrl
      );

      if (existingSubscriptionId) {
        console.log(
          "[WEBHOOK SETUP] Active subscription already exists, updating user settings"
        );

        // Update user settings with the existing subscription ID
        await ctx.runMutation(internal.webhooks.updateUserMicrosoftAuth, {
          userId: user._id,
          subscriptionId: existingSubscriptionId,
        });

        console.log(
          "[WEBHOOK SETUP] Updated user settings with existing subscription ID"
        );
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

      // Store subscription ID in Convex
      await ctx.runMutation(internal.webhooks.updateUserMicrosoftAuth, {
        userId: user._id,
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
): Promise<string | null> {
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
        return activeSubscription.id;
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
  return null;
}

