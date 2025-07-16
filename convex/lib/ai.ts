// import { api } from "../_generated/api";

// type Message = (typeof api.messages.getMessages._returnType)[number];
// type Thread = NonNullable<typeof api.threads.getThread._returnType>["thread"];

// type StreamingConfig = {
//   apiKey: string;
//   model: string;
//   maxTokens: number;
//   temperature: number;
//   systemPrompt: string;
// };

// type AiMessage = {
//   role: "user" | "assistant";
//   content: string;
// }[];

// type AIProvider = {
//   name: string;
//   buildRequest: (messages: AiMessage[], config: StreamingConfig) => RequestInit;
//   parseStreamChunk: (line: string) => { content?: string; done?: boolean };
//   endpoint: string;
// };

// const anthropicProvider: AIProvider = {
//   name: "anthropic",
//   endpoint: "https://api.anthropic.com/v1/messages",
//   buildRequest: (messages, config) => ({
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       "x-api-key": config.apiKey,
//       "anthropic-version": "2023-06-01",
//     },
//     body: JSON.stringify({
//       model: config.model,
//       max_tokens: config.maxTokens,
//       temperature: config.temperature,
//       system: config.systemPrompt,
//       messages,
//       stream: true,
//     }),
//   }),

//   parseStreamChunk: (line) => {
//     if (!line.startsWith("data: ")) return {};

//     const data = line.slice(6);
//     if (data === "[DONE]") return { done: true };

//     try {
//       const parsed = JSON.parse(data);
//       if (parsed.type === "content_block_delta" && parsed.delta?.text) {
//         return { content: parsed.delta.text };
//       }
//     } catch {
//       // Invalid JSON, skip
//     }

//     return {};
//   },
// };

// const openaiProvider: AIProvider = {
//   name: "openai",
//   endpoint: "https://api.openai.com/v1/chat/completions",
//   buildRequest: (messages, config) => ({
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${config.apiKey}`,
//     },
//     body: JSON.stringify({
//       model: config.model,
//       max_tokens: config.maxTokens,
//       temperature: config.temperature,
//       messages: [{ role: "system", content: config.systemPrompt }, ...messages],
//       stream: true,
//     }),
//   }),

//   parseStreamChunk: (line) => {
//     if (!line.startsWith("data: ")) return {};

//     const data = line.slice(6);
//     if (data === "[DONE]") return { done: true };

//     try {
//       const parsed = JSON.parse(data);
//       if (parsed.choices?.[0]?.delta?.content) {
//         return { content: parsed.choices[0].delta.content };
//       }
//     } catch {
//       // Invalid JSON, skip
//     }

//     return {};
//   },
// };

// export const LEGAL_ASSISTANT_PROMPT = `You are an expert legal AI assistant designed to help lawyers draft professional email responses. Your role is to analyze incoming emails and create thoughtful, legally sound responses while maintaining the highest standards of legal practice.

// # Core Capabilities and Responsibilities:

// ## 1. Email Analysis
// - Identify the key legal issues, questions, or requests in the email
// - Recognize the type of legal matter (litigation, transactional, advisory, etc.)
// - Assess urgency and priority level
// - Identify all parties involved and their relationships
// - Note any deadlines, dates, or time-sensitive matters

// ## 2. Professional Communication Standards
// - Maintain a professional, courteous tone appropriate for legal correspondence
// - Use clear, precise language avoiding unnecessary legalese
// - Structure responses logically with proper paragraphs and formatting
// - Ensure grammar and spelling are impeccable
// - Adapt tone based on recipient (client, opposing counsel, court, colleague)

// ## 3. Legal Accuracy and Ethics
// - Never provide definitive legal advice without appropriate disclaimers
// - Flag areas requiring attorney review or additional research
// - Maintain attorney-client privilege considerations
// - Identify potential conflicts of interest
// - Suggest when matters should be escalated to senior counsel
// - Always err on the side of caution with legal conclusions

// ## 4. Response Drafting Guidelines
// - Begin with appropriate salutation and reference to their communication
// - Acknowledge receipt and thank them for their message when appropriate
// - Address each point raised systematically
// - Provide clear action items and next steps
// - Include relevant timelines and deadlines
// - End with professional closing and clear contact information
// - Suggest any necessary disclaimers or confidentiality notices

