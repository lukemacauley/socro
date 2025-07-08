import { Agent, vStreamArgs } from "@convex-dev/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { api, components, internal } from "./_generated/api";
import {
  action,
  ActionCtx,
  internalAction,
  internalMutation,
  mutation,
  MutationCtx,
  query,
  QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const emailAgent = new Agent(components.agent, {
  chat: anthropic("claude-4-sonnet-20250514"),
  instructions: `You are an AI assistant that helps process and act on email requests and documents.

Your primary role is to:
1. **Identify and execute tasks** mentioned in emails (e.g., "summarize this document", "check if clause 12 is correct", "review these terms")
2. **Analyze documents and attachments** when requested
3. **Answer specific questions** about the content
4. **Perform requested actions** like comparisons, validations, or extractions

Important guidelines:
- Look for action items or requests in the email content
- If an email asks you to check, review, summarize, or analyze something, do it
- When documents are attached, use them to complete the requested tasks
- Be proactive in identifying what needs to be done
- Provide direct, actionable responses
- Remember the context from previous messages in the thread

Do NOT just summarize emails - actively complete the tasks mentioned in them.`,
});

// Streaming, where generate the prompt message first, then asynchronously
// generate the stream response.
export const streamAsynchronously = mutation({
  args: { prompt: v.string(), threadId: v.string() },
  handler: async (ctx, { prompt, threadId }) => {
    await authorizeThreadAccess(ctx, threadId);
    const { messageId } = await emailAgent.saveMessage(ctx, {
      threadId,
      prompt,
      message: "s",
      // we're in a mutation, so skip embeddings for now. They'll be generated
      // lazily when streaming text.
      skipEmbeddings: true,
    });
    await ctx.scheduler.runAfter(0, internal.agent.stream, {
      threadId,
      promptMessageId: messageId,
    });
  },
});

export const stream = internalAction({
  args: { promptMessageId: v.string(), threadId: v.string() },
  handler: async (ctx, { promptMessageId, threadId }) => {
    const { thread } = await emailAgent.continueThread(ctx, { threadId });
    const result = await thread.streamText(
      { promptMessageId },
      { saveStreamDeltas: true }
    );
    await result.consumeStream();
  },
});

/**
 * Query & subscribe to messages & threads
 */

export const listThreadMessages = query({
  args: {
    // These arguments are required:
    threadId: v.string(),
    paginationOpts: paginationOptsValidator, // Used to paginate the messages.
    streamArgs: vStreamArgs, // Used to stream messages.
  },
  handler: async (ctx, args) => {
    const { threadId, paginationOpts, streamArgs } = args;
    await authorizeThreadAccess(ctx, threadId);
    const streams = await emailAgent.syncStreams(ctx, { threadId, streamArgs });
    // Here you could filter out / modify the stream of deltas / filter out
    // deltas.

    const paginated = await emailAgent.listMessages(ctx, {
      threadId,
      paginationOpts,
    });
    // Here you could filter out metadata that you don't want from any optional
    // fields on the messages.
    // You can also join data onto the messages. They need only extend the
    // MessageDoc type.
    // { ...messages, page: messages.page.map(...)}

    return {
      ...paginated,
      streams,

      // ... you can return other metadata here too.
      // note: this function will be called with various permutations of delta
      // and message args, so returning derived data .
    };
  },
});

export const createThread = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const { threadId } = await emailAgent.createThread(ctx, { userId });
    await emailAgent.saveMessage(ctx, {
      threadId,
      message: {
        role: "assistant",
        content: "What would you like to talk about?",
      },
    });
    return threadId;
  },
});

/**
 * ==============================
 * Functions for demo purposes.
 * In a real app, you'd use real authentication & authorization.
 * ==============================
 */

