import { v } from "convex/values";
import {
  query,
  internalQuery,
  internalMutation,
  internalAction,
  action,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import { type Id } from "./_generated/dataModel";
import { Groq } from "groq-sdk";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions.mjs";

export const sendMessage = action({
  args: {
    content: v.string(),
    uploadId: v.optional(v.string()),
    threadId: v.id("threads"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    userMessageId: Id<"messages">;
    responseMessageId: Id<"messages">;
  }> => {
    const userId = await ctx.runQuery(internal.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const { userMessageId, responseMessageId } = await ctx.runMutation(
      internal.messages.insertWithResponsePlaceholder,
      {
        threadId: args.threadId,
        content: args.content,
        uploadId: args.uploadId,
        userId,
      }
    );

    await ctx.runAction(internal.messages.generateStreamingResponse, {
      threadId: args.threadId,
      responseMessageId,
    });

    return {
      userMessageId,
      responseMessageId,
    };
  },
});

export const retryMessage = action({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(internal.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get message and verify ownership in one mutation
    const message = await ctx.runMutation(
      internal.messages.resetMessageForRetry,
      {
        messageId: args.messageId,
        userId,
      }
    );

    // Generate new response
    await ctx.runAction(internal.messages.generateStreamingResponse, {
      threadId: message.threadId,
      responseMessageId: args.messageId,
    });

    return { messageId: args.messageId };
  },
});

export const createThreadAndSendMessage = action({
  args: {
    content: v.string(),
    uploadId: v.optional(v.string()),
    threadId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    threadId: Id<"threads">;
    userMessageId: Id<"messages">;
    responseMessageId: Id<"messages">;
  }> => {
    const userId = await ctx.runQuery(internal.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const threadId = await ctx.runMutation(internal.messages.createChatThread, {
      userId,
      threadId: args.threadId,
    });

    const { userMessageId, responseMessageId } = await ctx.runMutation(
      internal.messages.insertWithResponsePlaceholder,
      {
        threadId,
        content: args.content,
        uploadId: args.uploadId,
        userId,
      }
    );

    // Generate title for the new chat thread
    await ctx.scheduler.runAfter(0, internal.messages.generateThreadTitle, {
      threadId,
      content: args.content,
    });

    await ctx.runAction(internal.messages.generateStreamingResponse, {
      threadId,
      responseMessageId,
    });

    return {
      threadId,
      userMessageId,
      responseMessageId,
    };
  },
});

// Helper mutation to insert user message
export const insertWithResponsePlaceholder = internalMutation({
  args: {
    content: v.string(),
    uploadId: v.optional(v.string()),
    threadId: v.id("threads"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
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
    const messages = await ctx.runQuery(internal.messages.getThreadHistory, {
      threadId: args.threadId,
    });

    try {
      const groq = new Groq();
      const msgs = getPromptMessages(messages);

      let fullContent = "";

      const response = await groq.chat.completions.create({
        messages: msgs,
        model: "moonshotai/kimi-k2-instruct",
      });

      for await (const textPart of response.choices) {
        const chunk = textPart.message.content;
        if (!chunk) {
          continue;
        }
        fullContent += chunk;
      }

      await ctx.runMutation(internal.messages.completeStreaming, {
        messageId: args.responseMessageId,
        finalContent:
          fullContent || "I apologise, but I couldn't generate a response.",
      });
    } catch (error) {
      console.error("Error initializing Groq client:", error);

      await ctx.runMutation(internal.messages.completeStreaming, {
        messageId: args.responseMessageId,
        finalContent:
          "Sorry, I encountered an error while generating the response. Please try again in a moment.",
      });
    }
  },
});

export const getThreadHistory = internalQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .filter((q) => q.neq(q.field("isStreaming"), true))
      .order("asc")
      .collect();

    const messagesWithAttachments = await Promise.all(
      messages.map(async (message) => {
        const attachments = await ctx.db
          .query("messageAttachments")
          .withIndex("by_message_id", (q) => q.eq("messageId", message._id))
          .collect();

        return {
          ...message,
          attachments,
        };
      })
    );

    return messagesWithAttachments;
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

export const createChatThread = internalMutation({
  args: {
    userId: v.id("users"),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const threadId = await ctx.db.insert("threads", {
      subject: "New Chat",
      threadId: args.threadId,
      lastActivityAt: Date.now(),
      threadType: "chat",
      opened: true,
      userId: args.userId,
    });

    return threadId;
  },
});

export const generateThreadTitle = internalAction({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const groq = new Groq();

      const response = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: `Generate a short, descriptive title (max 5 words) for a conversation that starts with this message: ${args.content}.
            Requirements:
            - Maximum 5 words
            - Be specific and descriptive
            - No quotes or punctuation
            - Just return the title, nothing else`,
          },
        ],
        model: "moonshotai/kimi-k2-instruct",
        stream: false,
      });

      let fullContent = "";

      for await (const textPart of response.choices) {
        const chunk = textPart.message.content;
        if (!chunk) {
          continue;
        }
        fullContent += chunk;
      }

      const subject = fullContent.trim();

      let contentPreview = args.content.trim();
      if (contentPreview.length > 100) {
        contentPreview = args.content.substring(0, 100);
      }

      await ctx.runMutation(internal.messages.updateThreadTitleAndPreview, {
        threadId: args.threadId,
        subject,
        contentPreview,
      });
    } catch (error) {
      console.error("Failed to generate title:", error);
    }
  },
});

