import { useStream } from "@convex-dev/persistent-text-streaming/react";
import { type StreamId } from "@convex-dev/persistent-text-streaming";
import ReactMarkdown from "react-markdown";
import { useMemo, useEffect } from "react";
import { api } from "convex/_generated/api";

interface StreamingMessageProps {
  message: {
    _id: string;
    content: string;
    streamId?: string;
  };
  isDriven: boolean;
  stopStreaming: () => void;
}

export function StreamingMessage({
  message,
  isDriven,
  stopStreaming,
}: StreamingMessageProps) {
  const { text, status } = useStream(
    api.streaming.getStreamBody,
    new URL(`${import.meta.env.VITE_CONVEX_SITE_URL}/stream-ai-response`),
    isDriven,
    message.streamId as StreamId | undefined
  );

  const isCurrentlyStreaming = useMemo(() => {
    if (!isDriven) return false;
    const streaming = status === "pending" || status === "streaming";
    return streaming;
  }, [isDriven, status, message.streamId]);

  useEffect(() => {
    if (!isDriven || isCurrentlyStreaming) {
      return;
    }
    stopStreaming();
  }, [isDriven, isCurrentlyStreaming, stopStreaming, message.streamId, status]);

  return (
    <div className="rounded-lg p-0 border-zinc-200">
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown>{text || ""}</ReactMarkdown>
      </div>
      {status === "error" && (
        <div className="text-red-500 mt-2">Error loading response</div>
      )}
    </div>
  );
}
