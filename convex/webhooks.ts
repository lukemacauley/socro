import { internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import Reducto, { toFile } from "reductoai";
import { createClerkClient } from "@clerk/backend";
import type {
  Attachment,
  FileAttachment,
  Message,
  Subscription,
} from "@microsoft/microsoft-graph-types";

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

    console.log({ attachments: email.attachments });

    const { responseMessageId, threadId } = await ctx.runMutation(
      internal.threads.processIncomingEmail,
      {
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
        externalThreadId: email.id,
        lastActivityAt: email.receivedDateTime
          ? new Date(email.receivedDateTime).getTime()
          : Date.now(),
        status: "new",
        externalSubscriptionId: args.subscriptionId,
        content: email.bodyPreview,
        hasAttachments: email.hasAttachments,
        attachments: email.attachments?.map((a) => ({
          id: a.id,
          name: a.name,
          contentBytes: a.contentBytes,
          contentType: a.contentType,
          size: a.size,
        })),
        accessToken,
      }
    );

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
    secretKey: process.env.CLERK_SECRET_KEY!,
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

async function fetchEmailFromMicrosoft(accessToken: string, emailId: string) {
  try {
    console.log("[WEBHOOK] Fetching email from Microsoft Graph API...");
    const response = await fetch(
      `${MICROSOFT_GRAPH_BASE_URL}/me/messages/${emailId}?$expand=attachments`,
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
      return null;
    }

    const email: Message = await response.json();

    console.log("[WEBHOOK] Successfully fetched email:", {
      id: email.id,
      subject: email.subject,
      from: email.from?.emailAddress?.address,
      attachmentCount: email.attachments?.length || 0,
    });

    // Process attachments and ensure all have content
    if (email.attachments && email.attachments.length > 0) {
      const processedAttachments: FileAttachment[] = [];

      for (const attachment of email.attachments) {
        if (
          (attachment as any)["@odata.type"] ===
          "#microsoft.graph.fileAttachment"
        ) {
          const fileAttachment = attachment as FileAttachment;

          if (!fileAttachment.contentBytes) {
            // Large file - need to fetch separately
            console.log(
              `[WEBHOOK] Fetching large attachment: ${fileAttachment.name}`
            );

            const attachmentResponse = await fetch(
              `${MICROSOFT_GRAPH_BASE_URL}/me/messages/${emailId}/attachments/${attachment.id}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );

            if (!attachmentResponse.ok) {
              console.error(
                `[WEBHOOK] Failed to fetch attachment ${attachment.id}`
              );
              continue;
            }

            const fullAttachment: FileAttachment =
              await attachmentResponse.json();
            fileAttachment.contentBytes = fullAttachment.contentBytes;
          }

          processedAttachments.push(fileAttachment);
        } else if (
          (attachment as any)["@odata.type"] ===
          "#microsoft.graph.itemAttachment"
        ) {
          // Handle item attachments (e.g., attached emails, calendar items)
          console.log(`[WEBHOOK] Item attachment found: ${attachment.name}`);
          processedAttachments.push(attachment);
        }
      }

      // Replace attachments with fully loaded versions
      email.attachments = processedAttachments;
      console.log(
        `[WEBHOOK] Processed ${processedAttachments.length} attachments`
      );
    }

    return {
      ...email,
      attachments: email?.attachments as FileAttachment[] | null | undefined,
    };
  } catch (error) {
    console.error(
      "[WEBHOOK] Error fetching email from Microsoft Graph:",
      error
    );
    return null;
  }
}

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