export const updateThreadTitleAndPreview = internalMutation({
  args: {
    threadId: v.id("threads"),
    subject: v.string(),
    contentPreview: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, {
      subject: args.subject,
      contentPreview: args.contentPreview,
    });
  },
});

type Message = (typeof internal.messages.getThreadHistory._returnType)[number];

function getPromptMessages(
  messages: Message[] | undefined | null
): ChatCompletionMessageParam[] {
  if (!messages?.length) {
    return [{ role: "system" as const, content: SYSTEM_PROMPT }];
  }

  const validMessages = messages.filter(
    (msg) => msg.role !== "system" && msg.content?.trim()
  );

  if (!validMessages.length) {
    return [{ role: "system" as const, content: SYSTEM_PROMPT }];
  }

  const formattedMessages: ChatCompletionMessageParam[] = [
    { role: "system" as const, content: SYSTEM_PROMPT },
  ];

  const historyMessages = validMessages.slice(0, -1);
  if (historyMessages.length > 0) {
    formattedMessages.push(
      ...historyMessages.map((msg) => ({
        role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
        content: msg.content!.trim(), // We know content exists from filter
      }))
    );
  }

  const mostRecentMessage = validMessages[validMessages.length - 1];
  formattedMessages.push({
    role: "user" as const,
    content: formatEmailDraftRequest(mostRecentMessage.content!),
  });

  return formattedMessages;
}

// Separate the prompt templates for better maintainability
const SYSTEM_PROMPT = `You are an expert legal AI assistant specializing in drafting professional email responses for lawyers. Your goal is to analyze incoming emails and create legally sound, contextually appropriate responses.`;

const TONE_GUIDELINES = `
- **Clients**: Professional and clear, avoiding unnecessary legal jargon
- **Colleagues**: Natural and conversational while remaining professional
- **Opposing counsel**: Formal and precise
- **Internal team**: Friendly but efficient`;

function formatEmailDraftRequest(emailContent: string): string {
  return `Please draft a response to the following email:

---
${emailContent}
---

**Requirements:**
1. Match the appropriate tone based on sender and context:${TONE_GUIDELINES}
2. Address all points raised in the email
3. Consider the full conversation history for context
4. Maintain consistency with previous responses
5. Follow legal communication best practices

**Output Format:**
- Provide brief analysis or context (if needed)
- Then include the email response in a code block:

\`\`\`email
[Your complete email response here]
\`\`\`

Note: For quick internal exchanges, keep responses concise and conversational.`;
}

export const resetMessageForRetry = internalMutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Only allow retry on AI messages
    if (message.role !== "ai") {
      throw new Error("Can only retry AI messages");
    }

    // Clear streaming chunks
    const chunks = await ctx.db
      .query("streamingChunks")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    // Reset message state
    await ctx.db.patch(args.messageId, {
      content: "",
      isStreaming: true,
      streamingComplete: false,
    });

    return message;
  },
});
