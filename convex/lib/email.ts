import {
  Attachment,
  FileAttachment,
  ItemAttachment,
  ReferenceAttachment,
  Message,
} from "@microsoft/microsoft-graph-types";
import { MICROSOFT_GRAPH_BASE_URL } from "../webhooks";

// Extended types for processed attachments
interface ProcessedFileAttachment extends FileAttachment {
  contentBytes: string; // Always present after processing
}

interface SkippedAttachment extends Attachment {
  _skipped: true;
  _skipReason: string;
}

interface ErroredAttachment extends Attachment {
  _error: true;
  _errorMessage: string;
}

// Union type for all possible processed attachment states
type ProcessedAttachment =
  | ProcessedFileAttachment
  | ItemAttachment
  | ReferenceAttachment
  | SkippedAttachment
  | ErroredAttachment;

interface ProcessedMessage extends Omit<Message, "attachments"> {
  attachments?: ProcessedAttachment[];
}

interface FetchEmailOptions {
  includeAttachments?: boolean;
  maxAttachmentSize?: number; // in MB
  attachmentTypes?: string[]; // filter by MIME types
}

class MicrosoftGraphError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string,
    public details?: any
  ) {
    super(message);
    this.name = "MicrosoftGraphError";
  }
}

// Extend the base types to include the OData type discriminator
interface AttachmentWithODataType extends Attachment {
  "@odata.type"?: string;
}

interface FileAttachmentWithODataType extends FileAttachment {
  "@odata.type": "#microsoft.graph.fileAttachment";
}

interface ItemAttachmentWithODataType extends ItemAttachment {
  "@odata.type": "#microsoft.graph.itemAttachment";
}

interface ReferenceAttachmentWithODataType extends ReferenceAttachment {
  "@odata.type": "#microsoft.graph.referenceAttachment";
}

// Type guard functions using proper type checking
function hasODataType(attachment: any): attachment is AttachmentWithODataType {
  return (
    attachment && typeof attachment === "object" && "@odata.type" in attachment
  );
}

function isFileAttachment(
  attachment: Attachment
): attachment is FileAttachment {
  return (
    hasODataType(attachment) &&
    attachment["@odata.type"] === "#microsoft.graph.fileAttachment"
  );
}

function isItemAttachment(
  attachment: Attachment
): attachment is ItemAttachment {
  return (
    hasODataType(attachment) &&
    attachment["@odata.type"] === "#microsoft.graph.itemAttachment"
  );
}

function isReferenceAttachment(
  attachment: Attachment
): attachment is ReferenceAttachment {
  return (
    hasODataType(attachment) &&
    attachment["@odata.type"] === "#microsoft.graph.referenceAttachment"
  );
}

// Type guards for processed attachments
export function isProcessedFileAttachment(
  attachment: ProcessedAttachment
): attachment is ProcessedFileAttachment {
  return (
    isFileAttachment(attachment) &&
    !isSkippedAttachment(attachment) &&
    !isErroredAttachment(attachment) &&
    "contentBytes" in attachment &&
    typeof attachment.contentBytes === "string" &&
    attachment.contentBytes.length > 0
  );
}

function isSkippedAttachment(
  attachment: ProcessedAttachment
): attachment is SkippedAttachment {
  return "_skipped" in attachment && (attachment as any)._skipped === true;
}

function isErroredAttachment(
  attachment: ProcessedAttachment
): attachment is ErroredAttachment {
  return "_error" in attachment && (attachment as any)._error === true;
}

