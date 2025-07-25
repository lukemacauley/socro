import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ModelMessage, streamText } from "ai";
import { groq } from "@ai-sdk/groq";
import { anthropic } from "@ai-sdk/anthropic";
import { PIAB_SYSTEM_PROMPT_ANTHROPIC } from "../app/lib/constants";

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

      const systemPrompt = `You are an expert legal AI assistant specializing in drafting professional email responses for lawyers. Your goal is to analyze incoming emails and create legally sound, contextually appropriate responses.`;

      const validMessages = messages.filter(
        (msg) => msg.role !== "system" && msg.content?.trim()
      );

      const formattedMessages: ModelMessage[] = [
        ...validMessages.map((msg) => ({
          role:
            msg.role === "user" ? ("user" as const) : ("assistant" as const),
          content: formatMessageWithAttachments(msg),
        })),
      ];

      let fullContent = "";
      let chunkIndex = 0;

      const result = streamText({
        // model: anthropic("claude-opus-4-20250514"),
        model: groq("moonshotai/kimi-k2-instruct"),
        system: PIAB_SYSTEM_PROMPT_ANTHROPIC, //systemPrompt,
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
