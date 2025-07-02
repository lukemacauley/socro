import { internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

export const processEmailNotification = internalMutation({
  args: {
    notification: v.any(),
  },
  handler: async (ctx, args) => {
    const { notification } = args;
    
    // Extract email information from Microsoft Graph notification
    const resourceData = notification.resourceData;
    const emailId = resourceData.id;
    
    // Schedule action to fetch full email details
    await ctx.scheduler.runAfter(0, internal.webhooks.fetchAndProcessEmail, {
      emailId,
      subscriptionId: notification.subscriptionId,
    });
  },
});

export const fetchAndProcessEmail = internalAction({
  args: {
    emailId: v.string(),
    subscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    // This would typically fetch the full email from Microsoft Graph API
    // For now, we'll create a mock email processing
    
    // Find user by subscription ID
    const userSettings = await ctx.runQuery(internal.webhooks.findUserBySubscription, {
      subscriptionId: args.subscriptionId,
    });

    if (!userSettings) {
      console.error("No user found for subscription:", args.subscriptionId);
      return;
    }

    // Mock email data - in real implementation, fetch from Microsoft Graph
    const mockEmail = {
      id: args.emailId,
      subject: "New Email Subject",
      from: {
        emailAddress: {
          address: "sender@example.com",
          name: "John Doe",
        },
      },
      body: {
        content: "This is the email content that would be fetched from Microsoft Graph API.",
      },
      receivedDateTime: new Date().toISOString(),
    };

    // Create conversation
    const conversationId = await ctx.runMutation(internal.webhooks.createConversation, {
      userId: userSettings.userId,
      emailId: mockEmail.id,
      subject: mockEmail.subject,
      fromEmail: mockEmail.from.emailAddress.address,
      fromName: mockEmail.from.emailAddress.name,
    });

    // Add email message
    await ctx.runMutation(internal.webhooks.addEmailMessage, {
      conversationId,
      content: mockEmail.body.content,
      emailId: mockEmail.id,
      sender: mockEmail.from.emailAddress.address,
    });

    // Generate AI response if auto-response is enabled
    if (userSettings.autoResponseEnabled) {
      await ctx.runAction(api.ai.generateResponse, {
        conversationId,
        emailContent: mockEmail.body.content,
        emailSubject: mockEmail.subject,
        senderName: mockEmail.from.emailAddress.name,
      });
    }
  },
});

export const findUserBySubscription = internalQuery({
  args: { subscriptionId: v.string() },
  handler: async (ctx, args) => {
    const userSettings = await ctx.db
      .query("userSettings")
      .filter((q) => q.eq(q.field("webhookSubscriptionId"), args.subscriptionId))
      .first();
    
    return userSettings;
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
