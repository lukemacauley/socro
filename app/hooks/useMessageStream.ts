import { useEffect, useState, useRef, useCallback } from "react";
import type { Id } from "convex/_generated/dataModel";
import { env } from "env";

interface StreamData {
  type: "chunk" | "complete" | "error";
  content?: string;
  chunkIndex?: number;
  error?: string;
  messageId: string;
}

export function useMessageStream(
  messageId: Id<"messages"> | null,
  threadId: Id<"threads"> | null,
  isStreaming: boolean | undefined
) {
  const reconnectAttempts = 3;
  const reconnectDelay = 1000;

  const [streamedContent, setStreamedContent] = useState("");
  const [connectionState, setConnectionState] = useState<
    "idle" | "connecting" | "connected" | "error" | "complete"
  >("idle");

  const chunksRef = useRef<Map<number, string>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const reconstructContent = useCallback(() => {
    const sortedChunks = Array.from(chunksRef.current.entries())
      .sort(([a], [b]) => a - b)
      .map(([_, content]) => content);
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
    // Validate inputs
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
    setStreamedContent("");
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
              if (data.chunkIndex !== undefined && data.content) {
                chunksRef.current.set(data.chunkIndex, data.content);
                const content = reconstructContent();
                setStreamedContent(content);
              }
              break;

            case "complete":
              const finalContent = reconstructContent();
              setStreamedContent(finalContent);
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
  ]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  return {
    streamedContent,
  };
}
