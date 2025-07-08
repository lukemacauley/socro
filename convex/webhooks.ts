import {
  internalMutation,
  internalAction,
  internalQuery,
  action,
} from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { getUserSettingsByUserId, getMicrosoftAccessToken } from "./lib/utils";
import { attachmentValidator, messageType } from "./lib/validators";
import Reducto, { toFile } from "reductoai";
import type { Id } from "./_generated/dataModel";
import { decode as heDecode } from "he";

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

    // We'll determine if it's a sent email later by checking the sender
    const isSentEmail = false; // Temporary, will be determined when we fetch the email

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
      isSentEmail,
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

    // Get access token - Clerk will automatically refresh if needed
    const accessToken = await getMicrosoftAccessToken(user.externalId);

    // Fetch the full email from Microsoft Graph API including attachments
    let email;
    try {
      console.log("[WEBHOOK] Fetching email from Microsoft Graph API...");
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${args.emailId}?$select=id,subject,from,body,uniqueBody,receivedDateTime,isRead,hasAttachments,conversationId,conversationIndex,replyTo&$expand=attachments($select=id,name,contentType,size)`,
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

        // If it's a 401, something is wrong with the token
        // This shouldn't happen with automatic refresh, but log it
        if (response.status === 401) {
          console.error("[WEBHOOK] Unexpected 401 error - token should have been refreshed");
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
        hasAttachments: email.hasAttachments,
        attachmentCount: email.attachments?.length || 0,
        conversationId: email.conversationId,
        conversationIndex: email.conversationIndex,
        hasUniqueBody: !!email.uniqueBody,
        uniqueBodyLength: email.uniqueBody?.content?.length || 0,
      });
    } catch (error) {
      console.error(
        "[WEBHOOK] Error fetching email from Microsoft Graph:",
        error
      );
      return;
    }

    // Check if message already exists for this email ID or internetMessageId
    console.log("[WEBHOOK] Checking if message already exists...");
    const existingMessage = await ctx.runQuery(
      internal.webhooks.findMessageByEmailId,
      {
        emailId: email.id,
      }
    );

    if (existingMessage) {
      console.log("[WEBHOOK] Message already exists for email:", email.id);
      return;
    }

    if (!userId) {
      console.error(
        "[WEBHOOK] No user ID available, cannot create conversation"
      );
      return;
    }

    // Determine if this is a sent email by checking if sender matches user's email
    const actualIsSentEmail =
      email.from?.emailAddress?.address?.toLowerCase() ===
      user?.email?.toLowerCase();
    console.log(
      `[WEBHOOK] Email from: ${email.from?.emailAddress?.address}, User email: ${user?.email}, Is sent: ${actualIsSentEmail}`
    );

    // Check if conversation exists for this thread
    console.log("[WEBHOOK] Checking for existing thread...");
    let conversationId: Id<"conversations">;
    let isNewConversation = false;

    const threadId = email.conversationId || email.id; // Use email ID as fallback if no thread ID

    const existingConversation = await ctx.runQuery(
      internal.webhooks.findConversationByThreadId,
      {
        threadId,
        userId,
      }
    );

    if (existingConversation) {
      console.log("[WEBHOOK] Found existing thread:", existingConversation._id);
      conversationId = existingConversation._id;

      // Update conversation activity
      await ctx.runMutation(internal.webhooks.updateConversationActivity, {
        conversationId,
        emailId: email.id,
        fromEmail: email.from?.emailAddress?.address || "unknown@email.com",
        fromName: email.from?.emailAddress?.name,
        subject: email.subject || existingConversation.subject,
      });
    } else {
      // Create new conversation
      console.log("[WEBHOOK] Creating new conversation for thread:", threadId);
      isNewConversation = true;
      conversationId = await ctx.runMutation(
        internal.webhooks.createConversation,
        {
          userId,
          emailId: email.id,
          threadId,
          subject: email.subject || "(No subject)",
          fromEmail: email.from?.emailAddress?.address || "unknown@email.com",
          fromName: email.from?.emailAddress?.name,
        }
      );
      console.log("[WEBHOOK] Created conversation:", conversationId);
    }

    // Extract and parse email content
    let emailContent = "";

    // First, try Microsoft's uniqueBody if available (contains only the unique/new content)
    if (email.uniqueBody?.content) {
      console.log("[WEBHOOK] Using uniqueBody from Microsoft Graph");
      const uniqueBodyType =
        email.uniqueBody.contentType?.toLowerCase() || "text";
      let uniqueContent = email.uniqueBody.content;

      console.log(
        `[WEBHOOK] UniqueBody raw content (first 200 chars): "${uniqueContent}" of type "${uniqueBodyType}"`
      );

      // Use Microsoft's exact pattern from microsoft-driver.ts
      if (uniqueBodyType === 'html') {
        emailContent = heDecode(uniqueContent);
      } else {
        emailContent = heDecode(uniqueContent).replace(/\n/g, '<br>');
      }

      console.log(
        `[WEBHOOK] UniqueBody extracted: ${emailContent.length} chars, content: "${emailContent}"`
      );
    }
    else {
      // Fall back to parsing the full body if uniqueBody is not available
      console.log("[WEBHOOK] UniqueBody not available, using full body");
      const bodyContent = email.body?.content || "";
      const bodyContentType = email.body?.contentType?.toLowerCase() || "text";

      // Use Microsoft's exact pattern
      if (bodyContentType === "html") {
        emailContent = heDecode(bodyContent);
      } else {
        emailContent = heDecode(bodyContent).replace(/\n/g, '<br>');
      }
    }

    console.log(
      `[WEBHOOK] Processed email - Final content length: ${emailContent.length} chars`
    );

    // Don't save empty emails
    if (!emailContent || !emailContent.trim()) {
      console.log("[WEBHOOK] Skipping empty email content");
      return;
    }

    // Add email message with attachments
    console.log("[WEBHOOK] Adding email message to conversation...");

    // Process attachments if any
    let attachments = undefined;
    let processedAttachmentContent = "";

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

      // Process legal document attachments with Reducto
      const supportedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "text/plain",
      ];

      for (const attachment of email.attachments) {
        if (supportedTypes.includes(attachment.contentType)) {
          try {
            console.log(
              `[WEBHOOK] Processing attachment with Reducto: ${attachment.name}`
            );

            // Fetch attachment content
            const attachmentResponse = await fetch(
              `https://graph.microsoft.com/v1.0/me/messages/${email.id}/attachments/${attachment.id}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );

            if (attachmentResponse.ok) {
              const attachmentData = await attachmentResponse.json();
              // Convert base64 to Uint8Array (Convex doesn't have Buffer)
              console.log(
                `[REDUCTO] Converting base64 to Uint8Array for ${attachment.name}`
              );
              const base64 = attachmentData.contentBytes;
              const binaryString = atob(base64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }

              // Initialize Reducto client
              console.log(
                `[REDUCTO] Initializing client for ${attachment.name}`
              );
              const reductoClient = new Reducto({
                apiKey: process.env.REDUCTO_API_KEY,
              });

              // Upload and process with Reducto
              console.log(
                `[REDUCTO] Creating file object from Uint8Array (${bytes.length} bytes)`
              );
              const file = await toFile(bytes, attachment.name);

              console.log(`[REDUCTO] Uploading file to Reducto...`);
              const uploadStart = Date.now();
              const upload = await reductoClient.upload({ file });
              console.log(
                `[REDUCTO] Upload complete in ${Date.now() - uploadStart}ms`
              );
              console.log(
                `[REDUCTO] Upload response:`,
                JSON.stringify(upload, null, 2)
              );

              console.log(`[REDUCTO] Starting document parsing...`);
              const parseStart = Date.now();
              const result = await reductoClient.parse.run({
                document_url: upload,
                options: {
                  extraction_mode: "hybrid", // Use hybrid mode for better legal document extraction
                  chunking: {
                    chunk_mode: "variable",
                    chunk_size: 1000,
                  },
                },
                advanced_options: {
                  enable_change_tracking: true, // Now this will work with hybrid mode
                  add_page_markers: true,
                  ocr_system: "highres",
                  page_range: {
                    start: 1,
                    end: 50, // Process up to 50 pages for legal documents
                  },
                },
                experimental_options: {},
              });
              console.log(
                `[REDUCTO] Parsing complete in ${Date.now() - parseStart}ms`
              );
              console.log(`[REDUCTO] Parse response summary:`, {
                job_id: result.job_id,
                duration: result.duration,
                result_type: result.result.type,
                usage: result.usage,
                pdf_url: result.pdf_url,
              });

              if (result.result.type === "full") {
                console.log(`[REDUCTO] Full result details:`, {
                  chunks_count: result.result.chunks.length,
                  total_blocks: result.result.chunks.reduce(
                    (sum, chunk) => sum + chunk.blocks.length,
                    0
                  ),
                  first_chunk_preview:
                    result.result.chunks[0]?.content.substring(0, 200) + "...",
                });
              }

              // Store processed attachment
              console.log(`[REDUCTO] Storing processed content in database...`);
              const processedContent =
                result.result.type === "full"
                  ? result.result.chunks
                      .map((chunk) => chunk.content)
                      .join("\n\n")
                  : `Document processed. Result URL: ${result.result.url}`;

              console.log(
                `[REDUCTO] Processed content length: ${processedContent.length} characters`
              );

              await ctx.runMutation(
                internal.webhooks.storeProcessedAttachment,
                {
                  conversationId,
                  attachmentId: attachment.id,
                  attachmentName: attachment.name,
                  processedContent,
                  metadata: {
                    pageCount: result.usage?.num_pages || undefined,
                    processingTime: result.duration || undefined,
                  },
                }
              );
              console.log(`[REDUCTO] Content stored in database`);

              const content =
                result.result.type === "full"
                  ? result.result.chunks
                      .map((chunk) => chunk.content)
                      .join("\n\n")
                  : `Document processed. Result URL: ${result.result.url}`;
              processedAttachmentContent += `\n\n--- Attachment: ${attachment.name} ---\n${content}`;
              console.log(
                `[REDUCTO] Successfully processed attachment: ${attachment.name}`
              );
              console.log(
                `[REDUCTO] Total processed content length so far: ${processedAttachmentContent.length} characters`
              );
            }
          } catch (error) {
            console.error(
              `[REDUCTO] Error processing attachment ${attachment.name}:`,
              error
            );
            console.error(`[REDUCTO] Error details:`, {
              message: error instanceof Error ? error.message : "Unknown error",
              stack: error instanceof Error ? error.stack : undefined,
              attachment: {
                name: attachment.name,
                type: attachment.contentType,
                size: attachment.size,
              },
            });

            // If it's a fetch error, it might be CORS or network issue
            if (error instanceof Error && error.message.includes("fetch")) {
              console.error(
                `[REDUCTO] This might be a CORS or network issue. Make sure Reducto API allows requests from Convex.`
              );
            }
          }
        }
      }
    }

    await ctx.runMutation(internal.webhooks.addEmailMessage, {
      conversationId,
      content: emailContent,
      emailId: email.id,
      sender: email.from?.emailAddress?.address || "unknown@email.com",
      attachments,
      messageType: actualIsSentEmail ? "sent_email" : "email",
    });
    console.log("[WEBHOOK] Email message added successfully");

    // Generate AI response only for received emails (not sent emails)
    if (!actualIsSentEmail) {
      console.log("[WEBHOOK] User settings:", userSettings);
      console.log(
        "[WEBHOOK] Auto-response enabled:",
        userSettings?.autoResponseEnabled
      );
      console.log("[WEBHOOK] Is new conversation:", isNewConversation);

      // Always generate AI response for new emails (whether new conversation or reply)
      if (userSettings?.autoResponseEnabled || true) {
        // Always true for testing
        console.log("[WEBHOOK] Generating AI response for received email...");
        console.log("[WEBHOOK] Email content length:", emailContent.length);
        console.log(
          "[WEBHOOK] Processed attachment content length:",
          processedAttachmentContent.length
        );

        try {
          // Create a new agent thread for each email
          console.log("[WEBHOOK] Creating new agent thread for email");
          const agentThreadId = await ctx.runMutation(internal.agent.createEmailThread, {
            userId,
            emailSubject: email.subject || "(No subject)",
            emailId: email.id,
          });
          
          // Process email through agent
          const aiResponse = await ctx.runAction(internal.agent.processEmailWithAgent, {
            threadId: agentThreadId,
            emailContent,
            emailSubject: email.subject || "(No subject)",
            senderEmail: email.from?.emailAddress?.address || "unknown@email.com",
            senderName: email.from?.emailAddress?.name,
            attachmentContent: processedAttachmentContent || undefined,
          });
          
          console.log("[WEBHOOK] AI response generated successfully via agent");
          
          // For now, still save to conversations/messages table for existing UI
          await ctx.runMutation(internal.webhooks.addEmailMessage, {
            conversationId,
            content: aiResponse,
            emailId: `ai-response-${Date.now()}`,
            sender: "ai",
            messageType: "ai_response",
          });
        } catch (error) {
          console.error("[WEBHOOK] Error generating AI response:", error);
        }
      }
    } else {
      console.log("[WEBHOOK] Skipping AI response for sent email");
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

// Removed findConversationByEmailId - we track by thread, not individual emails

export const findConversationByThreadId = internalQuery({
  args: {
    threadId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conversations")
      .withIndex("by_thread", (q) =>
        q.eq("threadId", args.threadId).eq("userId", args.userId)
      )
      .first();
  },
});

export const findMessageByEmailId = internalQuery({
  args: { emailId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
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
    threadId: v.string(),
    emailId: v.string(),
    subject: v.string(),
    fromEmail: v.string(),
    fromName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("conversations", {
      threadId: args.threadId,
      userId: args.userId,
      subject: args.subject,
      status: "new",
      initialEmailId: args.emailId,
      latestEmailId: args.emailId,
      participants: [
        {
          email: args.fromEmail,
          name: args.fromName,
        },
      ],
      createdAt: Date.now(),
      lastActivity: Date.now(),
    });
  },
});

export const updateConversationActivity = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    emailId: v.string(),
    fromEmail: v.string(),
    fromName: v.optional(v.string()),
    subject: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return;

    // Check if this participant is already in the list
    const participantExists = conversation.participants.some(
      (p) => p.email === args.fromEmail
    );

    const updatedParticipants = participantExists
      ? conversation.participants
      : [
          ...conversation.participants,
          { email: args.fromEmail, name: args.fromName },
        ];

    await ctx.db.patch(args.conversationId, {
      lastActivity: Date.now(),
      latestEmailId: args.emailId,
      // Update subject if it's more detailed (e.g., "Re: " prefix added)
      subject:
        args.subject.length > conversation.subject.length
          ? args.subject
          : conversation.subject,
      participants: updatedParticipants,
    });
  },
});