// ## 5. Special Considerations
// - For litigation matters: Be mindful of admissions, maintain strategic positioning
// - For transactional matters: Focus on deal progression and commercial reasonableness
// - For client communications: Balance legal accuracy with accessibility
// - For opposing counsel: Maintain professional boundaries while advocating firmly
// - For internal communications: Be candid while maintaining professionalism

// ## 6. Risk Management
// - Identify issues requiring malpractice insurance considerations
// - Flag statute of limitations concerns
// - Note any potential ethical violations
// - Highlight areas where written confirmation is advisable
// - Suggest when phone calls might be preferable to written communication

// ## 7. Practical Features
// - When relevant, suggest template language for common scenarios
// - Provide alternative phrasings for sensitive topics
// - Include placeholders [IN BRACKETS] for information requiring attorney input
// - Highlight sections requiring particular attorney review with **[ATTORNEY REVIEW NEEDED]**

// Remember: You are a tool to enhance legal practice efficiency, not replace attorney judgment. Always encourage appropriate human review of substantive legal matters.`;

// export const formatMessagesForAI = (
//   messages: Message[],
//   thread: Thread,
//   mostRecentMessage: Message
// ) => {
//   const formattedMessages = [];

//   // Add previous messages as context
//   if (messages && messages.length > 1) {
//     const previousMessages = messages
//       .slice(0, -1)
//       .filter((msg) => msg.content?.trim() !== "")
//       .map((msg) => {
//         let content = msg.content || "";

//         // Add attachment information if present
//         if (msg.attachments && msg.attachments.length > 0) {
//           content += "\n\n[Attachments:";
//           msg.attachments.forEach((att) => {
//             content += `\n- ${att.name} (${att.contentType}, ${(
//               att.size / 1024
//             ).toFixed(2)} KB)`;
//             if (att.parsedContent) {
//               content += `\n  Content:\n${att.parsedContent}`;
//             }
//           });
//           content += "]";
//         }

//         return {
//           role: msg.role === "user" ? "user" : "assistant",
//           content,
//         };
//       });
//     formattedMessages.push(...previousMessages);
//   }

//   // Format the most recent message
//   if (mostRecentMessage) {
//     let emailContent = `Based on the conversation history above, please draft an appropriate response to this most recent email:
// ---
// From: ${
//       thread?.fromParticipants.name ||
//       thread?.fromParticipants.email ||
//       "[Sender]"
//     }
// Subject: ${thread?.subject || "[No Subject]"}
// Date: ${new Date(mostRecentMessage._creationTime).toLocaleString() || "[Date]"}

// Email Content:
// ${mostRecentMessage.content}`;

//     // Add attachment information
//     if (
//       mostRecentMessage.attachments &&
//       mostRecentMessage.attachments.length > 0
//     ) {
//       emailContent += "\n\nAttachments in this email:";
//       mostRecentMessage.attachments.forEach((att) => {
//         emailContent += `\n- ${att.name} (${att.contentType}, ${(
//           att.size / 1024
//         ).toFixed(2)} KB)`;
//         if (att.parsedContent) {
//           emailContent += `\n  Full Content:\n${att.parsedContent}`;
//         }
//       });
//     }

//     emailContent += `
// ---

// Please draft a response that:
// 1. Matches the appropriate tone based on the sender and context:
//   - For clients: Professional and clear, avoiding unnecessary legal jargon
//   - For colleagues: Natural and conversational while remaining professional
//   - For opposing counsel: Formal and precise
//   - For internal team: Friendly but efficient
// 2. Directly addresses all points in the above email
// 3. Considers the full conversation history for context
// 4. Maintains consistency with previous responses in this thread
// 5. Follows legal communication best practices where appropriate

// IMPORTANT: Format your response as follows:
// - First, provide any analysis or context about the email (if needed)
// - Then, place the actual email response inside a code block using triple backticks:

// \`\`\`email
// [Your email response here]
// \`\`\`

// The code block should contain ONLY the email text that the user would copy and send, without any meta-commentary.

// Note: If this appears to be a quick internal exchange, keep the response concise and conversational rather than overly formal.`;

//     formattedMessages.push({
//       role: "user",
//       content: emailContent,
//     });
//   }

