import { httpRouter } from "convex/server";
import type { WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";
import { streamingComponent } from "./streaming";
import { type StreamId } from "@convex-dev/persistent-text-streaming";

const anthropic = new Anthropic();

const http = httpRouter();

http.route({
  path: "/webhook/microsoft",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    console.log("[WEBHOOK HTTP] Received webhook request");
    console.log("[WEBHOOK HTTP] Request URL:", request.url);
    console.log("[WEBHOOK HTTP] Request method:", request.method);

    try {
      // Verify webhook validation token if present
      const validationToken = new URL(request.url).searchParams.get(
        "validationToken"
      );
      if (validationToken) {
        console.log(
          "[WEBHOOK HTTP] Validation request received, token:",
          validationToken
        );
        return new Response(validationToken, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }

      const body = await request.json();
      console.log(
        "[WEBHOOK HTTP] Webhook body:",
        JSON.stringify(body, null, 2)
      );

      // Process webhook notifications
      if (body.value && Array.isArray(body.value)) {
        console.log(
          `[WEBHOOK HTTP] Processing ${body.value.length} notifications`
        );

        for (const notification of body.value) {
          console.log(`[WEBHOOK HTTP] Notification:`, {
            changeType: notification.changeType,
            resource: notification.resource,
            subscriptionId: notification.subscriptionId,
            hasResourceData: !!notification.resourceData,
          });

          if (notification.changeType === "created") {
            console.log("[WEBHOOK HTTP] Processing new email notification");
            // Process new email
            await ctx.runMutation(internal.webhooks.processEmailNotification, {
              notification,
            });
          } else {
            console.log(
              `[WEBHOOK HTTP] Ignoring notification with changeType: ${notification.changeType}`
            );
          }
        }
      } else {
        console.log("[WEBHOOK HTTP] No notifications in webhook body");
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("[WEBHOOK HTTP] Error processing webhook:", error);
      return new Response("Error processing webhook", { status: 500 });
    }
  }),
});

// Clerk webhook endpoint
http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await validateRequest(request);
    if (!event) {
      return new Response("Error occured", { status: 400 });
    }
    switch (event.type) {
      case "user.created": // intentional fallthrough
      case "user.updated":
        await ctx.runMutation(internal.users.upsertFromClerk, {
          data: event.data,
        });

        console.log({ data: event.data });

        // Check if user has Microsoft OAuth and set up webhook
        console.log("[CLERK WEBHOOK] Checking for Microsoft OAuth...");
        const hasMicrosoftOAuth = event.data.external_accounts?.some(
          (account) => account.provider === "oauth_microsoft"
        );

        if (hasMicrosoftOAuth) {
          console.log(
            "[CLERK WEBHOOK] User has Microsoft OAuth, setting up email webhook..."
          );
          // Schedule the Microsoft webhook setup as a separate action
          await ctx.scheduler.runAfter(
            0,
            internal.webhooks.setupMicrosoftWebhook,
            {
              clerkUserId: event.data.id,
            }
          );
        }
        break;

      case "user.deleted": {
        const clerkUserId = event.data.id!;
        await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId });
        console.log("[CLERK WEBHOOK] User deleted", clerkUserId);
        break;
      }
      default:
        console.log("Ignored Clerk webhook event", event.type);
    }

    return new Response(null, { status: 200 });
  }),
});

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
  const payloadString = await req.text();
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id")!,
    "svix-timestamp": req.headers.get("svix-timestamp")!,
    "svix-signature": req.headers.get("svix-signature")!,
  };
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent;
  } catch (error) {
    console.error("Error verifying webhook event", error);
    return null;
  }
}

