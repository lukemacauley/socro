import { internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import Reducto, { toFile } from "reductoai";
import { decode } from "he";
import { createClerkClient } from "@clerk/backend";
import type {
  Attachment,
  FileAttachment,
  Message,
  Subscription,
} from "@microsoft/microsoft-graph-types";
import { attachmentSchema } from "./schema";

// ==================== Constants ====================
const MICROSOFT_GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const WEBHOOK_SUBSCRIPTION_DURATION_MINUTES = 4230; // ~70 hours
const SUPPORTED_ATTACHMENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
];

// ==================== Email Processing ====================

export const processEmailNotification = internalMutation({
  args: {
    subscriptionId: v.string(),
    resource: v.string(),
    isSentEmail: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const emailId = args.resource.split("/").pop();

    if (!emailId) {
      console.error(
        "[WEBHOOK] Could not extract email ID from resource:",
        args.resource
      );
      return;
    }

    console.log("[WEBHOOK] Extracted email ID:", emailId);
    console.log("[WEBHOOK] Scheduling email fetch and processing...");

    // Schedule action to fetch full email details
    await ctx.scheduler.runAfter(0, internal.webhooks.fetchAndProcessEmail, {
      emailId,
      subscriptionId: args.subscriptionId,
      isSentEmail: args.isSentEmail || false,
    });

    console.log("[WEBHOOK] Email processing scheduled successfully");
  },
});

