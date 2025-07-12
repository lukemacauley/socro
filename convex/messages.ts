import { v } from "convex/values";
import {
  query,
  internalQuery,
  internalMutation,
  internalAction,
  action,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import { verifyThreadOwnership } from "./lib/utils";

export const getMessages = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);
    await verifyThreadOwnership(ctx, args.threadId, userId);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();

    // Get streaming chunks for assistant messages
    const messagesWithChunks = await Promise.all(
      messages.map(async (message) => {
        if (message.role === "ai" && message.isStreaming) {
          const chunks = await ctx.db
            .query("streamingChunks")
            .withIndex("by_message", (q) => q.eq("messageId", message._id))
            .order("asc")
            .collect();

          const streamedContent = chunks.map((chunk) => chunk.chunk).join("");
          return {
            ...message,
            content: streamedContent || message.content,
            chunks: chunks.length,
          };
        }
        return message;
      })
    );

    return messagesWithChunks;
  },
});

export const sendMessage = action({
  args: {
    content: v.string(),
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);

    const { responseMessageId } = await ctx.runMutation(
      internal.messages.insertWithResponsePlaceholder,
      {
        threadId: args.threadId,
        content: args.content,
        userId,
      }
    );

    await ctx.runAction(internal.messages.generateStreamingResponse, {
      threadId: args.threadId,
      responseMessageId,
    });
  },
});

