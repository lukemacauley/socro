import { v } from "convex/values";
import { Message } from "@microsoft/microsoft-graph-types";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { fetchSentEmailsFromMicrosoft } from "./lib/email";

// Helper to extract plain text from HTML
function extractPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

// Analyze formality level based on content
function analyzeFormality(
  emails: Message[]
): "very_formal" | "formal" | "semi_formal" | "casual" | "very_casual" {
  const formalIndicators = [
    /dear\s+\w+/i,
    /sincerely|respectfully|regards/i,
    /please\s+find\s+attached/i,
    /i\s+would\s+like\s+to/i,
    /kindly|pursuant|regarding/i,
  ];

  const casualIndicators = [
    /hey|hi\s+there/i,
    /thanks|thx|ty/i,
    /lol|haha|:\)|;-\)/i,
    /gonna|wanna|gotta/i,
    /!{2,}/,
  ];

  let formalScore = 0;
  let casualScore = 0;

  emails.forEach((email) => {
    const content = email.body?.content || "";
    const plainText =
      email.body?.contentType === "html" ? extractPlainText(content) : content;

    formalIndicators.forEach((pattern) => {
      if (pattern.test(plainText)) formalScore++;
    });

    casualIndicators.forEach((pattern) => {
      if (pattern.test(plainText)) casualScore++;
    });
  });

  const avgFormal = formalScore / emails.length;
  const avgCasual = casualScore / emails.length;

  if (avgFormal > 3) return "very_formal";
  if (avgFormal > 1.5) return "formal";
  if (avgCasual > 2) return "very_casual";
  if (avgCasual > 1) return "casual";
  return "semi_formal";
}

// Extract common greetings
function extractGreetings(emails: Message[]): string[] {
  const greetings = new Map<string, number>();
  const greetingPattern =
    /^(dear\s+\w+|hi\s+\w*|hello\s+\w*|hey\s+\w*|good\s+\w+|\w+,)/im;

  emails.forEach((email) => {
    const content = email.body?.content || "";
    const plainText =
      email.body?.contentType === "html" ? extractPlainText(content) : content;
    const lines = plainText.split("\n").filter((l) => l.trim());

    if (lines.length > 0) {
      const match = lines[0].match(greetingPattern);
      if (match) {
        const greeting = match[1]
          .toLowerCase()
          .replace(/\s+\w+$/, "")
          .trim();
        greetings.set(greeting, (greetings.get(greeting) || 0) + 1);
      }
    }
  });

  return Array.from(greetings.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([greeting]) => greeting);
}

// Extract common closings
function extractClosings(emails: Message[]): string[] {
  const closings = new Map<string, number>();
  const closingPatterns = [
    /^(best|regards|sincerely|thanks|cheers|talk soon|thank you)/im,
    /^(best regards|kind regards|warm regards|many thanks)/im,
  ];

  emails.forEach((email) => {
    const content = email.body?.content || "";
    const plainText =
      email.body?.contentType === "html" ? extractPlainText(content) : content;
    const lines = plainText
      .split("\n")
      .filter((l) => l.trim())
      .reverse();

    // Check last few lines for closings
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      for (const pattern of closingPatterns) {
        const match = lines[i].match(pattern);
        if (match) {
          const closing = match[1].toLowerCase();
          closings.set(closing, (closings.get(closing) || 0) + 1);
        }
      }
    }
  });

  return Array.from(closings.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([closing]) => closing);
}

// Extract common phrases (2-5 word sequences)
function extractCommonPhrases(emails: Message[]): string[] {
  const phrases = new Map<string, number>();
  const minPhraseOccurrence = 3;

  emails.forEach((email) => {
    const content = email.body?.content || "";
    const plainText =
      email.body?.contentType === "html" ? extractPlainText(content) : content;
    const words = plainText
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    // Extract 2-4 word phrases
    for (let len = 2; len <= 4; len++) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(" ");
        if (
          phrase.length > 5 &&
          !phrase.match(/^(the|and|for|that|this|with|from|have|will|would)/)
        ) {
          phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
        }
      }
    }
  });

  return Array.from(phrases.entries())
    .filter(([_, count]) => count >= minPhraseOccurrence)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([phrase]) => phrase);
}

