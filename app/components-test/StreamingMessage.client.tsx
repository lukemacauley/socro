import { useStream } from "@convex-dev/persistent-text-streaming/react";
import { type StreamId } from "@convex-dev/persistent-text-streaming";
import ReactMarkdown from "react-markdown";
import { useEffect } from "react";
import { api } from "convex/_generated/api";
import { Spinner } from "~/components/kibo-ui/spinner";

export function StreamingMessage({
  streamId,
  isDriven,
  stopStreaming,
}: {
  streamId: StreamId | undefined;
  isDriven: boolean;
  stopStreaming: () => void;
}) {
  const streamUrl = new URL(
    `${import.meta.env.VITE_CONVEX_SITE_URL}/stream-ai-response`
  );

  const { text, status } = useStream(
    api.streaming.getStreamBody,
    streamUrl,
    isDriven,
    streamId
  );

  useEffect(() => {
    // When streaming is done and we were driving, notify parent
    if (status === "done" && isDriven) {
      stopStreaming();
    }
  }, [status, isDriven, stopStreaming]);

  return (
    <div className="rounded-lg p-0 border-zinc-200">
      <div className="prose prose-sm max-w-none">
        {status === "pending" && !text && <Spinner variant="'ellipsis'" />}
        <ReactMarkdown>{text || ""}</ReactMarkdown>
      </div>
      {status === "error" && (
        <div className="text-red-500 mt-2">Error loading response</div>
      )}
    </div>
  );
}
