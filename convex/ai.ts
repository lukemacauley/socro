import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.CONVEX_ANTHROPIC_API_KEY!,
});

export const generateResponse = action({
  args: {
    conversationId: v.id("conversations"),
    emailContent: v.string(),
    emailSubject: v.string(),
    senderName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.runQuery(
      internal.ai.getConversationContext,
      {
        conversationId: args.conversationId,
      }
    );

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Build prompt for Anthropic
    const systemPrompt = `You are an AI email assistant. You help users manage their email conversations by providing suggested responses and insights. 

Current email details:
- Subject: ${args.emailSubject}
- From: ${args.senderName || "Unknown sender"}

Provide a helpful, professional response suggestion. Keep it concise and appropriate for email communication.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Email content: ${args.emailContent}`,
        },
      ],
    });

    const aiResponse =
      response.content[0].type === "text" ? response.content[0].text : null;
    if (!aiResponse) {
      throw new Error("No AI response generated");
    }

    // Save AI response to conversation
    await ctx.runMutation(internal.ai.saveAiResponse, {
      conversationId: args.conversationId,
      content: aiResponse,
    });

    return aiResponse;
  },
});

export const getConversationContext = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    return {
      conversation,
      messages,
    };
  },
});

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
      status: "in_progress",
      lastActivity: Date.now(),
    });
  },
});