export const fetchAndProcessEmail = internalAction({
  args: {
    emailId: v.string(),
    subscriptionId: v.string(),
    isSentEmail: v.boolean(),
  },
  handler: async (ctx, args) => {
    console.log("[WEBHOOK] Starting to process email:", args.emailId);
    console.log("[WEBHOOK] Is sent email:", args.isSentEmail);

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
    const accessToken = await ctx.scheduler.runAfter(
      0,
      internal.webhooks.getMicrosoftAccessToken,
      { clerkUserId: user.externalId }
    );

    // Fetch the full email from Microsoft Graph API
    const email = await fetchEmailFromMicrosoft(accessToken, args.emailId);

    if (!email) {
      return;
    }

    await ctx.runMutation(internal.threads.processIncomingEmail, {
      email,
      externalSubscriptionId: args.subscriptionId,
      isSentEmail: args.isSentEmail,
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

export const storeProcessedAttachment = internalMutation({
  args: {
    messageId: v.id("messages"),
    attachmentId: v.string(),
    attachmentName: v.string(),
    content: v.string(),
    metadata: v.optional(
      v.object({
        pageCount: v.optional(v.number()),
        processingTime: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Store processed attachment content
    await ctx.db.insert("messageAttachments", {
      messageId: args.messageId,
      attachmentId: args.attachmentId,
      attachmentName: args.attachmentName,
      content: args.content,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

// ==================== Webhook Setup ====================

export const setupMicrosoftWebhook = internalAction({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    try {
      const user = await ctx.runQuery(api.users.getByClerkId, {
        clerkId: args.clerkUserId,
      });

      if (!user) {
        throw new Error("User not found");
      }

      const accessToken = await ctx.scheduler.runAfter(
        0,
        internal.webhooks.getMicrosoftAccessToken,
        { clerkUserId: args.clerkUserId }
      );

      const webhookUrl = `${process.env.CONVEX_SITE_URL}/webhook/microsoft`;

      // Check for existing subscription
      const existingSubscriptionId = await ctx.scheduler.runAfter(
        0,
        internal.webhooks.checkExistingSubscription,
        {
          accessToken,
          expectedWebhookUrl: webhookUrl,
        }
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
      const subscriptions = await createMicrosoftSubscriptions(
        accessToken,
        webhookUrl
      );

      if (!subscriptions.inbox && !subscriptions.sent) {
        throw new Error("Failed to create any subscriptions");
      }

      // Store primary subscription ID
      const primarySubscriptionId =
        subscriptions.inbox?.id || subscriptions.sent?.id;

      await ctx.runMutation(internal.webhooks.updateUserMicrosoftAuth, {
        userId: user._id,
        subscriptionId: primarySubscriptionId,
      });

      console.log(
        "[WEBHOOK SETUP] Microsoft webhook setup complete for user:",
        user._id
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

export const checkExistingSubscription = internalAction({
  args: {
    accessToken: v.string(),
    expectedWebhookUrl: v.string(),
  },
  handler: async (ctx, args): Promise<string | null> => {
    try {
      const response = await fetch(
        `${MICROSOFT_GRAPH_BASE_URL}/subscriptions`,
        {
          headers: {
            Authorization: `Bearer ${args.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const activeSubscriptions = data.value.filter(
        (sub: Subscription) =>
          (sub.resource === "me/mailFolders/Inbox/messages" ||
            sub.resource === "me/mailFolders/SentItems/messages") &&
          new Date(sub.expirationDateTime || "") > new Date() &&
          sub.notificationUrl === args.expectedWebhookUrl
      );

      if (activeSubscriptions.length > 0) {
        const inboxSub = activeSubscriptions.find((s: Subscription) =>
          s.resource?.includes("Inbox")
        );
        return inboxSub?.id || activeSubscriptions[0].id;
      }

      return null;
    } catch (error) {
      console.error("[WEBHOOK SETUP] Error checking subscriptions:", error);
      return null;
    }
  },
});

// ==================== Authentication ====================

export const getMicrosoftAccessToken = internalAction({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    try {
      const microsoftAuth = await clerk.users.getUserOauthAccessToken(
        args.clerkUserId,
        "microsoft"
      );

      const accessToken = microsoftAuth.data?.[0]?.token;

      if (!accessToken) {
        throw new Error("No access token received from Clerk");
      }

      return accessToken;
    } catch (error) {
      console.error("[AUTH] Error getting access token from Clerk:", error);
      throw new Error(`Failed to get Microsoft access token: ${error}`);
    }
  },
});

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

    const email = await response.json();

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
      attachments: email?.attachments, //as FileAttachment[] | null | undefined,
    };
  } catch (error) {
    console.error(
      "[WEBHOOK] Error fetching email from Microsoft Graph:",
      error
    );
    return null;
  }
}

function extractEmailContent(email: Message): string {
  let emailContent = "";

  // First, try Microsoft's uniqueBody if available
  if (email.uniqueBody?.content) {
    const uniqueBodyType =
      email.uniqueBody.contentType?.toLowerCase() || "text";
    const uniqueContent = email.uniqueBody.content;

    if (uniqueBodyType === "html") {
      emailContent = decode(uniqueContent);
    } else {
      emailContent = decode(uniqueContent).replace(/\n/g, "<br>");
    }
  } else if (email.body?.content) {
    // Fall back to full body
    const bodyContentType = email.body.contentType?.toLowerCase() || "text";
    const bodyContent = email.body.content;

    if (bodyContentType === "html") {
      emailContent = decode(bodyContent);
    } else {
      emailContent = decode(bodyContent).replace(/\n/g, "<br>");
    }
  }

  return emailContent;
}

export const processAttachmentWithReducto = internalAction({
  args: {
    emailId: v.string(),
    attachment: attachmentSchema,
    messageId: v.id("messages"),
    accessToken: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`[REDUCTO] Processing attachment: ${args.attachment.name}`);

      // Fetch attachment content
      const response = await fetch(
        `${MICROSOFT_GRAPH_BASE_URL}/me/messages/${args.emailId}/attachments/${args.attachment.id}`,
        {
          headers: {
            Authorization: `Bearer ${args.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        console.error("[REDUCTO] Failed to fetch attachment");
        return null;
      }

      const attachmentData = await response.json();
      const bytes = base64ToUint8Array(attachmentData.contentBytes);

      // Initialize Reducto client
      const reductoClient = new Reducto({
        apiKey: process.env.REDUCTO_API_KEY,
      });

      // Upload and process with Reducto
      const file = await toFile(bytes, args.attachment.name);
      const upload = await reductoClient.upload({ file });

      const result = await reductoClient.parse.run({
        document_url: upload,
        options: {
          extraction_mode: "hybrid",
          chunking: {
            chunk_mode: "variable",
            chunk_size: 1000,
          },
        },
        advanced_options: {
          enable_change_tracking: true,
          add_page_markers: true,
          ocr_system: "highres",
          page_range: {
            start: 1,
            end: 50,
          },
        },
        experimental_options: {},
      });

      const content =
        result.result.type === "full"
          ? result.result.chunks.map((chunk) => chunk.content).join("\n\n")
          : `Document processed. Result URL: ${result.result.url}`;

      // Store processed attachment
      await ctx.runMutation(internal.webhooks.storeProcessedAttachment, {
        messageId: args.messageId,
        attachmentId: args.attachment.id,
        attachmentName: args.attachment.name || "attachment",
        content,
        metadata: {
          pageCount: result.usage?.num_pages || undefined,
          processingTime: result.duration || undefined,
        },
      });

      console.log(`[REDUCTO] Successfully processed: ${args.attachment.name}`);
      return content;
    } catch (error) {
      console.error(`[REDUCTO] Error processing attachment:`, error);
      return null;
    }
  },
});

export const createMicrosoftSubscriptions = async (
  webhookUrl: string,
  accessToken: string
): Promise<{ inbox: Subscription; sent: Subscription }> => {
  const expirationDateTime = new Date(
    Date.now() + WEBHOOK_SUBSCRIPTION_DURATION_MINUTES * 60 * 1000
  ).toISOString();

  const createSubscription = async (
    resource: string,
    clientState: string
  ): Promise<Subscription> => {
    try {
      const response = await fetch(
        `${MICROSOFT_GRAPH_BASE_URL}/subscriptions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            changeType: "created",
            notificationUrl: webhookUrl,
            resource,
            expirationDateTime,
            clientState,
          }),
        }
      );

      if (response.ok) {
        return await response.json();
      }

      const error = await response.json();
      throw new Error(
        `Failed to create subscription for ${clientState}: ${error.message}`
      );
    } catch (error) {
      console.error(
        `[WEBHOOK SETUP] Error creating ${clientState} subscription:`,
        error
      );
      throw new Error(`Error creating ${clientState} subscription: ${error}`);
    }
  };

  const [inbox, sent] = await Promise.all([
    createSubscription("me/mailFolders/Inbox/messages", "inbox"),
    createSubscription("me/mailFolders/SentItems/messages", "sent"),
  ]);

  return { inbox, sent };
};

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
