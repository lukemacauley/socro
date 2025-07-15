import { v } from "convex/values";
import { Message } from "@microsoft/microsoft-graph-types";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, mutation } from "./_generated/server";

// Enhanced tone profile with numerical scales
export const enhancedToneProfile = v.object({
  // Numerical scales (0-10)
  formality: v.number(), // 0=very casual, 10=very formal
  warmth: v.number(), // 0=cold/distant, 10=warm/friendly
  directness: v.number(), // 0=indirect/diplomatic, 10=very direct
  assertiveness: v.number(), // 0=tentative, 10=assertive
  verbosity: v.number(), // 0=very brief, 10=very detailed
  
  // Communication patterns
  usesAcknowledgments: v.boolean(), // "Thanks for your email..."
  usesPersonalTouches: v.boolean(), // Personal anecdotes, "How was your weekend?"
  usesHedging: v.boolean(), // "Perhaps", "Maybe", "Might"
  usesEmphasis: v.boolean(), // Bold, caps, exclamation points
  
  // Phrases to use and avoid
  signaturePhrases: v.array(v.string()),
  avoidPhrases: v.array(v.string()), // Phrases they never use
  
  // Punctuation patterns
  exclamationFrequency: v.number(), // per 100 sentences
  questionFrequency: v.number(), // per 100 sentences
  dashUsage: v.boolean(), // Em dashes, en dashes
  ellipsisUsage: v.boolean(), // ...
  
  // Response patterns
  typicalResponseTime: v.optional(v.string()), // "immediate", "same_day", "next_day"
  responseLength: v.string(), // "brief", "moderate", "detailed"
});

// Track user feedback on generated responses
export const recordResponseFeedback = mutation({
  args: {
    messageId: v.id("messages"),
    wasSent: v.boolean(),
    wasEdited: v.boolean(),
    editedContent: v.optional(v.string()),
    recipient: v.optional(v.string()),
    recipientType: v.optional(v.union(
      v.literal("client"),
      v.literal("colleague"),
      v.literal("superior"),
      v.literal("external")
    )),
  },
  handler: async (ctx, args) => {
    // Store feedback for continuous learning
    await ctx.db.insert("responseFeedback", {
      ...args,
      userId: await ctx.runQuery(api.auth.loggedInUserId),
      timestamp: Date.now(),
    });
    
    // If heavily edited, extract what changed
    if (args.wasEdited && args.editedContent) {
      // This could trigger re-analysis of style preferences
      await ctx.scheduler.runAfter(0, internal.userStylesEnhanced.analyzeEdits, {
        originalMessageId: args.messageId,
        editedContent: args.editedContent,
      });
    }
  },
});

// Analyze what users change in generated responses
export const analyzeEdits = internalAction({
  args: {
    originalMessageId: v.id("messages"),
    editedContent: v.string(),
  },
  handler: async (ctx, args) => {
    const originalMessage = await ctx.runQuery(internal.messages.get, {
      messageId: args.originalMessageId,
    });
    
    if (!originalMessage) return;
    
    // Compare original vs edited to identify:
    // 1. Added phrases (user preferences)
    // 2. Removed phrases (avoid these)
    // 3. Tone changes (formality adjustments)
    // 4. Structure changes (paragraph/sentence modifications)
    
    // This analysis would update the user's style profile
    console.log("Analyzing edits to improve future responses...");
    // Implementation would involve NLP comparison
  },
});

// Enhanced analysis with numerical scoring
export const analyzeWithScoring = internalAction({
  args: {
    userId: v.id("users"),
    emails: v.array(v.any()), // Message[] from Microsoft Graph
  },
  handler: async (ctx, args) => {
    const emails = args.emails as Message[];
    
    // Calculate numerical scores
    const formalityScore = calculateFormalityScore(emails);
    const warmthScore = calculateWarmthScore(emails);
    const directnessScore = calculateDirectnessScore(emails);
    const assertivenessScore = calculateAssertivenessScore(emails);
    const verbosityScore = calculateVerbosityScore(emails);
    
    // Detect communication patterns
    const patterns = detectCommunicationPatterns(emails);
    
    // Extract phrases to avoid (rarely or never used common phrases)
    const avoidPhrases = extractAvoidPhrases(emails);
    
    // Store enhanced profile
    await ctx.runMutation(internal.userStylesEnhanced.storeEnhancedProfile, {
      userId: args.userId,
      profile: {
        formality: formalityScore,
        warmth: warmthScore,
        directness: directnessScore,
        assertiveness: assertivenessScore,
        verbosity: verbosityScore,
        ...patterns,
        avoidPhrases,
        signaturePhrases: extractSignaturePhrases(emails),
        responseLength: determineTypicalLength(emails),
      },
    });
  },
});