export const storeProcessedAttachment = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    attachmentId: v.string(),
    attachmentName: v.string(),
    processedContent: v.string(),
    metadata: v.optional(
      v.object({
        pageCount: v.optional(v.number()),
        processingTime: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("processedAttachments", {
      conversationId: args.conversationId,
      attachmentId: args.attachmentId,
      attachmentName: args.attachmentName,
      content: args.processedContent,
      metadata: args.metadata,
      processedAt: Date.now(),
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
    messageType: v.optional(messageType),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      content: args.content,
      type: args.messageType || "email",
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
        "[WEBHOOK SETUP] Creating new subscriptions with URL:",
        webhookUrl
      );

      // Subscribe to Inbox messages
      console.log("[WEBHOOK SETUP] Subscribing to Inbox...");
      const inboxSubscriptionResponse = await fetch(
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
            resource: "me/mailFolders/Inbox/messages",
            expirationDateTime: new Date(
              Date.now() + 4230 * 60 * 1000 // ~70 hours
            ).toISOString(),
            clientState: "inbox", // To distinguish between inbox and sent
          }),
        }
      );

      let inboxSubscription = null;
      if (inboxSubscriptionResponse.ok) {
        inboxSubscription = await inboxSubscriptionResponse.json();
        console.log(
          "[WEBHOOK SETUP] Inbox subscription created:",
          inboxSubscription.id
        );
      }

      // Subscribe to Sent Items
      console.log("[WEBHOOK SETUP] Subscribing to Sent Items...");
      const sentSubscriptionResponse = await fetch(
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
            resource: "me/mailFolders/SentItems/messages",
            expirationDateTime: new Date(
              Date.now() + 4230 * 60 * 1000 // ~70 hours
            ).toISOString(),
            clientState: "sent", // To distinguish between inbox and sent
          }),
        }
      );

      let sentSubscription = null;
      if (sentSubscriptionResponse.ok) {
        sentSubscription = await sentSubscriptionResponse.json();
        console.log(
          "[WEBHOOK SETUP] Sent Items subscription created:",
          sentSubscription.id
        );
      } else {
        const error = await sentSubscriptionResponse.json();
        console.error(
          "[WEBHOOK SETUP] Failed to create Sent Items subscription:",
          error
        );
      }

      if (!inboxSubscription && !sentSubscription) {
        console.error("[WEBHOOK SETUP] Failed to create any subscriptions");
        return;
      }

      // Store subscription IDs in Convex (we'll use the inbox subscription ID as primary)
      const primarySubscriptionId =
        inboxSubscription?.id || sentSubscription?.id;
      await ctx.runMutation(internal.webhooks.updateUserMicrosoftAuth, {
        userId: user._id,
        subscriptionId: primarySubscriptionId,
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
      // Check if we have active subscriptions for both inbox and sent folders
      const activeSubscriptions = data.value.filter(
        (sub: any) =>
          (sub.resource === "me/mailFolders/Inbox/messages" ||
            sub.resource === "me/mailFolders/SentItems/messages") &&
          new Date(sub.expirationDateTime) > new Date() &&
          sub.notificationUrl === expectedWebhookUrl
      );

      if (activeSubscriptions.length > 0) {
        console.log(
          `[WEBHOOK SETUP] Found ${activeSubscriptions.length} active subscription(s) with correct URL`
        );
        // Return the first subscription ID (preferably inbox)
        const inboxSub = activeSubscriptions.find((s: any) =>
          s.resource.includes("Inbox")
        );
        return inboxSub?.id || activeSubscriptions[0].id;
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

// Renew all active webhook subscriptions
export const renewAllWebhookSubscriptions = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("[WEBHOOK RENEWAL] Starting subscription renewal process");
    
    // Get all users with webhook subscriptions
    const userSettings = await ctx.runQuery(
      internal.webhooks.getAllUsersWithWebhooks
    );
    
    let renewed = 0;
    let failed = 0;
    
    for (const settings of userSettings) {
      try {
        const user = await ctx.runQuery(internal.users.getById, {
          userId: settings.userId,
        });
        
        if (!user) continue;
        
        console.log(`[WEBHOOK RENEWAL] Renewing subscription for user: ${user.email}`);
        
        const accessToken = await getMicrosoftAccessToken(user.externalId);
        
        // First, try to update the existing subscription
        const wasRenewed = await renewSubscription(
          accessToken,
          settings.webhookSubscriptionId!
        );
        
        if (wasRenewed) {
          renewed++;
          console.log(`[WEBHOOK RENEWAL] Successfully renewed subscription for ${user.email}`);
        } else {
          // If renewal failed, create a new subscription
          console.log(`[WEBHOOK RENEWAL] Renewal failed, creating new subscription for ${user.email}`);
          await ctx.runAction(internal.webhooks.setupMicrosoftWebhook, {
            clerkUserId: user.externalId,
          });
          renewed++;
        }
      } catch (error) {
        failed++;
        console.error(`[WEBHOOK RENEWAL] Failed to renew subscription:`, error);
      }
    }
    
    console.log(`[WEBHOOK RENEWAL] Completed. Renewed: ${renewed}, Failed: ${failed}`);
  },
});

