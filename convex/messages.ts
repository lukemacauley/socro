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
      type: "user_message",
    });

    if (args.uploadId) {
      const attachments = await ctx.db
        .query("messageAttachments")
        .withIndex("by_upload_id", (q) => q.eq("uploadId", args.uploadId))
        .collect();

      for (const attachment of attachments) {
        await ctx.db.patch(attachment._id, {
          messageId: userMessageId,
          threadId: args.threadId,
        });
      }
    }

    const responseMessageId = await ctx.db.insert("messages", {
      content: "",
      role: "ai",
      userId: args.userId,
      threadId: args.threadId,
      isStreaming: true,
      streamingComplete: false,
      type: "ai_response",
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
    // The actual streaming happens via the HTTP endpoint
    // This action now just serves as a trigger
    // The client will connect to the SSE endpoint to receive the stream
    console.log(
      "Streaming will happen via HTTP endpoint for message:",
      args.responseMessageId
    );
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
      type: "chat",
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

function formatMessageWithAttachments(message: Message): string {
  let content = message.content!.trim();

  // Add attachment information if available
  if (message.attachments && message.attachments.length > 0) {
    content += "\n\n[Attachments in this message:";
    message.attachments.forEach((att) => {
      if (att.parsedContent) {
        content += `\n  Content:\n${att.parsedContent}`;
      }
    });
    content += "]";
  }

  return content;
}

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
        content: formatMessageWithAttachments(msg),
      }))
    );
  }

  const mostRecentMessage = validMessages[validMessages.length - 1];
  formattedMessages.push({
    role: "user" as const,
    content: formatEmailDraftRequest(
      formatMessageWithAttachments(mostRecentMessage)
    ),
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

    // Reset message state
    await ctx.db.patch(args.messageId, {
      content: "",
      isStreaming: true,
      streamingComplete: false,
    });

    return message;
  },
});