//   return formattedMessages;
// };

// // ===== Core Streaming Function =====
// export const streamAIResponse = async (
//   provider: AIProvider,
//   config: StreamingConfig,
//   messages: AiMessage[],
//   onChunk: (content: string, index: number) => Promise<void>,
//   onComplete: (fullContent: string) => Promise<void>,
//   onError: (error: Error) => Promise<void>
// ) => {
//   let fullContent = "";
//   let chunkIndex = 0;

//   try {
//     const response = await fetch(
//       provider.endpoint,
//       provider.buildRequest(messages, config)
//     );

//     if (!response.ok) {
//       const errorBody = await response.text();
//       throw new Error(
//         `${provider.name} API error: ${response.status} ${response.statusText} - ${errorBody}`
//       );
//     }

//     const reader = response.body?.getReader();
//     if (!reader) {
//       throw new Error("No response body reader available");
//     }

//     const decoder = new TextDecoder();

//     try {
//       while (true) {
//         const { done, value } = await reader.read();
//         if (done) break;

//         const chunk = decoder.decode(value);
//         const lines = chunk.split("\n");

//         for (const line of lines) {
//           const parsed = provider.parseStreamChunk(line);

//           if (parsed.done) continue;

//           if (parsed.content) {
//             fullContent += parsed.content;
//             await onChunk(parsed.content, chunkIndex);
//             chunkIndex++;
//           }
//         }
//       }
//     } finally {
//       reader.releaseLock();
//     }

//     await onComplete(
//       fullContent || "I apologize, but I couldn't generate a response."
//     );
//   } catch (error) {
//     await onError(error as Error);
//   }
// };

// // ===== Main Refactored Function =====
// export const generateStreamingResponse = internalAction({
//   args: {
//     threadId: v.id("threads"),
//     responseMessageId: v.id("messages"),
//     provider: v.optional(v.string()), // 'anthropic' or 'openai'
//   },
//   handler: async (ctx, args) => {
//     // Get conversation history
//     const messages = await ctx.runQuery(internal.messages.getThreadHistory, {
//       threadId: args.threadId,
//     });

//     const thread = await ctx.runQuery(internal.threads.get, {
//       threadId: args.threadId,
//     });

//     // Select provider
//     const providerName = args.provider || "anthropic";
//     const provider =
//       providerName === "openai" ? openaiProvider : anthropicProvider;

//     // Get API key based on provider
//     const apiKey =
//       providerName === "openai"
//         ? process.env.CONVEX_OPENAI_API_KEY
//         : process.env.CONVEX_ANTHROPIC_API_KEY;

//     if (!apiKey) {
//       throw new Error(
//         `${providerName.toUpperCase()}_API_KEY environment variable is not set`
//       );
//     }

//     // Configure the AI provider
//     const config: StreamingConfig = {
//       apiKey,
//       model:
//         providerName === "openai" ? "gpt-4-turbo" : "claude-opus-4-20250514",
//       maxTokens: 30000,
//       temperature: 0.2,
//       systemPrompt: LEGAL_ASSISTANT_PROMPT,
//     };

//     // Format messages
//     const mostRecentMessage =
//       messages && messages.length > 0 ? messages[messages.length - 1] : null;
//     const formattedMessages = formatMessagesForAI(
//       messages,
//       thread,
//       mostRecentMessage
//     );

//     // Stream the response
//     await streamAIResponse(
//       provider,
//       config,
//       formattedMessages,
//       // onChunk
//       async (content, index) => {
//         await ctx.runMutation(internal.messages.addStreamingChunk, {
//           messageId: args.responseMessageId,
//           chunk: content,
//           chunkIndex: index,
//         });
//       },
//       // onComplete
//       async (fullContent) => {
//         await ctx.runMutation(internal.messages.completeStreaming, {
//           messageId: args.responseMessageId,
//           finalContent: fullContent,
//         });
//       },
//       // onError
//       async (error) => {
//         console.error("Streaming error:", error);
//         await ctx.runMutation(internal.messages.completeStreaming, {
//           messageId: args.responseMessageId,
//           finalContent: `Sorry, I encountered an error while generating the response: ${error.message}`,
//         });
//       }
//     );
//   },
// });
