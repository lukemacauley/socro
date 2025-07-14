import { useState, useCallback } from "react";
import { useSidebar } from "~/components/ui/sidebar";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  AIInput,
  AIInputButton,
  AIInputSubmit,
  AIInputTextarea,
  AIInputToolbar,
  AIInputTools,
} from "~/components/kibo-ui/ai/input";
import { Paperclip } from "lucide-react";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "~/components/kibo-ui/dropzone";
import { useDropzone } from "react-dropzone";
import { createId } from "legid";

export const MessageInput = ({ threadId }: { threadId: Id<"threads"> }) => {
  const sendMessage = useAction(api.messages.sendMessage);
  const uploadFiles = useAction(api.attachments.uploadUserFiles);

  const { state } = useSidebar();

  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[] | undefined>(undefined);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim()) {
        return;
      }

      const content = prompt;
      setPrompt("");

      await sendMessage({
        threadId,
        content,
      });
    },
    [prompt, threadId, sendMessage]
  );

  const handleUploadFiles = useCallback(
    async (_files: File | File[] | null) => {
      if (!_files) {
        return;
      }

      const fileArray = Array.isArray(_files) ? _files : [_files];

      // Use Promise.all to wait for all async operations to complete
      const files = await Promise.all(
        fileArray.map(async (file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
          data: await file.arrayBuffer(),
        }))
      );

      const uploadId = await createId();

      await uploadFiles({
        files,
        uploadId,
      });
    },
    [threadId, sendMessage, uploadFiles]
  );

  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      setFiles(acceptedFiles);
      handleUploadFiles(acceptedFiles);
    },
    [handleUploadFiles, setFiles]
  );

  const { getRootProps, isDragActive, isDragAccept } = useDropzone();

  return (
    <div
      {...getRootProps()}
      className="sticky left-0 right-0 bottom-4"
      style={{
        left: state === "collapsed" ? "3rem" : "18rem",
      }}
    >
      <div className="max-w-[808px] w-full mx-auto">
        {isDragActive ? (
          <Dropzone onDrop={handleDrop} onError={console.error} src={files}>
            <DropzoneEmptyState />
            <DropzoneContent />
          </Dropzone>
        ) : (
          <AIInput onSubmit={handleSubmit}>
            <AIInputTextarea
              onChange={(e) => setPrompt(e.target.value)}
              value={prompt}
            />
            <AIInputToolbar>
              <AIInputTools>
                <AIInputButton variant="outline">
                  <Paperclip size={16} />
                </AIInputButton>
              </AIInputTools>
              <AIInputSubmit disabled={!prompt} size="icon" />
            </AIInputToolbar>
          </AIInput>
        )}
      </div>
    </div>
  );
};