export async function fetchEmailFromMicrosoft(
  accessToken: string,
  emailId: string,
  options: FetchEmailOptions = {}
): Promise<ProcessedMessage> {
  const {
    includeAttachments = true,
    maxAttachmentSize = 10, // 10MB default
    attachmentTypes = [],
  } = options;

  try {
    console.log("[WEBHOOK] Fetching email from Microsoft Graph API...");

    // Only expand attachments if needed
    const expandParam = includeAttachments ? "?$expand=attachments" : "";

    const response = await fetch(
      `${MICROSOFT_GRAPH_BASE_URL}/me/messages/${emailId}${expandParam}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: 'outlook.body-content-type="text"', // Request text format
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new MicrosoftGraphError(
        `Microsoft Graph API error: ${response.status}`,
        response.status,
        response.statusText,
        errorText
      );
    }

    const email: Message = await response.json();

    // log the email but filter out attachments
    console.log("[WEBHOOK] Successfully fetched email:", {
      ...email,
      attachments: null,
    });

    console.log("[WEBHOOK] Successfully fetched email:", {
      id: email.id,
      subject: email.subject,
      from: email.from?.emailAddress?.address,
      attachmentCount: email.attachments?.length || 0,
    });

    // Process attachments if requested and present
    if (
      includeAttachments &&
      email.attachments &&
      email.attachments?.length > 0
    ) {
      const processedAttachments = await processAttachments(
        email.attachments,
        emailId,
        accessToken,
        { maxAttachmentSize, attachmentTypes }
      );

      return {
        ...email,
        attachments: processedAttachments,
      };
    }

    return email as ProcessedMessage;
  } catch (error) {
    console.error(
      "[WEBHOOK] Error fetching email from Microsoft Graph:",
      error
    );
    throw error; // Re-throw to let caller handle
  }
}

async function processAttachments(
  attachments: Attachment[],
  emailId: string,
  accessToken: string,
  options: { maxAttachmentSize: number; attachmentTypes: string[] }
): Promise<ProcessedAttachment[]> {
  const { maxAttachmentSize, attachmentTypes } = options;
  const maxSizeBytes = maxAttachmentSize * 1024 * 1024;

  // Process attachments in parallel for better performance
  const processedAttachments = await Promise.all(
    attachments.map(async (attachment): Promise<ProcessedAttachment | null> => {
      try {
        // Skip if filtering by type and doesn't match
        if (
          attachmentTypes.length > 0 &&
          attachment.contentType &&
          !attachmentTypes.includes(attachment.contentType)
        ) {
          console.log(
            `[WEBHOOK] Skipping attachment due to type filter: ${attachment.name}`
          );
          return null;
        }

        // Skip if too large
        if (attachment.size && attachment.size > maxSizeBytes) {
          console.log(
            `[WEBHOOK] Skipping attachment due to size (${attachment.size} bytes): ${attachment.name}`
          );
          // Return as SkippedAttachment
          return {
            ...attachment,
            _skipped: true,
            _skipReason: "size_limit_exceeded",
          } as SkippedAttachment;
        }

        if (isFileAttachment(attachment)) {
          // Process and ensure contentBytes is present
          const processed = await processFileAttachment(
            attachment,
            emailId,
            accessToken
          );
          return processed as ProcessedFileAttachment;
        } else if (isItemAttachment(attachment)) {
          return processItemAttachment(attachment);
        } else if (isReferenceAttachment(attachment)) {
          // Handle reference attachments (e.g., OneDrive links)
          console.log(
            `[WEBHOOK] Reference attachment found: ${attachment.name}`
          );
          return attachment;
        }

        // Unknown attachment type
        const odataType = hasODataType(attachment)
          ? attachment["@odata.type"]
          : "unknown";
        console.warn(`[WEBHOOK] Unknown attachment type: ${odataType}`);
        return attachment as ProcessedAttachment;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[WEBHOOK] Error processing attachment ${attachment.id}:`,
          error
        );

        // Return as ErroredAttachment
        return {
          ...attachment,
          _error: true,
          _errorMessage: errorMessage,
        } as ErroredAttachment;
      }
    })
  );

  // Filter out null values and return with proper type
  return processedAttachments.filter(
    (a): a is ProcessedAttachment => a !== null
  );
}

async function processFileAttachment(
  attachment: FileAttachment,
  emailId: string,
  accessToken: string
): Promise<ProcessedFileAttachment> {
  // If content is already present (small attachment), return as ProcessedFileAttachment
  if (attachment.contentBytes) {
    return attachment as ProcessedFileAttachment;
  }

  // Large file - contentBytes is null/undefined, need to fetch separately
  console.log(
    `[WEBHOOK] Fetching large attachment: ${attachment.name} (${attachment.size} bytes)`
  );

  const attachmentResponse = await fetch(
    `${MICROSOFT_GRAPH_BASE_URL}/me/messages/${emailId}/attachments/${attachment.id}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!attachmentResponse.ok) {
    throw new Error(`Failed to fetch attachment: ${attachmentResponse.status}`);
  }

  const fullAttachment: FileAttachment = await attachmentResponse.json();

  // Ensure we got the content
  if (!fullAttachment.contentBytes) {
    throw new Error(
      `Failed to retrieve content for attachment: ${attachment.name}`
    );
  }

  // Now we can guarantee contentBytes exists
  return fullAttachment as ProcessedFileAttachment;
}

function processItemAttachment(attachment: ItemAttachment): ItemAttachment {
  // Handle item attachments (e.g., attached emails, calendar items)
  console.log(`[WEBHOOK] Item attachment found: ${attachment.name}`);
  // You might want to fetch the actual item here if needed
  // For now, return the attachment with its metadata
  return attachment;
}
