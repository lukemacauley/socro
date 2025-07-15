import { v } from "convex/values";
import {
  query,
  internalQuery,
  internalMutation,
  internalAction,
  action,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import { verifyThreadOwnership } from "./threads";
import { type Id } from "./_generated/dataModel";

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

    // Get streaming chunks and attachments for messages
    const messagesWithDetails = await Promise.all(
      messages.map(async (message) => {
        // Get attachments for this message
        const attachments = await ctx.db
          .query("messageAttachments")
          .withIndex("by_message_id", (q) => q.eq("messageId", message._id))
          .collect();

        // Get streaming chunks if it's an AI message
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
            attachments,
          };
        }

        return {
          ...message,
          attachments,
        };
      })
    );

    return messagesWithDetails;
  },
});

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
    const userId = await ctx.runQuery(api.auth.loggedInUserId);

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

// Helper mutation to insert user message
export const insertWithResponsePlaceholder = internalMutation({
  args: {
    content: v.string(),
    uploadId: v.optional(v.string()),
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

    const userStyle = await ctx.runQuery(internal.userStyles.get, {
      userId: thread?.userId || messages[0].userId,
    });

    try {
      const apiKey = process.env.CONVEX_ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY environment variable is not set");
      }

      // Build system prompt with user's writing style if available
      let systemPrompt = `You are an expert legal AI assistant designed to help lawyers draft professional email responses. Your role is to analyze incoming emails and create thoughtful, legally sound responses while maintaining the highest standards of legal practice.

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

      if (userStyle) {
        systemPrompt += `\n\n# User's Personal Writing Style\n\nIMPORTANT: The following analysis is based on the user's actual sent emails. You should adapt your responses to match their personal writing style while maintaining legal professionalism:\n\n`;

        systemPrompt += `## Style Profile:\n`;
        systemPrompt += `- Formality Level: ${userStyle.formalityLevel}\n`;
        systemPrompt += `- Typical Greetings: ${userStyle.greetings.join(
          ", "
        )}\n`;
        systemPrompt += `- Typical Closings: ${userStyle.closings.join(
          ", "
        )}\n`;
        systemPrompt += `- Average Sentence Length: ${Math.round(
          userStyle.averageSentenceLength
        )} words\n`;
        systemPrompt += `- Uses Contractions: ${
          userStyle.usesContractions ? "Yes" : "No"
        }\n`;
        systemPrompt += `- Paragraph Style: ${userStyle.paragraphStyle}\n`;
        systemPrompt += `- Communication Style: ${userStyle.directness}, ${userStyle.emotionalTone}\n`;

        if (userStyle.commonPhrases.length > 0) {
          systemPrompt += `\n## Common Phrases to Use:\n`;
          userStyle.commonPhrases.slice(0, 10).forEach((phrase) => {
            systemPrompt += `- "${phrase}"\n`;
          });
        }

        if (userStyle.sentenceStarters.length > 0) {
          systemPrompt += `\n## Typical Sentence Starters:\n`;
          userStyle.sentenceStarters.slice(0, 5).forEach((starter) => {
            systemPrompt += `- "${starter}"\n`;
          });
        }

        if (userStyle.exampleEmails.length > 0) {
          systemPrompt += `\n## Example Emails from User (for tone reference):\n`;
          userStyle.exampleEmails.slice(0, 2).forEach((example, idx) => {
            systemPrompt += `\n### Example ${idx + 1} (${
              example.context || "general"
            }):\n`;
            systemPrompt += `${example.content.slice(0, 300)}...\n`;
          });
        }

        systemPrompt += `\n## Writing Guidelines:\n`;
        systemPrompt += `- Match the user's formality level (${userStyle.formalityLevel})\n`;
        systemPrompt += `- Use their preferred greetings and closings\n`;
        systemPrompt += `- Maintain their sentence structure and length patterns\n`;
        systemPrompt += `- ${
          userStyle.usesContractions
            ? "Use contractions naturally"
            : "Avoid contractions for formality"
        }\n`;
        systemPrompt += `- Write in ${userStyle.paragraphStyle} paragraphs\n`;
        systemPrompt += `- Be ${userStyle.directness} in communication\n`;
        systemPrompt += `- Maintain a ${userStyle.emotionalTone} tone\n\n`;

        systemPrompt += `Remember: While matching the user's style, always maintain appropriate legal professionalism and accuracy.`;
      }

      // Build the conversation with proper Anthropic format
      const anthropicMessages = [];

      // First, add all previous messages as context (excluding the most recent)
      if (messages && messages.length > 1) {
        const previousMessages = messages
          .slice(0, -1)
          .filter((msg) => msg.content?.trim() !== "")
          .map((msg) => {
            let content = msg.content || "";

            // Add attachment information if present
            if (msg.attachments && msg.attachments.length > 0) {
              content += "\n\n[Attachments:";
              msg.attachments.forEach((att) => {
                content += `\n- ${att.name} (${att.contentType}, ${(
                  att.size / 1024
                ).toFixed(2)} KB)`;
                if (att.parsedContent) {
                  content += `\n  Content:\n${att.parsedContent}`;
                }
              });
              content += "]";
            }

            return {
              role: msg.role === "user" ? "user" : "assistant",
              content,
            };
          });
        anthropicMessages.push(...previousMessages);
      }

      // Get the most recent message that needs a response
      const mostRecentMessage =
        messages && messages.length > 0 ? messages[messages.length - 1] : null;

      // Format the request for response to the most recent message
      if (mostRecentMessage) {
        let emailContent = `Based on the conversation history above, please draft an appropriate response to this most recent email:
            ---
            From: ${
              thread?.fromParticipants.name ||
              thread?.fromParticipants.email ||
              "[Sender]"
            }
            Subject: ${thread?.subject || "[No Subject]"}
            Date: ${
              new Date(mostRecentMessage._creationTime).toLocaleString() ||
              "[Date]"
            }

            Email Content:
            ${mostRecentMessage.content}`;

        // Add attachment information for the most recent message
        if (
          mostRecentMessage.attachments &&
          mostRecentMessage.attachments.length > 0
        ) {
          emailContent += "\n\nAttachments in this email:";
          mostRecentMessage.attachments.forEach((att) => {
            emailContent += `\n- ${att.name} (${att.contentType}, ${(
              att.size / 1024
            ).toFixed(2)} KB)`;
            if (att.parsedContent) {
              emailContent += `\n  Full Content:\n${att.parsedContent}`;
            }
          });
        }

        emailContent += `
            ---

            Please draft a response that:
            1. Matches the appropriate tone based on the sender and context:
              - For clients: Professional and clear, avoiding unnecessary legal jargon
              - For colleagues: Natural and conversational while remaining professional
              - For opposing counsel: Formal and precise
              - For internal team: Friendly but efficient
            2. Directly addresses all points in the above email
            3. Considers the full conversation history for context
            4. Maintains consistency with previous responses in this thread
            5. Follows legal communication best practices where appropriate

            IMPORTANT: Format your response as follows:
            - First, provide any analysis or context about the email (if needed)
            - Then, place the actual email response inside a code block using triple backticks:
            
            \`\`\`email
            [Your email response here]
            \`\`\`
            
            The code block should contain ONLY the email text that the user would copy and send, without any meta-commentary.

            Note: If this appears to be a quick internal exchange, keep the response concise and conversational rather than overly formal.`;

        anthropicMessages.push({
          role: "user",
          content: emailContent,
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
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .filter((q) => q.neq(q.field("isStreaming"), true))
      .order("asc")
      .collect();

    // Get attachments for each message
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