http.route({
  path: "/stream-messages",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      return new Response(null, {
        headers: new Headers({
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Digest, Authorization",
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response();
    }
  }),
});

// OPTIONS route for CORS preflight
http.route({
  path: "/stream-ai-response",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

http.route({
  path: "/stream-ai-response",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Handle CORS
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight request
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      const body = await request.json();
      console.log("[STREAM] Request body:", JSON.stringify(body, null, 2));

      let conversationId, emailContent, emailSubject, senderName;
      let streamId = body.streamId as StreamId | undefined;

      // Check if this is a streamId-only request from useStream hook
      if (body.streamId && !body.messages) {
        console.log("[STREAM] Handling streamId-only request", {
          streamId: body.streamId,
        });

        // Get message details from streamId
        const messageData = await ctx.runQuery(
          internal.ai.getMessageByStreamId,
          {
            streamId: body.streamId,
          }
        );

        if (!messageData) {
          console.error(
            "[STREAM] Message not found for streamId:",
            body.streamId
          );
          return new Response("Message not found", {
            status: 404,
            headers: corsHeaders,
          });
        }

        console.log("[STREAM] Found message data", {
          streamId: body.streamId,
          conversationId: messageData.conversationId,
          messageType: messageData.message.type,
          senderName: messageData.senderName,
        });

        conversationId = messageData.conversationId;
        emailContent = messageData.emailContent;
        emailSubject = messageData.emailSubject;
        senderName = messageData.senderName;
      } else {
        // Handle messages array format (from useChat or other sources)
        const msgs = body.messages || [];
        const lastMessage = msgs[msgs.length - 1];

        // The data we need is in the last message's data field
        ({ conversationId, emailContent, emailSubject, senderName } =
          lastMessage?.data || {});
      }

      // Get conversation context
      const data = await ctx.runQuery(internal.ai.getConversationContext, {
        conversationId,
      });

      if (!data) {
        return new Response("Conversation not found", {
          status: 404,
          headers: corsHeaders,
        });
      }

      const { messages, processedAttachments } = data;

      // Build attachment context
      let attachmentContext = "";
      if (processedAttachments && processedAttachments.length > 0) {
        attachmentContext = "\n\nAttached Documents:\n";
        for (const attachment of processedAttachments) {
          attachmentContext += `\n--- ${attachment.attachmentName} ---\n${attachment.content}\n`;
        }
      }

      // Build conversation history
      let threadContext = "";
      const previousMessages = messages.filter((m) => m.type !== "user_note");

      if (previousMessages.length > 1) {
        threadContext = "\n\nPrevious messages in this thread:\n";
        for (const msg of previousMessages.slice(0, -1)) {
          const timestamp = new Date(msg.timestamp).toLocaleString();
          if (msg.type === "email") {
            threadContext += `\n[${timestamp}] Email from ${
              msg.sender
            }:\n${msg.content.substring(0, 500)}${
              msg.content.length > 500 ? "..." : ""
            }\n`;
          } else if (msg.type === "ai_response") {
            threadContext += `\n[${timestamp}] Your previous response:\n${msg.content.substring(
              0,
              300
            )}${msg.content.length > 300 ? "..." : ""}\n`;
          }
        }
      }

      // System prompt
      const systemPrompt = `You are an AI assistant helping the user manage and understand their email conversations and documents. You have two distinct modes:

1. **When processing new emails**: Provide brief observations and summaries
2. **When the user asks you questions directly**: Engage conversationally and answer their questions thoroughly

Current conversation details:
- Subject: ${emailSubject}
- Latest sender: ${senderName || "Unknown sender"}
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

      const isUserNote = senderName === "User";

      const userMessage = isUserNote
        ? `${attachmentContext}${threadContext}\n\nThe user is asking you directly: "${emailContent}"\n\nPlease respond conversationally and helpfully to their question.`
        : threadContext
        ? `${attachmentContext}${threadContext}\n\nLatest email in the thread:\n${emailContent}\n\nProvide a brief observation or note about this email.`
        : `${attachmentContext}\n\nEmail content: ${emailContent}\n\nProvide a brief observation or note about this email.`;

      // Use streamText and return proper data stream response
      // const result = streamText({
      //   model: anthropic("claude-3-5-sonnet-20241022"),
      //   system: systemPrompt,
      //   prompt: userMessage,
      //   onFinish: async ({ text }) => {
      //     console.log(
      //       "[STREAM] Finished streaming, total length:",
      //       text.length
      //     );
      //     // Save the complete response to the database
      //     await ctx.runMutation(internal.ai.saveAiResponse, {
      //       conversationId,
      //       content: text,
      //     });
      //   },
      // });

      // Use existing streamId or create a new one
      if (!streamId) {
        streamId = await streamingComponent.createStream(ctx);
        console.log("[STREAM] Created new streamId:", streamId);
      } else {
        console.log("[STREAM] Using existing streamId:", streamId);
      }

      let fullText = "";

      // Start streaming and persisting at the same time while
      // we immediately return a streaming response to the client
      console.log("[STREAM] Starting stream with streamingComponent.stream", {
        streamId,
        conversationId,
        senderName,
      });

      const response = await streamingComponent.stream(
        ctx,
        request,
        streamId,
        async (_, __, ___, append) => {
          console.log("[STREAM] Creating Anthropic stream");
          const stream = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: userMessage,
              },
            ],
            max_tokens: 60_000,
            stream: true,
          });

          console.log(
            "[STREAM] Got Anthropic stream, starting to process chunks"
          );

          // Append each chunk to the persistent stream as they come in from Anthropic
          let chunkCount = 0;
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text || "";
              await append(text);
              fullText += text;
              chunkCount++;
              if (chunkCount % 10 === 0) {
                console.log("[STREAM] Progress", {
                  streamId,
                  chunks: chunkCount,
                  totalLength: fullText.length,
                });
              }
            }
          }
          console.log("[STREAM] Stream complete", {
            streamId,
            totalChunks: chunkCount,
            finalLength: fullText.length,
          });

          // Save the complete response with streamId
          console.log(
            "[STREAM] Finished streaming, saving response to database",
            {
              streamId,
              conversationId,
              contentLength: fullText.length,
            }
          );
          await ctx.runMutation(internal.ai.saveAiResponse, {
            conversationId,
            content: fullText,
            streamId: streamId,
            userId: body.userId, // Pass userId from request
          });
        }
      );

      console.log("[STREAM] Returning streaming response to client", {
        streamId,
        hasResponse: !!response,
      });

      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set("Vary", "Origin");

      return response;
    } catch (error) {
      console.error("Error in stream-ai-response:", error);
      return new Response("Internal server error", {
        status: 500,
        headers: corsHeaders,
      });
    }
  }),
});

export default http;
