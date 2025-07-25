# Legal Mentorship Platform - Detailed Schema Design

## Core Concept: Leverage Existing Thread/Message Structure

Scenarios are special types of threads where messages flow back and forth between the AI mentor and associate. This maintains conversational learning while adding assessment layers.

## Schema Implementation

### 1. Extend Existing Tables

```typescript
// Extend threads table
threads: defineTable({
  // ... existing fields ...
  type: v.union(v.literal("chat"), v.literal("email"), v.literal("scenario")),
  
  // For scenario threads only
  scenarioId: v.optional(v.id("scenarios")),
  completionStatus: v.optional(v.union(
    v.literal("not_started"),
    v.literal("in_progress"),
    v.literal("completed"),
    v.literal("abandoned")
  )),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  currentPhase: v.optional(v.string()), // "initial_response", "clarification", "final_submission"
})

// Extend messages table
messages: defineTable({
  // ... existing fields ...
  
  // For scenario messages
  messageSubtype: v.optional(v.union(
    v.literal("scenario_prompt"),      // Initial scenario presentation
    v.literal("user_analysis"),        // User's legal analysis
    v.literal("ai_hint"),             // Hint from AI mentor
    v.literal("ai_feedback"),         // Feedback on response
    v.literal("ai_evaluation"),       // Final scoring/evaluation
    v.literal("followup_question"),   // AI asking for clarification
    v.literal("peer_review"),         // Another user's review
    v.literal("reflection")           // User's self-reflection
  )),
  
  // Link to evaluation if this message has been scored
  evaluationId: v.optional(v.id("evaluations")),
  
  // For tracking iterations
  attemptNumber: v.optional(v.number()),
  isSuperseded: v.optional(v.boolean()), // True if user provided updated answer
})
```

### 2. New Core Tables

```typescript
// Scenario definitions
scenarios: defineTable({
  title: v.string(),
  description: v.string(),
  practiceArea: v.union(
    v.literal("corporate"),
    v.literal("litigation"),
    v.literal("regulatory"),
    v.literal("ip"),
    v.literal("employment"),
    v.literal("real_estate"),
    v.literal("tax"),
    v.literal("cross_practice")
  ),
  difficulty: v.number(), // 1-10
  estimatedMinutes: v.number(),
  
  // Scenario configuration
  promptTemplate: v.string(), // The initial scenario text
  contextDocuments: v.optional(v.array(v.id("messageAttachments"))), // Related docs
  
  // Evaluation criteria specific to this scenario
  scoringRubric: v.object({
    legalAnalysisWeight: v.number(),
    lateralThinkingWeight: v.number(),
    businessAcumenWeight: v.number(),
    communicationWeight: v.number(),
    efficiencyWeight: v.number(),
    
    // Specific things to look for
    keyIssues: v.array(v.string()),
    bonusInsights: v.array(v.string()),
    commonMistakes: v.array(v.string()),
  }),
  
  // Gamification
  basePoints: v.number(),
  bonusPointsAvailable: v.number(),
  
  // Control flow
  allowsHints: v.boolean(),
  maxAttempts: v.number(),
  allowsIteration: v.boolean(), // Can improve answer based on feedback
  
  // Prerequisites
  prerequisiteScenarioIds: v.optional(v.array(v.id("scenarios"))),
  minimumLevelRequired: v.optional(v.number()),
  
  // Metadata
  authorUserId: v.id("users"), // Partner who created it
  isActive: v.boolean(),
  tags: v.array(v.string()),
})

// Evaluations for specific message responses
evaluations: defineTable({
  messageId: v.id("messages"),
  userId: v.id("users"),
  scenarioId: v.id("scenarios"),
  threadId: v.id("threads"),
  
  // Raw scores
  scores: v.object({
    legalAnalysis: v.number(),      // 0-100
    lateralThinking: v.number(),    // 0-100
    businessAcumen: v.number(),     // 0-100
    communication: v.number(),       // 0-100
    efficiency: v.number(),         // 0-100
  }),
  
  // Calculated scores
  weightedScore: v.number(),        // Based on scenario rubric
  percentileRank: v.optional(v.number()), // Among peers
  
  // Detailed feedback
  strengths: v.array(v.string()),
  improvements: v.array(v.string()),
  missedIssues: v.array(v.string()),
  
  // AI evaluation metadata
  evaluationModel: v.string(),      // "gpt-4", "claude-3", etc.
  evaluationPrompt: v.string(),     // For debugging/consistency
  confidenceScore: v.number(),      // AI's confidence in evaluation
  
  // Timing
  timeToFirstResponse: v.number(), // seconds
  totalTimeSpent: v.number(),      // seconds
  evaluatedAt: v.number(),
})

// User progress and gamification
userProgress: defineTable({
  userId: v.id("users"),
  
  // Overall stats
  level: v.number(),
  totalXP: v.number(),
  totalPoints: v.number(),
  
  // Streaks
  currentStreak: v.number(),
  longestStreak: v.number(),
  lastActivityDate: v.number(),
  
  // Completion stats
  scenariosCompleted: v.number(),
  scenariosAbandoned: v.number(),
  averageScore: v.number(),
  
  // Skill progression
  skillLevels: v.object({
    legalAnalysis: v.number(),
    lateralThinking: v.number(),
    businessAcumen: v.number(),
    communication: v.number(),
    efficiency: v.number(),
  }),
  
  // Practice area expertise
  practiceAreaXP: v.object({
    corporate: v.number(),
    litigation: v.number(),
    regulatory: v.number(),
    ip: v.number(),
    employment: v.number(),
    real_estate: v.number(),
    tax: v.number(),
  }),
})

// Achievements and badges
achievements: defineTable({
  name: v.string(),
  description: v.string(),
  iconUrl: v.string(),
  
  // Achievement criteria
  criteriaType: v.union(
    v.literal("scenarios_completed"),
    v.literal("streak_days"),
    v.literal("perfect_scores"),
    v.literal("skill_threshold"),
    v.literal("special_recognition")
  ),
  criteriaValue: v.number(),
  
  // Rarity/prestige
  tier: v.union(
    v.literal("bronze"),
    v.literal("silver"),
    v.literal("gold"),
    v.literal("platinum"),
    v.literal("legendary")
  ),
  
  pointsAwarded: v.number(),
})

// User achievements (junction table)
userAchievements: defineTable({
  userId: v.id("users"),
  achievementId: v.id("achievements"),
  earnedAt: v.number(),
  scenarioId: v.optional(v.id("scenarios")), // If earned from specific scenario
})

// Leaderboards (pre-aggregated for performance)
leaderboards: defineTable({
  period: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("all_time")),
  practiceArea: v.optional(v.string()), // null for overall
  cohortYear: v.optional(v.number()),   // For year-group comparisons
  
  entries: v.array(v.object({
    userId: v.id("users"),
    rank: v.number(),
    score: v.number(),
    movement: v.number(), // +2, -1, etc. from previous period
  })),
  
  updatedAt: v.number(),
})

// Analytics events for detailed tracking
analyticsEvents: defineTable({
  userId: v.id("users"),
  eventType: v.string(),
  eventData: v.object({
    scenarioId: v.optional(v.id("scenarios")),
    threadId: v.optional(v.id("threads")),
    messageId: v.optional(v.id("messages")),
    score: v.optional(v.number()),
    timeSpent: v.optional(v.number()),
    metadata: v.optional(v.any()),
  }),
  timestamp: v.number(),
})

// Peer reviews
peerReviews: defineTable({
  evaluationId: v.id("evaluations"),
  reviewerUserId: v.id("users"),
  reviewedUserId: v.id("users"),
  
  ratings: v.object({
    insightfulness: v.number(),     // 1-5
    clarity: v.number(),            // 1-5
    thoroughness: v.number(),       // 1-5
    creativity: v.number(),         // 1-5
  }),
  
  comments: v.optional(v.string()),
  helpful: v.optional(v.boolean()), // Did reviewed user find it helpful?
  
  createdAt: v.number(),
})
```

