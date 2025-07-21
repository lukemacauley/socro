import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Groq } from "groq-sdk";
import type { Id } from "./_generated/dataModel";
import { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions.mjs";

export const streamMessage = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const messageId = url.searchParams.get("messageId");
  const threadId = url.searchParams.get("threadId");

  if (!messageId || !threadId) {
    return new Response("Missing parameters", { status: 400 });
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      const messages = await ctx.runQuery(internal.messages.getThreadHistory, {
        threadId: threadId as Id<"threads">,
      });

      const groq = new Groq();

      const systemPrompt = `You are an expert legal AI assistant specializing in drafting professional email responses for lawyers. Your goal is to analyze incoming emails and create legally sound, contextually appropriate responses.`;

      const validMessages = messages.filter(
        (msg) => msg.role !== "system" && msg.content?.trim()
      );

      const formattedMessages: ChatCompletionMessageParam[] = [
        { role: "system" as const, content: systemPrompt },
        ...validMessages.map((msg) => ({
          role:
            msg.role === "user" ? ("user" as const) : ("assistant" as const),
          content: msg.content || "",
        })),
      ];

      let fullContent = "";
      let chunkIndex = 0;

      const response = await groq.chat.completions.create({
        messages: formattedMessages,
        model: "moonshotai/kimi-k2-instruct",
        stream: true,
      });

      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullContent += content;

          try {
            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "chunk",
                  content,
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
        messageId: messageId as Id<"messages">,
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
        messageId: messageId as Id<"messages">,
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
