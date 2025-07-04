import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";
import type { Doc } from "./_generated/dataModel";

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
  handler: async (ctx, args): Promise<string> => {
    const conversationData = await ctx.runQuery(
      internal.ai.getConversationContext,
      {
        conversationId: args.conversationId,
      }
    );

    if (!conversationData) {
      throw new Error("Conversation not found");
    }

    const { conversation, messages } = conversationData;

    // Build conversation history for context
    let threadContext = "";
    const previousMessages = messages.filter(m => m.type !== "user_note");
    
    if (previousMessages.length > 1) {
      threadContext = "\n\nPrevious messages in this thread:\n";
      for (const msg of previousMessages.slice(0, -1)) { // Exclude the latest message
        const timestamp = new Date(msg.timestamp).toLocaleString();
        if (msg.type === "email") {
          threadContext += `\n[${timestamp}] Email from ${msg.sender}:\n${msg.content.substring(0, 500)}${msg.content.length > 500 ? '...' : ''}\n`;
        } else if (msg.type === "ai_response") {
          threadContext += `\n[${timestamp}] Your previous response:\n${msg.content.substring(0, 300)}${msg.content.length > 300 ? '...' : ''}\n`;
        }
      }
    }

    // Build prompt for Anthropic
    const systemPrompt = `You are an AI legal email assistant specializing in contract review and legal document analysis. You help lawyers and legal professionals manage their email conversations by providing suggested responses and insights about legal documents.

Current conversation details:
- Subject: ${args.emailSubject}
- From: ${args.senderName || "Unknown sender"}
- Thread has ${messages.length} messages

When analyzing legal documents or contracts:
1. Identify specific clauses or sections mentioned in the email
2. Provide precise analysis of any requested changes
3. Flag potential legal issues or concerns
4. Suggest appropriate legal language for responses
5. Maintain a professional, legally-sound tone
6. Consider the full context of the email thread when responding

If the email mentions specific changes (e.g., "change clause 12"), focus your response on that specific request and provide actionable legal guidance.

IMPORTANT: You are responding to the latest email in the thread. Consider previous messages for context but focus your response on addressing the most recent email.`;

    const userMessage = threadContext 
      ? `${threadContext}\n\nLatest email to respond to:\n${args.emailContent}`
      : `Email content: ${args.emailContent}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 20000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userMessage,
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
