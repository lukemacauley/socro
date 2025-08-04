import { useEffect, useState, useRef, useCallback } from "react";
import type { Id } from "convex/_generated/dataModel";
import { env } from "env";

type StreamData = {
  type: "chunk" | "complete" | "error";
  messageId: string;
  content?: string;
  reasoning?: string;
  chunkIndex?: number;
  error?: string;
};

export function useMessageStream(
  messageId: Id<"messages"> | null,
  threadId: Id<"threads"> | null,
  isStreaming: boolean | undefined
) {
  const reconnectAttempts = 3;
  const reconnectDelay = 1000;

  const [streamedContent, setStreamedContent] = useState("");
  const [streamedReasoning, setStreamedReasoning] = useState("");
  const [connectionState, setConnectionState] = useState<
    "idle" | "connecting" | "connected" | "error" | "complete"
  >("idle");

  const chunksRef = useRef<Map<number, string>>(new Map());
  const reasoningChunksRef = useRef<Map<number, string>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const reconstructContent = useCallback(() => {
    const sortedChunks = Array.from(chunksRef.current.entries())
      .sort(([a], [b]) => a - b)
      .map(([_, content]) => content);
    return sortedChunks.join("");
  }, []);

  const reconstructReasoning = useCallback(() => {
    const sortedChunks = Array.from(reasoningChunksRef.current.entries())
      .sort(([a], [b]) => a - b)
      .map(([_, reasoning]) => reasoning);
    return sortedChunks.join("");
  }, []);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!messageId || !threadId || !isStreaming) {
      setConnectionState("idle");
      return;
    }

    const convexUrl = env.VITE_CONVEX_SITE_URL;
    if (!convexUrl) {
      setConnectionState("error");
      return;
    }

    cleanup();

    // Reset state
    chunksRef.current.clear();
    reasoningChunksRef.current.clear();
    setStreamedContent("");
    setStreamedReasoning("");
    setConnectionState("connecting");

    const sseUrl = `${convexUrl}/stream?messageId=${messageId}&threadId=${threadId}`;
    console.log(`[CLIENT] Connecting to SSE: ${sseUrl}`);
    const connectStartTime = Date.now();

    try {
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log(
          `[CLIENT] SSE connected in ${Date.now() - connectStartTime}ms`
        );
        setConnectionState("connected");
        reconnectCountRef.current = 0; // Reset reconnect count on successful connection
      };

      eventSource.onmessage = (event) => {
        try {
          const data: StreamData = JSON.parse(event.data);

          switch (data.type) {
            case "chunk":
              if (data.chunkIndex === 0) {
                console.log(`[CLIENT] First chunk received`);
              }
              if (data.chunkIndex !== undefined) {
                if (data.content) {
                  chunksRef.current.set(data.chunkIndex, data.content);
                  const content = reconstructContent();
                  setStreamedContent(content);
                }
                if (data.reasoning) {
                  reasoningChunksRef.current.set(
                    data.chunkIndex,
                    data.reasoning
                  );
                  const reasoning = reconstructReasoning();
                  setStreamedReasoning(reasoning);
                }
              }
              break;

            case "complete":
              const finalContent = reconstructContent();
              const finalReasoning = reconstructReasoning();
              setStreamedContent(finalContent);
              setStreamedReasoning(finalReasoning);
              setConnectionState("complete");
              cleanup();
              break;

            case "error":
              const errorMsg = data.error || "Unknown error";
              setConnectionState("error");
              cleanup();
              break;
          }
        } catch (err) {
          console.error("Failed to parse SSE data:", err);
        }
      };

      eventSource.onerror = (error) => {
        console.error("SSE error:", error);

        // Check if we should attempt reconnection
        if (
          reconnectCountRef.current < reconnectAttempts &&
          connectionState !== "complete"
        ) {
          reconnectCountRef.current++;
          console.log(
            `[CLIENT] Reconnection attempt ${reconnectCountRef.current}/${reconnectAttempts}`
          );

          setConnectionState("connecting");
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay * reconnectCountRef.current);
        } else {
          setConnectionState("error");
          cleanup();
        }
      };
    } catch (error) {
      console.error("Failed to create EventSource:", error);
      setConnectionState("error");
    }
  }, [
    messageId,
    threadId,
    isStreaming,
    reconnectAttempts,
    reconnectDelay,
    cleanup,
    reconstructContent,
    reconstructReasoning,
  ]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  return {
    streamedContent,
    streamedReasoning,
  };
}
