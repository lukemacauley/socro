import { useState, useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

export function useLocalStreamingState() {
  const updateStreamingResponse = useMutation(api.ai.updateStreamingResponse);
  const [streamingContent, setStreamingContent] = useState<Record<string, string>>({});
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Record<string, string>>({});

  const updateLocalContent = useCallback((messageId: string, content: string) => {
    // Update local state immediately for instant UI feedback
    setStreamingContent(prev => ({
      ...prev,
      [messageId]: content
    }));

    // Queue database update
    pendingUpdatesRef.current[messageId] = content;

    // Debounce database updates
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }

    updateTimerRef.current = setTimeout(async () => {
      const updates = { ...pendingUpdatesRef.current };
      pendingUpdatesRef.current = {};

      // Batch update all pending changes
      for (const [id, text] of Object.entries(updates)) {
        try {
          await updateStreamingResponse({
            messageId: id as Id<"messages">,
            content: text,
          });
        } catch (error) {
          console.error("Failed to update message:", error);
        }
      }
    }, 500); // Update database every 500ms
  }, [updateStreamingResponse]);

  const finalizeContent = useCallback(async (messageId: string, content: string, isComplete: boolean) => {
    // Clear any pending updates
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }

    // Final update to database
    try {
      await updateStreamingResponse({
        messageId: messageId as Id<"messages">,
        content,
        isComplete,
      });
    } catch (error) {
      console.error("Failed to finalize message:", error);
    }

    // Clear local state for this message
    setStreamingContent(prev => {
      const newState = { ...prev };
      delete newState[messageId];
      return newState;
    });
  }, [updateStreamingResponse]);

  return {
    streamingContent,
    updateLocalContent,
    finalizeContent,
  };
}