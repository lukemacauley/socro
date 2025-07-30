import { v } from "convex/values";
import { internalAction } from "./_generated/server";

// Single deep Socratic questions by topic - designed to challenge and probe
const demoQuestions: Record<string, string[]> = {
  commercial_lease_subletting: [
    "If the landlord's 'reasonable' refusal is later deemed unreasonable by a court, but the tenant has already lost the subtenant opportunity, what remedy truly makes the tenant whole—and does the statutory framework adequately address this temporal mismatch?",
    "When drafting a consent clause that balances landlord protection with tenant flexibility, how do you reconcile the inherent tension between objective criteria (which may be gamed) and subjective standards (which invite litigation)?",
    "Given that 'reasonableness' is judged at the time of refusal, not with hindsight, how would you advise a landlord who suspects—but cannot yet prove—that a proposed subtenant poses risks?"
  ],
  employment_dismissal: [
    "If an employer genuinely believes misconduct occurred based on reasonable investigation, but new evidence later proves innocence, does the Burchell test's focus on process over truth create a moral hazard—and how should you counsel a client wrestling with this dissonance?",
    "When distinguishing between conduct that warrants summary dismissal versus progressive discipline, what framework would you apply to determine where dishonesty crosses from correctable behavior to irreparable breach of trust?",
    "Given that procedural fairness can validate substantively harsh outcomes, how do you advise a client who wants to 'do the right thing' when the law permits—even rewards—a more cynical approach?"
  ],
  contract_disputes: [
    "When parties exchange drafts with conflicting terms but proceed to performance without formal agreement, at what precise moment does their conduct crystallize into a binding contract—and whose terms govern?",
    "If consideration can be nominal but not illusory, how do you distinguish between a peppercorn that validates a bargain and a promise so contingent it vitiates the agreement entirely?",
    "When does legitimate pre-contractual negotiation cross into promissory estoppel territory, and how would you identify that boundary before your client inadvertently crosses it?",
    "If both parties' subjective intentions differed from the contract's objective meaning, but they performed harmoniously for years based on their shared misunderstanding, which reality should prevail when dispute finally arises?",
    "When assessing whether a breach goes to the root of the contract, how do you distinguish between a term whose violation merely disappoints commercial expectations versus one that eviscerates the bargain's foundation?"
  ],
  default: [
    "What unstated assumption in your legal analysis, if incorrect, would most fundamentally alter your conclusion—and how would you test that assumption?",
    "If you had to argue the opposite position with equal vigor, what would be your strongest point—and what does that reveal about your current stance?",
    "When the law provides a clear answer that produces an unjust result, how do you counsel a client torn between legal permissibility and ethical obligation?"
  ],
};

// Keywords to identify topics
const topicKeywords: Record<string, string[]> = {
  commercial_lease_subletting: [
    "lease",
    "sublet",
    "subletting",
    "tenant",
    "landlord",
    "consent",
    "commercial property",
  ],
  employment_dismissal: [
    "dismissal",
    "employment",
    "termination",
    "fired",
    "redundancy",
    "misconduct",
    "disciplinary",
  ],
  contract_disputes: [
    "contract",
    "breach",
    "agreement",
    "terms",
    "dispute",
    "performance",
    "damages",
  ],
};

export const getRelevantQuestions = internalAction({
  args: {
    userMessage: v.string(),
    conversationContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const message = args.userMessage.toLowerCase();

    // Determine topic based on keywords
    let selectedTopic = "default";
    let highestMatchCount = 0;

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      const matchCount = keywords.filter((keyword) =>
        message.includes(keyword)
      ).length;
      if (matchCount > highestMatchCount) {
        highestMatchCount = matchCount;
        selectedTopic = topic;
      }
    }

    // Get questions for the topic
    const questions = demoQuestions[selectedTopic] || demoQuestions.default;

    // Select ONE deep question randomly from the pool
    const selectedQuestion = questions[Math.floor(Math.random() * questions.length)];

    // Return single question (in array for compatibility)
    return {
      topic: selectedTopic,
      questions: [selectedQuestion],
      allQuestions: questions,
    };
  },
});