### 3. Message Flow Example

```typescript
// Scenario Thread Creation
1. System creates thread (type: "scenario")
2. System sends first message (messageSubtype: "scenario_prompt")
   - Contains the scenario description
   - May attach relevant documents

// User Interaction Loop
3. User sends message (messageSubtype: "user_analysis")
   - Their legal analysis response
   
4. System evaluates and responds with:
   a. AI Hint (messageSubtype: "ai_hint") - if struggling
   b. Follow-up Question (messageSubtype: "followup_question") - for clarification
   c. AI Feedback (messageSubtype: "ai_feedback") - intermediate feedback
   
5. User can iterate (messageSubtype: "user_analysis", attemptNumber: 2)

// Completion
6. System sends final evaluation (messageSubtype: "ai_evaluation")
   - Creates evaluation record
   - Updates user progress
   - Awards achievements
   
7. Optional: Peer reviews added as messages (messageSubtype: "peer_review")
```

### 4. Key Design Decisions

1. **Thread-Based Architecture**
   - Preserves conversation history
   - Enables natural mentorship dialogue
   - Allows for hints, clarifications, iterations

2. **Evaluation Tracking**
   - Each substantive response gets evaluated
   - Tracks improvement across attempts
   - Maintains detailed scoring breakdowns

3. **Flexible Scenario Design**
   - Configurable rubrics per scenario
   - Support for various practice areas
   - Prerequisites and progression paths

4. **Analytics-Ready**
   - Event tracking for all interactions
   - Pre-aggregated leaderboards for performance
   - Rich data for partner dashboards

5. **Peer Learning**
   - Reviews as part of message thread
   - Anonymous or attributed options
   - Gamification of helpful reviews

This schema design maintains the conversational nature of your existing app while adding robust assessment, gamification, and analytics capabilities for the legal mentorship use case.