// Analyze sentence patterns
function analyzeSentencePatterns(emails: Message[]) {
  const sentenceStarters = new Map<string, number>();
  let totalSentences = 0;
  let totalWords = 0;
  let contractionsCount = 0;

  emails.forEach((email) => {
    const content = email.body?.content || "";
    const plainText =
      email.body?.contentType === "html" ? extractPlainText(content) : content;
    const sentences = plainText.match(/[^.!?]+[.!?]+/g) || [];

    sentences.forEach((sentence) => {
      const trimmed = sentence.trim();
      totalSentences++;
      totalWords += trimmed.split(/\s+/).length;

      // Check for contractions
      if (trimmed.match(/\w+'\w+/)) contractionsCount++;

      // Extract sentence starters (first 2-3 words)
      const words = trimmed.split(/\s+/).slice(0, 3);
      if (words.length > 0) {
        const starter = words.join(" ").toLowerCase();
        sentenceStarters.set(starter, (sentenceStarters.get(starter) || 0) + 1);
      }
    });
  });

  const avgSentenceLength =
    totalSentences > 0 ? totalWords / totalSentences : 15;
  const usesContractions = contractionsCount / totalSentences > 0.1;

  const topStarters = Array.from(sentenceStarters.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([starter]) => starter);

  return {
    averageSentenceLength: avgSentenceLength,
    usesContractions,
    sentenceStarters: topStarters,
  };
}

// Determine paragraph style
function analyzeParagraphStyle(emails: Message[]): "short" | "medium" | "long" {
  let totalParagraphs = 0;
  let totalLines = 0;

  emails.forEach((email) => {
    const content = email.body?.content || "";
    const plainText =
      email.body?.contentType === "html" ? extractPlainText(content) : content;
    const paragraphs = plainText.split(/\n\n+/).filter((p) => p.trim());

    paragraphs.forEach((para) => {
      totalParagraphs++;
      totalLines += para.split("\n").length;
    });
  });

  const avgLinesPerPara =
    totalParagraphs > 0 ? totalLines / totalParagraphs : 2;

  if (avgLinesPerPara < 2) return "short";
  if (avgLinesPerPara > 4) return "long";
  return "medium";
}

// Create example emails for different contexts
function selectExampleEmails(emails: Message[]): Array<{
  recipient: string;
  content: string;
  context?: string;
}> {
  const examples: Array<{
    recipient: string;
    content: string;
    context?: string;
  }> = [];

  // Try to get diverse examples
  const contextPatterns = {
    client: /client|customer|inquiry|proposal|invoice/i,
    colleague: /team|project|meeting|update|status/i,
    internal: /fyi|heads up|quick|chat|sync/i,
  };

  emails.slice(0, 20).forEach((email) => {
    const content = email.body?.content || "";
    const plainText =
      email.body?.contentType === "html" ? extractPlainText(content) : content;
    const recipients =
      email.toRecipients?.map((r) => r.emailAddress?.address).join(", ") || "";

    // Determine context
    let context: string | undefined;
    for (const [ctx, pattern] of Object.entries(contextPatterns)) {
      if (pattern.test(plainText) || pattern.test(email.subject || "")) {
        context = ctx;
        break;
      }
    }

    if (plainText.length > 50 && plainText.length < 2000) {
      examples.push({
        recipient: recipients,
        content: plainText,
        context,
      });
    }
  });

  return examples.slice(0, 10);
}

// Main analysis action
export const analyse = internalAction({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Fetch sent emails from Microsoft Graph
      const sentEmails = await fetchSentEmailsFromMicrosoft(
        args.accessToken,
        100, // Fetch up to 100 emails
        60 // From last 60 days
      );

      if (sentEmails.length < 5) {
        console.log("Not enough sent emails to analyze writing style");
        return;
      }

      // Analyze various aspects of writing style
      const formality = analyzeFormality(sentEmails);
      const greetings = extractGreetings(sentEmails);
      const closings = extractClosings(sentEmails);
      const commonPhrases = extractCommonPhrases(sentEmails);
      const sentencePatterns = analyzeSentencePatterns(sentEmails);
      const paragraphStyle = analyzeParagraphStyle(sentEmails);
      const exampleEmails = selectExampleEmails(sentEmails);

      // Determine directness and emotional tone
      const directness =
        formality === "casual" || formality === "very_casual"
          ? "direct"
          : "balanced";
      const emotionalTone =
        formality === "very_formal" || formality === "formal"
          ? "professional"
          : "neutral";

      // Store the analysis
      await ctx.runMutation(internal.userStyles.store, {
        userId: args.userId,
        analysisDate: Date.now(),
        emailsAnalyzed: sentEmails.length,
        formalityLevel: formality,
        greetings,
        closings,
        averageSentenceLength: sentencePatterns.averageSentenceLength,
        usesContractions: sentencePatterns.usesContractions,
        sentenceStarters: sentencePatterns.sentenceStarters,
        commonPhrases,
        signaturePhrases: commonPhrases.slice(0, 5), // Top 5 as signature phrases
        professionalTerms: [], // Could be enhanced with domain-specific analysis
        usesNumberedLists: sentEmails.some((e) =>
          (e.body?.content || "").includes("1.")
        ),
        usesBulletPoints: sentEmails.some((e) =>
          (e.body?.content || "").match(/[•·▪▫◦‣⁃]/)
        ),
        paragraphStyle,
        directness,
        emotionalTone,
        exampleEmails,
      });

      console.log(
        `Successfully analyzed writing style for user ${args.userId}`
      );
    } catch (error) {
      console.error("Error analyzing writing style:", error);
      throw error;
    }
  },
});

// Get user's writing style
export const get = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userWritingStyles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// Store the analyzed writing style
export const store = internalMutation({
  args: {
    userId: v.id("users"),
    analysisDate: v.number(),
    emailsAnalyzed: v.number(),
    formalityLevel: v.union(
      v.literal("very_formal"),
      v.literal("formal"),
      v.literal("semi_formal"),
      v.literal("casual"),
      v.literal("very_casual")
    ),
    greetings: v.array(v.string()),
    closings: v.array(v.string()),
    averageSentenceLength: v.number(),
    usesContractions: v.boolean(),
    sentenceStarters: v.array(v.string()),
    commonPhrases: v.array(v.string()),
    signaturePhrases: v.array(v.string()),
    professionalTerms: v.array(v.string()),
    usesNumberedLists: v.boolean(),
    usesBulletPoints: v.boolean(),
    paragraphStyle: v.union(
      v.literal("short"),
      v.literal("medium"),
      v.literal("long")
    ),
    directness: v.union(
      v.literal("very_direct"),
      v.literal("direct"),
      v.literal("balanced"),
      v.literal("indirect")
    ),
    emotionalTone: v.union(
      v.literal("warm"),
      v.literal("neutral"),
      v.literal("professional"),
      v.literal("formal")
    ),
    exampleEmails: v.array(
      v.object({
        recipient: v.string(),
        content: v.string(),
        context: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Check if user already has a style profile
    const existing = await ctx.db
      .query("userWritingStyles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      // Update existing profile
      await ctx.db.patch(existing._id, args);
    } else {
      // Create new profile
      await ctx.db.insert("userWritingStyles", args);
    }
  },
});