// Helper mutation to insert user message
export const insertWithResponsePlaceholder = internalMutation({
  args: {
    content: v.string(),
    threadId: v.id("threads"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyThreadOwnership(ctx, args.threadId, args.userId);

    const userMessageId = await ctx.db.insert("messages", {
      content: args.content,
      role: "user",
      userId: args.userId,
      threadId: args.threadId,
      messageType: "user_message",
    });

    const responseMessageId = await ctx.db.insert("messages", {
      content: "",
      role: "ai",
      userId: args.userId,
      threadId: args.threadId,
      isStreaming: true,
      streamingComplete: false,
      messageType: "ai_response",
    });

    return {
      userMessageId,
      responseMessageId,
    };
  },
});

export const generateStreamingResponse = internalAction({
  args: {
    threadId: v.id("threads"),
    responseMessageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    // Get conversation history
    const messages = await ctx.runQuery(internal.messages.getThreadHistory, {
      threadId: args.threadId,
    });

    const thread = await ctx.runQuery(internal.threads.get, {
      threadId: args.threadId,
    });

    try {
      const apiKey = process.env.CONVEX_ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY environment variable is not set");
      }

      // Comprehensive system prompt for legal AI assistant
      const systemPrompt = `You are an expert legal AI assistant designed to help lawyers draft professional email responses. Your role is to analyze incoming emails and create thoughtful, legally sound responses while maintaining the highest standards of legal practice.

# Core Capabilities and Responsibilities:

## 1. Email Analysis
- Identify the key legal issues, questions, or requests in the email
- Recognize the type of legal matter (litigation, transactional, advisory, etc.)
- Assess urgency and priority level
- Identify all parties involved and their relationships
- Note any deadlines, dates, or time-sensitive matters

## 2. Professional Communication Standards
- Maintain a professional, courteous tone appropriate for legal correspondence
- Use clear, precise language avoiding unnecessary legalese
- Structure responses logically with proper paragraphs and formatting
- Ensure grammar and spelling are impeccable
- Adapt tone based on recipient (client, opposing counsel, court, colleague)

## 3. Legal Accuracy and Ethics
- Never provide definitive legal advice without appropriate disclaimers
- Flag areas requiring attorney review or additional research
- Maintain attorney-client privilege considerations
- Identify potential conflicts of interest
- Suggest when matters should be escalated to senior counsel
- Always err on the side of caution with legal conclusions

## 4. Response Drafting Guidelines
- Begin with appropriate salutation and reference to their communication
- Acknowledge receipt and thank them for their message when appropriate
- Address each point raised systematically
- Provide clear action items and next steps
- Include relevant timelines and deadlines
- End with professional closing and clear contact information
- Suggest any necessary disclaimers or confidentiality notices

## 5. Special Considerations
- For litigation matters: Be mindful of admissions, maintain strategic positioning
- For transactional matters: Focus on deal progression and commercial reasonableness  
- For client communications: Balance legal accuracy with accessibility
- For opposing counsel: Maintain professional boundaries while advocating firmly
- For internal communications: Be candid while maintaining professionalism

## 6. Risk Management
- Identify issues requiring malpractice insurance considerations
- Flag statute of limitations concerns
- Note any potential ethical violations
- Highlight areas where written confirmation is advisable
- Suggest when phone calls might be preferable to written communication

## 7. Practical Features
- When relevant, suggest template language for common scenarios
- Provide alternative phrasings for sensitive topics
- Include placeholders [IN BRACKETS] for information requiring attorney input
- Highlight sections requiring particular attorney review with **[ATTORNEY REVIEW NEEDED]**

Remember: You are a tool to enhance legal practice efficiency, not replace attorney judgment. Always encourage appropriate human review of substantive legal matters.`;

      // Build the conversation with proper Anthropic format
      const anthropicMessages = [];

      // First, add all previous messages as context (excluding the most recent)
      if (messages && messages.length > 1) {
        const previousMessages = messages
          .slice(0, -1)
          .filter((msg) => msg.content?.trim() !== "")
          .map((msg) => ({
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.content || "",
          }));
        anthropicMessages.push(...previousMessages);
      }

      // Get the most recent message that needs a response
      const mostRecentMessage =
        messages && messages.length > 0 ? messages[messages.length - 1] : null;

      // Format the request for response to the most recent message
      if (mostRecentMessage) {
        anthropicMessages.push({
          role: "user",
          content: `Based on the conversation history above, please draft a professional legal response to this most recent email:

---
From: ${
            thread?.fromParticipants.name ||
            thread?.fromParticipants.email ||
            "[Sender]"
          }
Subject: ${thread?.subject || "[No Subject]"}
Date: ${new Date(mostRecentMessage._creationTime).toLocaleString() || "[Date]"}

Email Content:
${mostRecentMessage.content}
---

Please draft a professional legal response that:
1. Directly addresses all points in the above email
2. Considers the full conversation history for context
3. Maintains consistency with any previous responses in this thread
4. Follows all legal communication best practices`,
        });
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-4-20250514",
          max_tokens: 30000,
          temperature: 0.2, // Lower temperature for more consistent legal writing
          system: systemPrompt,
          messages: anthropicMessages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.log("Anthropic API error:", errorBody);
        throw new Error(
          `Anthropic API error: ${response.status} ${response.statusText}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body reader available");
      }

      const decoder = new TextDecoder();
      let chunkIndex = 0;
      let fullContent = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);

                if (
                  parsed.type === "content_block_delta" &&
                  parsed.delta?.text
                ) {
                  const content = parsed.delta.text;
                  fullContent += content;

                  // Store chunk in database
                  await ctx.runMutation(internal.messages.addStreamingChunk, {
                    messageId: args.responseMessageId,
                    chunk: content,
                    chunkIndex,
                  });

                  chunkIndex++;
                }
              } catch (parseError) {
                // Skip invalid JSON lines
                continue;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Mark streaming as complete
      await ctx.runMutation(internal.messages.completeStreaming, {
        messageId: args.responseMessageId,
        finalContent:
          fullContent || "I apologize, but I couldn't generate a response.",
      });
    } catch (error) {
      console.log({ error });
      console.error("Streaming error:", error);
      await ctx.runMutation(internal.messages.completeStreaming, {
        messageId: args.responseMessageId,
        finalContent:
          "Sorry, I encountered an error while generating the response. Please make sure the ANTHROPIC_API_KEY environment variable is set.",
      });
    }
  },
});

export const getThreadHistory = internalQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .filter((q) => q.neq(q.field("isStreaming"), true))
      .order("asc")
      .collect();
  },
});

export const addStreamingChunk = internalMutation({
  args: {
    messageId: v.id("messages"),
    chunk: v.string(),
    chunkIndex: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("streamingChunks", {
      messageId: args.messageId,
      chunk: args.chunk,
      chunkIndex: args.chunkIndex,
    });
  },
});

export const completeStreaming = internalMutation({
  args: {
    messageId: v.id("messages"),
    finalContent: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      content: args.finalContent,
      isStreaming: false,
      streamingComplete: true,
    });
  },
});
