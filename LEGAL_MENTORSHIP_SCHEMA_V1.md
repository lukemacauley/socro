# Legal Mentorship Platform - Simplified V1 Schema

## V1 Core Concept

- Every thread is a legal scenario
- Associates can upload documents as part of their analysis
- AI mentor evaluates responses and provides feedback
- Simple leaderboard tracks performance

## Schema Updates

### 1. Simplified Tables

```typescript
// Users table - add role
users: defineTable({
  name: v.string(),
  email: v.string(),
  clerkId: v.string(),
  imageUrl: v.optional(v.string()),
  createdAt: v.number(),
  lastActiveAt: v.optional(v.number()),
  role: v.union(
    v.literal("partner"),
    v.literal("associate"),
    v.literal("admin")
  ),
})
  .index("by_clerk_id", ["clerkId"])
  .index("by_email", ["email"]);

// Threads table - all threads are scenarios
threads: defineTable({
  threadId: v.string(), // UUID for instant client navigation
  userId: v.id("users"),

  // Scenario details
  title: v.string(),
  description: v.string(), // The scenario prompt
  practiceArea: v.string(), // "corporate", "litigation", etc.
  difficulty: v.number(), // 1-5

  // Status
  status: v.union(
    v.literal("active"), // In progress
    v.literal("completed"), // Evaluated
    v.literal("abandoned") // Started but not finished
  ),

  // Evaluation (once completed)
  evaluation: v.optional(
    v.object({
      scores: v.object({
        legalAnalysis: v.number(), // 0-100
        lateralThinking: v.number(), // 0-100
        overallQuality: v.number(), // 0-100
      }),
      totalScore: v.number(),
      feedback: v.string(),
      strengths: v.array(v.string()),
      improvements: v.array(v.string()),
      timeSpent: v.number(), // minutes
      evaluatedAt: v.number(),
    })
  ),

  startedAt: v.number(),
  lastActivityAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .index("by_user_id", ["userId"])
  .index("by_status", ["status"])
  .index("by_client_thread_id", ["threadId"]);

// Messages - same as before but simplified
messages: defineTable({
  threadId: v.id("threads"),
  userId: v.id("users"),
  content: v.string(),
  role: v.union(v.literal("user"), v.literal("ai")),

  // Track if this is a key message
  isScenarioPrompt: v.optional(v.boolean()), // The initial scenario
  isUserResponse: v.optional(v.boolean()), // The main analysis
  isEvaluation: v.optional(v.boolean()), // The final evaluation

  createdAt: v.number(),
}).index("by_thread_id", ["threadId"]);

// Attachments - for documents in scenarios
messageAttachments: defineTable({
  messageId: v.id("messages"),
  threadId: v.id("threads"),
  userId: v.id("users"),
  storageId: v.id("_storage"),
  name: v.string(),
  contentType: v.string(),
  size: v.number(),

  // For parsed content
  parsedContent: v.optional(v.string()),
  metadata: v.optional(
    v.object({
      pageCount: v.optional(v.number()),
      documentType: v.optional(v.string()), // "contract", "memo", etc.
    })
  ),

  uploadedAt: v.number(),
})
  .index("by_message_id", ["messageId"])
  .index("by_thread_id", ["threadId"]);

// Scenario templates for creating new scenarios
scenarioTemplates: defineTable({
  title: v.string(),
  description: v.string(), // The scenario prompt text
  practiceArea: v.string(),
  difficulty: v.number(),

  // Expected time and docs
  estimatedMinutes: v.number(),
  suggestedDocuments: v.optional(v.array(v.string())), // "draft contract", "term sheet", etc.

  // Template attachments (e.g., sample contracts)
  templateAttachments: v.optional(
    v.array(
      v.object({
        name: v.string(),
        storageId: v.id("_storage"),
      })
    )
  ),

  isActive: v.boolean(),
  tags: v.array(v.string()),
  createdByUserId: v.id("users"),
  createdAt: v.number(),
})
  .index("by_active", ["isActive"])
  .index("by_practice_area", ["practiceArea"]);

// User statistics
userStats: defineTable({
  userId: v.id("users"),
  scenariosCompleted: v.optional(v.number()),
  scenariosStarted: v.optional(v.number()),
  totalPoints: v.optional(v.number()),
  averageScore: v.optional(v.number()),
  currentStreak: v.optional(v.number()),
  bestStreak: v.optional(v.number()),
})
  .index("by_total_points", ["totalPoints"])
  .index("by_user_id", ["userId"]);
```

## Scenario Flow

```
1. Associate browses scenario templates
2. Selects scenario → Creates new thread
3. System sends scenario prompt (with any template attachments)
4. Associate analyzes and responds
   - Can upload supporting documents
   - Can reference attached materials
5. AI evaluates the response
6. Thread marked complete with scores
7. Stats and rankings updated
```

## Example Implementation

```typescript
// Start a new scenario
async function startScenario(ctx, templateId, userId) {
  const template = await ctx.db.get(templateId);

  // Create thread
  const threadId = generateUUID();
  const thread = await ctx.db.insert("threads", {
    threadId,
    userId,
    title: template.title,
    description: template.description,
    practiceArea: template.practiceArea,
    difficulty: template.difficulty,
    status: "active",
    startedAt: Date.now(),
    lastActivityAt: Date.now(),
  });

  // Send scenario prompt with attachments
  const message = await ctx.db.insert("messages", {
    threadId: thread,
    userId: systemUserId,
    content: template.description,
    role: "ai",
    isScenarioPrompt: true,
    createdAt: Date.now(),
  });

  // Attach any template documents
  if (template.templateAttachments) {
    for (const attachment of template.templateAttachments) {
      await ctx.db.insert("messageAttachments", {
        messageId: message,
        threadId: thread,
        userId: systemUserId,
        storageId: attachment.storageId,
        name: attachment.name,
        contentType: "application/pdf",
        size: 0, // Set from storage
        uploadedAt: Date.now(),
      });
    }
  }

  return thread;
}

// User submits response with documents
async function submitResponse(ctx, threadId, content, attachments) {
  const message = await ctx.db.insert("messages", {
    threadId,
    userId,
    content,
    role: "user",
    isUserResponse: true,
    createdAt: Date.now(),
  });

  // Handle document uploads
  for (const file of attachments) {
    const storageId = await ctx.storage.upload(file);
    await ctx.db.insert("messageAttachments", {
      messageId: message,
      threadId,
      userId,
      storageId,
      name: file.name,
      contentType: file.type,
      size: file.size,
      uploadedAt: Date.now(),
    });
  }

  // Trigger evaluation
  await evaluateScenario(ctx, threadId);
}
```

## Key Benefits of This Approach

1. **Focused Purpose**: Every interaction is a learning scenario
2. **Document Integration**: Natural support for contract reviews, memo analysis
3. **Simple Mental Model**: One thread = one scenario
4. **Clean History**: Easy to review past scenarios and performance
5. **Existing UI Reuse**: Can adapt current chat interface

## V1 Features

✅ Browse scenario library  
✅ Start and complete scenarios  
✅ Upload and analyze documents  
✅ AI evaluation with detailed feedback  
✅ Performance tracking and rankings  
✅ Practice area specialization  
✅ Partner dashboard for talent insights

## Removed Complexity

❌ Email integration  
❌ Multiple thread types  
❌ Complex message subtypes  
❌ Peer reviews (can add later)  
❌ Achievements system (can add later)

This creates a focused legal training platform where every interaction is meaningful and measured.
