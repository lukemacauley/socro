import { api, components, internal } from "./_generated/api";
import { Agent } from "@convex-dev/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

// Configure the Anthropic chat model
const chat = anthropic("claude-3-5-sonnet-20241022");

// Define the email assistant agent
export const emailAgent = new Agent(components.agent, {
  name: "Email Assistant",
  chat: chat,
  instructions: `You are an AI assistant helping the user manage and understand their email conversations and documents.

Your approach:
- For emails from others: Summarize key points, identify action items, analyze documents
- For user questions: Answer directly and helpfully, referencing the context and documents
- Be conversational when the user addresses you
- Provide detailed analysis when asked about specific topics
- Remember previous messages in the thread to maintain context
- Consider any attachments and documents that have been processed for the conversation

Always be helpful and responsive to the user's needs.`,
});

// Create thread and send first message
export const createThreadAndSendMessage = internalAction({
  args: {
    conversationId: v.id("conversations"),
    prompt: v.string(),
  },
  handler: async (ctx, args): Promise<{ threadId: string; text: string }> => {
    // Get conversation details
    const conversation = await ctx.runQuery(api.agentHelpers.getConversation, {
      conversationId: args.conversationId,
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Get conversation context including attachments
    const conversationData = await ctx.runQuery(
      internal.ai.getConversationContext,
      {
        conversationId: args.conversationId,
      }
    );

    // Build context prefix
    let contextPrefix = "";
    if (
      conversationData?.processedAttachments &&
      conversationData.processedAttachments.length > 0
    ) {
      contextPrefix = `[Context: This conversation has ${conversationData.processedAttachments.length} processed attachment(s):\n`;
      for (const attachment of conversationData.processedAttachments) {
        contextPrefix += `\n--- ${
          attachment.attachmentName
        } ---\n${attachment.content.substring(0, 1000)}${
          attachment.content.length > 1000 ? "..." : ""
        }\n`;
      }
      contextPrefix += "]\n\n";
    }

    // Create a new thread for this conversation
    const { threadId, thread } = await emailAgent.createThread(ctx, {
      userId: conversation.userId,
      title: conversation.subject,
    });

    // Update conversation with thread ID
    await ctx.runMutation(internal.agentHelpers.updateConversationThreadId, {
      conversationId: args.conversationId,
      agentThreadId: threadId,
    });

    // Save user message to our database
    await ctx.runMutation(internal.agent.saveUserMessage, {
      conversationId: args.conversationId,
      content: args.prompt,
    });

    // Generate AI response with streaming
    const result = await thread.streamText(
      {
        prompt: contextPrefix + args.prompt,
      },
      {
        saveStreamDeltas: true,
      }
    );

    // Consume the stream
    await result.consumeStream();
    const text = await result.text;

    // Save AI response to our database
    await ctx.runMutation(internal.agent.saveAiResponse, {
      conversationId: args.conversationId,
      content: text,
    });

    return { threadId, text };
  },
});

// Continue existing thread
export const continueThread = internalAction({
  args: {
    conversationId: v.id("conversations"),
    threadId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    // Get conversation context including attachments
    const conversationData = await ctx.runQuery(
      internal.ai.getConversationContext,
      {
        conversationId: args.conversationId,
      }
    );

    // Build context prefix for attachments
    let contextPrefix = "";
    if (
      conversationData?.processedAttachments &&
      conversationData.processedAttachments.length > 0
    ) {
      contextPrefix = `[Context: Attached documents are available in this conversation]\n\n`;
    }

    // Continue the thread
    const { thread } = await emailAgent.continueThread(ctx, {
      threadId: args.threadId,
    });

    // Save user message to our database
    await ctx.runMutation(internal.agent.saveUserMessage, {
      conversationId: args.conversationId,
      content: args.prompt,
    });

    // Generate AI response with streaming
    const result = await thread.streamText(
      {
        prompt: contextPrefix + args.prompt,
      },
      {
        saveStreamDeltas: true,
      }
    );

    // Consume the stream
    await result.consumeStream();
    const text = await result.text;

    // Save AI response to our database
    await ctx.runMutation(internal.agent.saveAiResponse, {
      conversationId: args.conversationId,
      content: text,
    });

    return text;
  },
});

// Simple mutation to handle sending messages
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Schedule the appropriate action based on whether we have a thread
    if (conversation.agentThreadId) {
      await ctx.scheduler.runAfter(0, internal.agent.continueThread, {
        conversationId: args.conversationId,
        threadId: conversation.agentThreadId,
        prompt: args.prompt,
      });
    } else {
      await ctx.scheduler.runAfter(
        0,
        internal.agent.createThreadAndSendMessage,
        {
          conversationId: args.conversationId,
          prompt: args.prompt,
        }
      );
    }
  },
});

// Internal mutation to save user message
export const saveUserMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      content: args.content,
      type: "user_note",
      sender: "User",
      timestamp: Date.now(),
    });
  },
});

// Internal mutation to save AI response
export const saveAiResponse = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      content: args.content,
      type: "ai_response",
      sender: "ai",
      timestamp: Date.now(),
    });

    await ctx.db.patch(args.conversationId, {
      lastActivity: Date.now(),
    });
  },
});

// Query to list thread messages for the agent
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    // Return messages from the agent's thread
    return await emailAgent.queryThreadMessages(ctx, args);
  },
});

// Query to list messages for a conversation
export const listMessagesForConversation = query({
  args: {
    conversationId: v.id("conversations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { conversationId, paginationOpts } = args;

    // Get all messages from our messages table
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId)
      )
      .order("desc")
      .paginate(paginationOpts);

    return messages;
  },
});