async function renewSubscription(
  accessToken: string,
  subscriptionId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expirationDateTime: new Date(
            Date.now() + 4230 * 60 * 1000 // ~70 hours
          ).toISOString(),
        }),
      }
    );
    
    return response.ok;
  } catch (error) {
    console.error("[WEBHOOK RENEWAL] Error renewing subscription:", error);
    return false;
  }
}

export const getAllUsersWithWebhooks = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("userSettings")
      .filter((q) => q.neq(q.field("webhookSubscriptionId"), undefined))
      .collect();
  },
});

// Refresh all user OAuth tokens to keep them fresh
export const refreshAllUserTokens = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("[TOKEN REFRESH] Starting token refresh for all users");
    
    // Get all users with webhook subscriptions
    const userSettings = await ctx.runQuery(
      internal.webhooks.getAllUsersWithWebhooks
    );
    
    let refreshed = 0;
    let failed = 0;
    
    for (const settings of userSettings) {
      try {
        const user = await ctx.runQuery(internal.users.getById, {
          userId: settings.userId,
        });
        
        if (!user) continue;
        
        // Simply calling getMicrosoftAccessToken will trigger Clerk to refresh if needed
        await getMicrosoftAccessToken(user.externalId);
        
        refreshed++;
        console.log(`[TOKEN REFRESH] Refreshed token for user: ${user.email}`);
      } catch (error) {
        failed++;
        console.error(`[TOKEN REFRESH] Failed to refresh token:`, error);
      }
    }
    
    console.log(`[TOKEN REFRESH] Completed. Refreshed: ${refreshed}, Failed: ${failed}`);
  },
});

