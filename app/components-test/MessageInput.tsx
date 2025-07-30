import { useState, useCallback, useRef } from "react";
import { useSidebar } from "~/components/ui/sidebar";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import {
  AIInput,
  AIInputButton,
  AIInputSubmit,
  AIInputTextarea,
  AIInputToolbar,
  AIInputTools,
} from "~/components/kibo-ui/ai/input";
import { Paperclip, X } from "lucide-react";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "~/components/kibo-ui/dropzone";
import { useDropzone } from "react-dropzone";
import { v7 as createId } from "uuid";
import AttachmentButton from "./AttachmentButton";
import type { Id } from "convex/_generated/dataModel";

export const MessageInput = ({
  threadId,
  browserId,
  onSendFirstMessage,
}: {
  threadId?: Id<"threads">;
  browserId?: string;
  onSendFirstMessage?: (content: string, uploadId?: string) => void;
}) => {
  const sendMessage = useAction(api.messages.sendMessage);
  const createThreadAndSendMessage = useAction(
    api.messages.createThreadAndSendMessage
  );
  const uploadFiles = useAction(api.attachments.uploadUserFiles);

  const { state } = useSidebar();
  const { getRootProps, isDragActive } = useDropzone();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[] | undefined>(undefined);
  const [uploadId, setUploadId] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim() || isUploading) {
        return;
      }

      const content = prompt;
      setPrompt("");

      if (onSendFirstMessage) {
        onSendFirstMessage(content, uploadId);
        return;
      }

      if (threadId) {
        await sendMessage({
          threadId,
          content,
          uploadId,
        });
        return;
      } else if (browserId) {
        await createThreadAndSendMessage({
          content,
          uploadId,
          browserId,
        });
      }

      setFiles(undefined);
      setUploadId(undefined);
    },
    [
      prompt,
      threadId,
      browserId,
      sendMessage,
      createThreadAndSendMessage,
      onSendFirstMessage,
      isUploading,
    ]
  );

  const handleUploadFiles = useCallback(
    async (f: File | File[]) => {
      const fileArray = Array.isArray(f) ? f : [f];

      setFiles((prev) => [...(prev || []), ...fileArray]);
      setIsUploading(true);

      try {
        const files = await Promise.all(
          fileArray.map(async (file) => ({
            name: file.name,
            type: file.type,
            size: file.size,
            data: await file.arrayBuffer(),
          }))
        );

        const uploadId = createId();
        setUploadId(uploadId);

        await uploadFiles({
          files: files,
          uploadId,
        });
      } catch (error) {
        console.error("Error uploading files:", error);
      } finally {
        setIsUploading(false);
      }
    },
    [uploadFiles]
  );

  return (
    <div
      {...getRootProps()}
      className="sticky px-4 left-0 right-0 bottom-4"
      style={{
        left: state === "collapsed" ? "3rem" : "18rem",
      }}
    >
      <div className="max-w-[808px] w-full mx-auto">
        {isDragActive ? (
          <Dropzone
            onDrop={handleUploadFiles}
            onError={console.error}
            src={files}
          >
            <DropzoneEmptyState />
            <DropzoneContent />
          </Dropzone>
        ) : (
          <AIInput onSubmit={handleSubmit}>
            {files && files.length > 0 && (
              <div className="flex items-center justify-start gap-4 p-2 overflow-auto scrollbar-hide">
                {files?.map((file, index) => (
                  <AttachmentButton
                    name={file.name}
                    type={file.type.split("/")[1]}
                    key={`${file.name}-${index}`}
                    onClick={() => {
                      setFiles((prev) =>
                        prev ? prev.filter((f) => f !== file) : []
                      );
                    }}
                    icon={X}
                  />
                ))}
              </div>
            )}
            <AIInputTextarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              autoFocus
            />
            <AIInputToolbar>
              <AIInputTools>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                      handleUploadFiles(files);
                    }
                  }}
                />
                <AIInputButton
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                  tooltip="Upload files"
                >
                  <Paperclip size={16} />
                </AIInputButton>
              </AIInputTools>
              <AIInputSubmit disabled={!prompt || isUploading} size="icon" />
            </AIInputToolbar>
          </AIInput>
        )}
      </div>
    </div>
  );
};
