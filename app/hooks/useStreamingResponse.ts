import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

export function useStreamingResponse() {
  const updateStreamingResponse = useMutation(api.ai.updateStreamingResponse);

  const streamResponse = async (
    url: string,
    body: any,
    aiResponseId?: string
  ) => {
    const startTime = performance.now();
    let firstChunkTime: number | null = null;
    let chunkCount = 0;
    let totalChars = 0;
    let updateCount = 0;
    let lastUpdateTime = startTime;
    let lastUpdateContent = "";
    let pendingUpdate = false;
    
    console.log("[PERF] Starting stream request...");
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    
    const fetchTime = performance.now();
    console.log(`[PERF] Initial fetch completed in ${(fetchTime - startTime).toFixed(2)}ms`);

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let accumulatedContent = "";
    let buffer = "";

    if (!reader) return;

    // Set up batched updates - more frequent for smoother streaming
    const UPDATE_INTERVAL = 50; // ms - update every 50ms for smooth streaming
    const UPDATE_CHAR_THRESHOLD = 20; // characters - smaller chunks for smoother appearance
    
    const performUpdate = async () => {
      if (aiResponseId && accumulatedContent !== lastUpdateContent) {
        const updateStartTime = performance.now();
        await updateStreamingResponse({
          messageId: aiResponseId as Id<"messages">,
          content: accumulatedContent,
        });
        const updateTime = performance.now() - updateStartTime;
        updateCount++;
        lastUpdateContent = accumulatedContent;
        
        if (updateCount % 5 === 0) {
          console.log(`[PERF] Batch update #${updateCount}: 
            - DB update time: ${updateTime.toFixed(2)}ms
            - Content length: ${accumulatedContent.length} chars`);
        }
      }
      pendingUpdate = false;
    };

    // Set up periodic updates
    const updateInterval = setInterval(performUpdate, UPDATE_INTERVAL);

    try {
      while (true) {
        const readStartTime = performance.now();
        const { done, value } = await reader.read();
        const readTime = performance.now() - readStartTime;
        
        if (done) {
          clearInterval(updateInterval);
          await performUpdate(); // Final update
          
          const totalTime = performance.now() - startTime;
          console.log(`[PERF] Stream completed:
            - Total time: ${totalTime.toFixed(2)}ms
            - Time to first chunk: ${firstChunkTime ? firstChunkTime.toFixed(2) : 'N/A'}ms
            - Total chunks: ${chunkCount}
            - Total characters: ${totalChars}
            - Characters/second: ${((totalChars / totalTime) * 1000).toFixed(0)}
            - DB updates: ${updateCount} (batched)
            - Avg ms per update: ${(totalTime / updateCount).toFixed(2)}ms`);
          break;
        }

        chunkCount++;
        if (!firstChunkTime) {
          firstChunkTime = performance.now() - startTime;
          console.log(`[PERF] First chunk received in ${firstChunkTime.toFixed(2)}ms`);
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Parse the AI SDK data stream format
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer
        
        let chunkChars = 0;
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
              chunkChars += textChunk.length;
              totalChars += textChunk.length;
              
              // Trigger database update if we've accumulated enough characters
              if (chunkChars >= UPDATE_CHAR_THRESHOLD && !pendingUpdate) {
                pendingUpdate = true;
                performUpdate();
              }
            }
          }
          // Ignore other message types (f:, e:, d:) for now
        }
      }
    } finally {
      clearInterval(updateInterval);
    }
  };

  return { streamResponse };
}
