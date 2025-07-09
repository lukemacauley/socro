import { type GenericActionCtx, httpRouter } from "convex/server";
import type { WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { type Id } from "./_generated/dataModel";
import { streamingComponent } from "./streaming";

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

export const streamAiResponse = httpAction(async (ctx, request) => {
  const body = (await request.json()) as {
    streamId: string;
    conversationId: string;
    emailContent: string;
    emailSubject: string;
    senderName?: string;
  };

  const generateAiResponse = async (
    ctx: GenericActionCtx<any>,
    request: Request,
    streamId: any,
    chunkAppender: (text: string) => Promise<void>
  ) => {
    // Get conversation context
    const data = await ctx.runQuery(internal.ai.getConversationContext, {
      conversationId: body.conversationId as Id<"conversations">,
    });

    if (!data) {
      throw new Error("Conversation not found");
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
- Subject: ${body.emailSubject}
- Latest sender: ${body.senderName || "Unknown sender"}
- Thread has ${messages.length} messages

Your approach:
- For emails from others: Summarize key points, identify action items, analyze documents
- For user questions: Answer directly and helpfully, referencing the context and documents
- Be conversational when the user addresses you
- Provide detailed analysis when asked about specific topics
- Remember previous messages in the thread to maintain context

Always be helpful and responsive to the user's needs.`;

    const isUserNote = body.senderName === "User";
    const userMessage = isUserNote
      ? `${attachmentContext}${threadContext}\n\nThe user is asking you directly: "${body.emailContent}"\n\nPlease respond conversationally and helpfully to their question.`
      : threadContext
      ? `${attachmentContext}${threadContext}\n\nLatest email in the thread:\n${body.emailContent}\n\nProvide a brief observation or note about this email.`
      : `${attachmentContext}\n\nEmail content: ${body.emailContent}\n\nProvide a brief observation or note about this email.`;

    // Generate streaming response
    const result = await streamText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      system: systemPrompt,
      prompt: userMessage,
    });

    // Stream the text using chunkAppender
    for await (const chunk of result.textStream) {
      await chunkAppender(chunk);
    }
  };

  const response = await streamingComponent.stream(
    ctx,
    request,
    body.streamId as any,
    generateAiResponse
  );

  // Set CORS headers appropriately.
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Vary", "Origin");
  return response;
});

http.route({
  path: "/stream-ai-response",
  method: "POST",
  handler: streamAiResponse,
});

export default http;
