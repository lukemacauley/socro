import sanitizeHtml from "sanitize-html";
import { decode } from "he";

export function sanitizeEmailContent(content: string, contentType: string) {
  if (contentType !== "html") {
    // For plain text, just decode entities and convert newlines
    return {
      content: decode(content).replace(/\n/g, "<br>"),
      metadata: { contentType: "text" as const },
    };
  }

  // For HTML, sanitize it
  const cleaned = sanitizeHtml(content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "width", "height"],
    },
    transformTags: {
      img: (tagName, attribs) => {
        // Block tracking pixels
        if (attribs.width === "1" && attribs.height === "1") {
          return { tagName, attribs: {} };
        }
        return { tagName, attribs };
      },
    },
  });

  return {
    content: cleaned,
    metadata: {
      contentType: "html" as const,
      sanitized: true,
    },
  };
}