async function getUserId(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<string> {
  const userId = await ctx.runQuery(api.auth.loggedInUserId);
  return userId as string;
}

async function authorizeThreadAccess(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  threadId: string
) {
  const userId = await getUserId(ctx);
  const thread = await emailAgent.getThreadMetadata(ctx, { threadId });
  if (thread.userId !== userId) {
    throw new Error(
      `Unauthorized access to thread ${threadId}. User ${userId} does not own this thread.`
    );
  }
}

/**
 * ==============================
 * Other ways of doing things:
 * ==============================
 */

// Expose an internal action that streams text, to avoid the boilerplate of
// stream above.
export const streamInternalAction = emailAgent.asTextAction({
  stream: true,
  // stream: { chunking: "word", throttleMs: 200 },
});

// This fetches full messages. Streamed messages are not included.
export const listRecentMessages = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    await authorizeThreadAccess(ctx, threadId);
    const { page: messages } = await emailAgent.listMessages(ctx, {
      threadId,
      paginationOpts: {
        cursor: null,
        numItems: 10,
      },
    });
    // Return them in ascending order (oldest first)
    return messages.reverse();
  },
});

// This fetches only streaming messages.
export const listStreamingMessages = query({
  args: { threadId: v.string(), streamArgs: vStreamArgs },
  handler: async (ctx, { threadId, streamArgs }) => {
    await authorizeThreadAccess(ctx, threadId);
    const streams = await emailAgent.syncStreams(ctx, { threadId, streamArgs });
    return { streams };
  },
});

// Streaming, but the action doesn't return until the streaming is done.
export const streamSynchronously = action({
  args: { prompt: v.string(), threadId: v.string() },
  handler: async (ctx, { prompt, threadId }) => {
    await authorizeThreadAccess(ctx, threadId);
    const { thread } = await emailAgent.continueThread(ctx, { threadId });
    const result = await thread.streamText(
      { prompt },
      { saveStreamDeltas: { chunking: "line", throttleMs: 1000 } }
    );
    for await (const chunk of result.textStream) {
      console.log(chunk);
    }
    return result.text;
  },
});

// Not streaming, just used for comparison
export const generateWithoutStreaming = action({
  args: { prompt: v.string(), threadId: v.string() },
  handler: async (ctx, { prompt, threadId }) => {
    await authorizeThreadAccess(ctx, threadId);
    const { thread } = await emailAgent.continueThread(ctx, { threadId });
    const result = await thread.generateText({ prompt });
    return result.text;
  },
});

export const listThreads = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const threads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      { userId, paginationOpts: args.paginationOpts }
    );
    return threads;
  },
});

/**
 * ==============================
 * Webhook Integration Functions
 * ==============================
 */

// Create thread for an email conversation (webhook)
export const createEmailThread = internalMutation({
  args: {
    userId: v.id("users"),
    emailSubject: v.string(),
    emailId: v.string(),
  },
  handler: async (ctx, args) => {
    const { threadId } = await emailAgent.createThread(ctx, {
      userId: args.userId,
      title: args.emailSubject,
    });

    return threadId;
  },
});

// Process an email through the agent (webhook)
export const processEmailWithAgent = internalAction({
  args: {
    threadId: v.string(),
    emailContent: v.string(),
    emailSubject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    attachmentContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { thread } = await emailAgent.continueThread(ctx, {
      threadId: args.threadId,
    });

    // Build the prompt that presents the email and any attachments
    let prompt = `Email from ${
      args.senderName || args.senderEmail
    } with subject "${args.emailSubject}":\n\n${args.emailContent}`;

    if (args.attachmentContent) {
      prompt += `\n\n=== ATTACHED DOCUMENT ===\n${args.attachmentContent}\n=== END OF DOCUMENT ===`;
    }

    prompt +=
      "\n\nPlease identify and complete any tasks or requests mentioned in this email. If the email asks you to analyze, check, summarize, or review something (especially any attached documents), please do so now.";

    // Generate the response
    const result = await thread.generateText({ prompt });

    return result.text;
  },
});

// Process a user note through the agent
export const processUserNoteWithAgent = internalAction({
  args: {
    threadId: v.string(),
    userNote: v.string(),
  },
  handler: async (ctx, args) => {
    const { thread } = await emailAgent.continueThread(ctx, {
      threadId: args.threadId,
    });

    // User notes are direct requests/questions
    const prompt = args.userNote;

    // Generate the response
    const result = await thread.generateText({ prompt });

    return result.text;
  },
});
