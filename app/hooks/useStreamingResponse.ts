import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";

export function useStreamingResponse() {
  const updateStreamingResponse = useMutation(api.ai.updateStreamingResponse);

  const streamResponse = async (
    url: string,
    body: any,
    aiResponseId?: string
  ) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let accumulatedContent = "";
    let buffer = "";

    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Parse the AI SDK data stream format
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('0:"')) {
          // Text content chunk
          const match = line.match(/^0:"(.*)"/);
          if (match) {
            const textChunk = match[1]
              .replace(/\\n/g, "\n")
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, "\\");
            accumulatedContent += textChunk;

            // Update the message in the database
            if (aiResponseId) {
              await updateStreamingResponse({
                messageId: aiResponseId,
                content: accumulatedContent,
              });
            }
          }
        }
        // Ignore other message types (f:, e:, d:) for now
      }
    }
  };

  return { streamResponse };
}
