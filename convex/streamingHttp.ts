import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ModelMessage, streamText } from "ai";
import { groq } from "@ai-sdk/groq";
import { anthropic } from "@ai-sdk/anthropic";
import { PIAB_SYSTEM_PROMPT_ANTHROPIC } from "../app/lib/constants";
import type { GenericActionCtx } from "convex/server";

type Message = (typeof internal.messages.getThreadHistory._returnType)[number];

async function formatMessageWithAttachments(
  ctx: GenericActionCtx<any>,
  message: Message
): Promise<string> {
  let content = message.content!.trim();

  if (!message.attachments || message.attachments.length === 0) {
    return content;
  }

  content += "\n\n[Attachments in this message:";

  message.attachments.forEach(async (att) => {
    if (!att.parsedContentStorageId) {
      return;
    }

    const blob = await ctx.storage.get(att.parsedContentStorageId);
    if (!blob) {
      throw new Error("Parsed content not found in storage");
    }
    const text = await blob.text();

    content += `\n  Content:\n${text}`;
  });
  content += "]";

  return content;
}

export const streamMessage = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const messageId = url.searchParams.get("messageId") as Id<"messages"> | null;
  const threadId = url.searchParams.get("threadId") as Id<"threads"> | null;

  if (!messageId || !threadId) {
    return new Response("Missing parameters", { status: 400 });
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      const messages = await ctx.runQuery(internal.messages.getThreadHistory, {
        threadId,
      });

      const validMessages = messages.filter((msg) => msg.content?.trim());

      // Get the latest user message
      const latestUserMessage = validMessages
        .filter((msg) => msg.role === "user")
        .pop();
      let enhancedSystemPrompt = PIAB_SYSTEM_PROMPT_ANTHROPIC;

      // Get demo questions for new conversations
      if (latestUserMessage && validMessages.length <= 2) {
        try {
          const { topic, questions } = await ctx.runAction(
            internal.demo.getRelevantQuestions,
            {
              userMessage: latestUserMessage.content || "",
            }
          );

          // Enhance system prompt with ONE deep question
          enhancedSystemPrompt = `${PIAB_SYSTEM_PROMPT_ANTHROPIC}

          IMPORTANT: Start your response with this specific deep, challenging question that cuts to the heart of their legal issue:

          "${questions[0]}"

          After posing this question, wait for their response before providing any further guidance. Your goal is to make them think deeply about the complexities and nuances of their situation through this single, penetrating question.`;
        } catch (error) {
          console.log("Could not get demo questions:", error);
        }
      }

      const formattedMessages: ModelMessage[] = await Promise.all(
        validMessages.map(async (msg) => ({
          role:
            msg.role === "user" ? ("user" as const) : ("assistant" as const),
          content: await formatMessageWithAttachments(ctx, msg),
        }))
      );

      let fullContent = "";
      let chunkIndex = 0;

      const result = streamText({
        // model: anthropic("claude-opus-4-20250514"),
        model: groq("moonshotai/kimi-k2-instruct"),
        system: enhancedSystemPrompt,
        messages: formattedMessages,
      });

      for await (const chunk of result.textStream) {
        if (chunk) {
          fullContent += chunk;

          try {
            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "chunk",
                  content: chunk,
                  chunkIndex,
                  messageId,
                })}\n\n`
              )
            );
          } catch (writeError) {
            console.error(
              `[STREAMING] Error writing chunk ${chunkIndex}:`,
              writeError
            );
            throw writeError;
          }

          chunkIndex++;
        }
      }

      await writer.write(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "complete",
            messageId,
          })}\n\n`
        )
      );

      await ctx.runMutation(internal.messages.completeStreaming, {
        messageId,
        finalContent:
          fullContent || "I apologise, but I couldn't generate a response.",
      });
    } catch (error) {
      await writer.write(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : "Unknown error",
            messageId,
          })}\n\n`
        )
      );

      await ctx.runMutation(internal.messages.completeStreaming, {
        messageId,
        finalContent:
          "Sorry, I encountered an error while generating the response.",
      });
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