// Helper functions for scoring
function calculateFormalityScore(emails: Message[]): number {
  const indicators = {
    formal: [
      /\bdear\s+\w+/i,
      /\bsincerely\b/i,
      /\bregards\b/i,
      /\bplease\s+find\s+attached\b/i,
      /\bi\s+would\s+appreciate\b/i,
      /\bkindly\b/i,
    ],
    informal: [
      /\bhey\b/i,
      /\bhi\s+there\b/i,
      /\bthanks\b/i,
      /\bFYI\b/i,
      /\basap\b/i,
      /\blol\b/i,
    ],
  };
  
  let formalCount = 0;
  let informalCount = 0;
  
  emails.forEach(email => {
    const content = email.body?.content || '';
    indicators.formal.forEach(pattern => {
      if (pattern.test(content)) formalCount++;
    });
    indicators.informal.forEach(pattern => {
      if (pattern.test(content)) informalCount++;
    });
  });
  
  // Scale 0-10: 0 is very informal, 10 is very formal
  const ratio = formalCount / (formalCount + informalCount + 1);
  return Math.round(ratio * 10);
}

function calculateWarmthScore(emails: Message[]): number {
  const warmIndicators = [
    /\bhope\s+you're\s+well\b/i,
    /\bhow\s+are\s+you\b/i,
    /\bthank\s+you\s+so\s+much\b/i,
    /\bappreciate\b/i,
    /\bexcited\b/i,
    /\blooking\s+forward\b/i,
    /!+/g, // Exclamation points
  ];
  
  let warmthCount = 0;
  emails.forEach(email => {
    const content = email.body?.content || '';
    warmIndicators.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) warmthCount += matches.length;
    });
  });
  
  // Normalize by email count and scale to 0-10
  const avgWarmth = warmthCount / emails.length;
  return Math.min(10, Math.round(avgWarmth * 2));
}

function calculateDirectnessScore(emails: Message[]): number {
  const directIndicators = [
    /^i\s+need\b/im,
    /^please\s+\w+\b/im,
    /^can\s+you\b/im,
    /^will\s+you\b/im,
    /\bimmediately\b/i,
    /\basap\b/i,
  ];
  
  const indirectIndicators = [
    /\bperhaps\b/i,
    /\bmaybe\b/i,
    /\bwondering\s+if\b/i,
    /\bwould\s+it\s+be\s+possible\b/i,
    /\bif\s+you\s+have\s+time\b/i,
    /\bwhen\s+you\s+get\s+a\s+chance\b/i,
  ];
  
  let directCount = 0;
  let indirectCount = 0;
  
  emails.forEach(email => {
    const content = email.body?.content || '';
    directIndicators.forEach(pattern => {
      if (pattern.test(content)) directCount++;
    });
    indirectIndicators.forEach(pattern => {
      if (pattern.test(content)) indirectCount++;
    });
  });
  
  const ratio = directCount / (directCount + indirectCount + 1);
  return Math.round(ratio * 10);
}

function calculateAssertivenessScore(emails: Message[]): number {
  const assertiveIndicators = [
    /\bi\s+will\b/i,
    /\bi\s+need\b/i,
    /\bmust\b/i,
    /\brequire\b/i,
    /\bexpect\b/i,
  ];
  
  const tentativeIndicators = [
    /\bi\s+think\b/i,
    /\bi\s+believe\b/i,
    /\bmaybe\b/i,
    /\bpossibly\b/i,
    /\bmight\b/i,
    /\bcould\b/i,
  ];
  
  let assertiveCount = 0;
  let tentativeCount = 0;
  
  emails.forEach(email => {
    const content = email.body?.content || '';
    assertiveIndicators.forEach(pattern => {
      if (pattern.test(content)) assertiveCount++;
    });
    tentativeIndicators.forEach(pattern => {
      if (pattern.test(content)) tentativeCount++;
    });
  });
  
  const ratio = assertiveCount / (assertiveCount + tentativeCount + 1);
  return Math.round(ratio * 10);
}

