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

    const { conversation, messages, processedAttachments } = conversationData;

    // Include attachment content if available
    let attachmentContext = "";
    if (processedAttachments && processedAttachments.length > 0) {
      attachmentContext = "\n\nAttached Documents:\n";
      for (const attachment of processedAttachments) {
        attachmentContext += `\n--- ${attachment.attachmentName} ---\n${attachment.content}\n`;
      }
    }

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
    const systemPrompt = `You are an AI assistant helping the user manage and understand their email conversations and documents. You have two distinct modes:

1. **When processing new emails**: Provide brief observations and summaries
2. **When the user asks you questions directly**: Engage conversationally and answer their questions thoroughly

Current conversation details:
- Subject: ${args.emailSubject}
- Latest sender: ${args.senderName || "Unknown sender"}
- Thread has ${messages.length} messages

Your approach:
- For emails from others: Summarize key points, identify action items, analyze documents
- For user questions: Answer directly and helpfully, referencing the context and documents
- Be conversational when the user addresses you
- Provide detailed analysis when asked about specific topics
- Remember previous messages in the thread to maintain context

Examples:
- Email from someone else: "Document received: Spanish rental contract for Madrid apartment. Key terms: €4,250/month, 1-year initial term..."
- User asks "what happens if the tenant doesn't pay?": "Based on the contract, if the tenant doesn't pay: [detailed explanation of consequences]"
- User says "hello?": "Yes, I'm here! How can I help you with this conversation?"

Always be helpful and responsive to the user's needs.`;

    const isUserNote = args.senderName === "User";
    
    const userMessage = isUserNote
      ? `${attachmentContext}${threadContext}\n\nThe user is asking you directly: "${args.emailContent}"\n\nPlease respond conversationally and helpfully to their question.`
      : threadContext 
      ? `${attachmentContext}${threadContext}\n\nLatest email in the thread:\n${args.emailContent}\n\nProvide a brief observation or note about this email.`
      : `${attachmentContext}\n\nEmail content: ${args.emailContent}\n\nProvide a brief observation or note about this email.`;

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

    // Also get processed attachments for this conversation
    const processedAttachments = await ctx.db
      .query("processedAttachments")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    return {
      conversation,
      messages,
      processedAttachments,
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
