import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import { verifyThreadOwnership } from "./lib/utils";
import type { Id } from "./_generated/dataModel";

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

export const sendMessage = mutation({
  args: {
    content: v.string(),
    threadId: v.id("threads"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    userMessageId: Id<"messages">;
    responseMessageId: Id<"messages">;
  }> => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);
    await verifyThreadOwnership(ctx, args.threadId, userId);

    // Insert user message
    const userMessageId = await ctx.db.insert("messages", {
      content: args.content,
      role: "user",
      userId,
      threadId: args.threadId,
      messageType: "user_message",
    });

    // Create placeholder assistant message
    const responseMessageId = await ctx.db.insert("messages", {
      content: "",
      role: "ai",
      userId,
      threadId: args.threadId,
      isStreaming: true,
      streamingComplete: false,
      messageType: "ai_response",
    });

    // Schedule AI response generation
    await ctx.scheduler.runAfter(
      0,
      internal.messages.generateStreamingResponse,
      {
        threadId: args.threadId,
        responseMessageId,
      }
    );

    return { userMessageId, responseMessageId };
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

    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY environment variable is not set");
      }

      // Format messages for Anthropic API
      const anthropicMessages = messages
        .filter((msg: any) => msg.content.trim() !== "")
        .map((msg: any) => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 50_000,
          messages: anthropicMessages,
          stream: true,
        }),
      });

      if (!response.ok) {
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