function calculateVerbosityScore(emails: Message[]): number {
  let totalWords = 0;
  emails.forEach(email => {
    const content = email.body?.content || '';
    const plainText = content.replace(/<[^>]*>/g, '').trim();
    totalWords += plainText.split(/\s+/).length;
  });
  
  const avgWords = totalWords / emails.length;
  
  // Scale: <50 words = 0, >500 words = 10
  if (avgWords < 50) return 0;
  if (avgWords > 500) return 10;
  return Math.round((avgWords - 50) / 45);
}

function detectCommunicationPatterns(emails: Message[]) {
  let acknowledgments = 0;
  let personalTouches = 0;
  let hedging = 0;
  let emphasis = 0;
  let exclamations = 0;
  let questions = 0;
  let dashes = 0;
  let ellipsis = 0;
  
  emails.forEach(email => {
    const content = email.body?.content || '';
    
    if (/thank\s+you\s+for\s+your\s+(email|message|note)/i.test(content)) acknowledgments++;
    if (/how\s+(are|was|is)|hope\s+you|weekend|family/i.test(content)) personalTouches++;
    if (/perhaps|maybe|possibly|might|could/i.test(content)) hedging++;
    if (/<b>|<strong>|[A-Z]{4,}|!{2,}/i.test(content)) emphasis++;
    
    const exclamationMatches = content.match(/!/g);
    if (exclamationMatches) exclamations += exclamationMatches.length;
    
    const questionMatches = content.match(/\?/g);
    if (questionMatches) questions += questionMatches.length;
    
    if (/—|–|-{2,}/.test(content)) dashes++;
    if (/\.{3,}/.test(content)) ellipsis++;
  });
  
  const emailCount = emails.length;
  
  return {
    usesAcknowledgments: acknowledgments / emailCount > 0.3,
    usesPersonalTouches: personalTouches / emailCount > 0.2,
    usesHedging: hedging / emailCount > 0.4,
    usesEmphasis: emphasis / emailCount > 0.2,
    exclamationFrequency: (exclamations / emailCount) * 100,
    questionFrequency: (questions / emailCount) * 100,
    dashUsage: dashes / emailCount > 0.1,
    ellipsisUsage: ellipsis / emailCount > 0.05,
  };
}

function extractAvoidPhrases(emails: Message[]): string[] {
  // Common professional phrases that this user never uses
  const commonPhrases = [
    "as per our discussion",
    "please be advised",
    "for your consideration",
    "at your earliest convenience",
    "please do the needful",
    "with all due respect",
    "it has come to my attention",
    "going forward",
    "circle back",
    "touch base",
    "reach out",
    "bandwidth",
    "synergy",
  ];
  
  const emailContent = emails.map(e => e.body?.content || '').join(' ').toLowerCase();
  
  return commonPhrases.filter(phrase => 
    !emailContent.includes(phrase.toLowerCase())
  );
}

function extractSignaturePhrases(emails: Message[]): string[] {
  const phrases = new Map<string, number>();
  
  emails.forEach(email => {
    const content = email.body?.content || '';
    const words = content.toLowerCase().split(/\s+/);
    
    // Extract 3-5 word phrases
    for (let len = 3; len <= 5; len++) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(' ');
        if (phrase.length > 10 && !phrase.match(/^(the|and|for|that|this)/)) {
          phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
        }
      }
    }
  });
  
  // Return phrases that appear in at least 10% of emails
  const threshold = emails.length * 0.1;
  return Array.from(phrases.entries())
    .filter(([_, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase);
}

function determineTypicalLength(emails: Message[]): string {
  const lengths = emails.map(email => {
    const content = email.body?.content || '';
    return content.replace(/<[^>]*>/g, '').trim().split(/\s+/).length;
  });
  
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  
  if (avgLength < 50) return "brief";
  if (avgLength < 200) return "moderate";
  return "detailed";
}

// Store enhanced profile
export const storeEnhancedProfile = internalMutation({
  args: {
    userId: v.id("users"),
    profile: enhancedToneProfile,
  },
  handler: async (ctx, args) => {
    // This would be stored in a new table or extend the existing userWritingStyles
    console.log("Storing enhanced tone profile for user:", args.userId);
    // Implementation would save to database
  },
});