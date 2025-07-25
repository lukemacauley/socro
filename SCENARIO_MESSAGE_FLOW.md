# Scenario Message Flow - Visual Guide

## Typical Scenario Thread Lifecycle

```
Thread (type: "scenario", scenarioId: "corp_acquisition_01")
│
├── Message 1: System (messageSubtype: "scenario_prompt")
│   "You represent TechCo in acquiring StartupAI. During due diligence,
│    you discover StartupAI has been using open-source code that may
│    violate GPL licenses in their proprietary product..."
│   [Attachments: Due diligence report, License analysis]
│
├── Message 2: User (messageSubtype: "user_analysis", attemptNumber: 1)
│   "I would first assess the scope of GPL contamination by..."
│   [Time spent: 18 minutes]
│
├── Message 3: System (messageSubtype: "followup_question")
│   "Good start. How would you address the potential impact on 
│    TechCo's own proprietary codebase post-acquisition?"
│
├── Message 4: User (messageSubtype: "user_analysis", attemptNumber: 1)
│   "We need to implement a clean room approach..."
│   [Time spent: 7 minutes]
│
├── Message 5: System (messageSubtype: "ai_feedback")
│   "Your analysis shows strong understanding of IP issues.
│    Consider also the warranty and indemnification implications."
│
├── Message 6: User (messageSubtype: "user_analysis", attemptNumber: 2)
│   "Revised approach: 1) Immediate code audit... 2) Warranty negotiations..."
│   [Time spent: 12 minutes] [isSuperseded: false]
│
├── Message 7: System (messageSubtype: "ai_evaluation")
│   "Final Evaluation:
│    - Legal Analysis: 87/100 (Comprehensive IP risk assessment)
│    - Lateral Thinking: 92/100 (Creative clean room solution)
│    - Business Acumen: 78/100 (Could explore insurance options)
│    - Communication: 90/100 (Clear, structured response)
│    - Efficiency: 85/100 (37 minutes total)
│    
│    Overall Score: 86.4/100 (Weighted)
│    Rank: 12/156 in your cohort this week"
│   [Creates: Evaluation record, Updates: UserProgress]
│
├── Message 8: User (messageSubtype: "reflection")
│   "I should have considered rep & warranty insurance earlier..."
│
└── Message 9: Peer User (messageSubtype: "peer_review")
    "Great point about the clean room. In my experience at BigLaw,
     we also create an IP escrow for these situations..."
    [Creates: PeerReview record]
```

## Message Subtypes and Their Purposes

### System-Generated Messages

1. **scenario_prompt**: Initial case presentation
   - Rich context with business situation
   - May include attachments (contracts, reports, etc.)
   - Sets time expectations and difficulty level

2. **ai_hint**: Gentle guidance when user is stuck
   - "Consider the regulatory implications..."
   - "What precedent cases might apply here?"
   - Reduces points slightly when used

3. **followup_question**: Probing deeper thinking
   - Tests specific aspects user might have missed
   - Encourages more thorough analysis
   - Can lead to bonus points for good answers

4. **ai_feedback**: Intermediate coaching
   - Positive reinforcement of good insights
   - Gentle correction of misconceptions
   - Suggestions for improvement

5. **ai_evaluation**: Final scoring and analysis
   - Detailed breakdown by skill dimension
   - Specific strengths and improvements
   - Peer comparison and ranking

### User-Generated Messages

1. **user_analysis**: Main legal analysis responses
   - Can have multiple attempts
   - Each attempt is evaluated
   - Later attempts can supersede earlier ones

2. **reflection**: Self-assessment post-evaluation
   - What they learned
   - What they'd do differently
   - Earns small XP bonus

### Peer Interaction Messages

1. **peer_review**: Feedback from other associates
   - Can be anonymous or attributed
   - Rated for helpfulness
   - Top reviewers earn "Mentor" badges

## Evaluation Flow

```
User submits analysis
        ↓
AI evaluates message
        ↓
Creates Evaluation record with:
- Detailed scores (5 dimensions)
- Strengths/improvements
- Missed issues
- Time metrics
        ↓
Updates UserProgress:
- XP and points
- Skill levels
- Practice area expertise
        ↓
Checks Achievements:
- First perfect score?
- 10-day streak?
- Top 10% finish?
        ↓
Updates Leaderboards:
- Daily rankings
- Practice area rankings
- Cohort comparisons
```

## Progressive Difficulty Example

### Junior Associate Path
1. **Single-Issue Scenarios** → Basic contract review
2. **Multi-Issue Scenarios** → Contract with regulatory concerns
3. **Cross-Practice Scenarios** → M&A with IP and employment issues
4. **Strategic Scenarios** → Board-level advisory with multiple stakeholders

### Unlocking System
- Complete 5 corporate scenarios → Unlock "Complex M&A" series
- Score 90+ on regulatory → Unlock "Crisis Management" scenarios
- Maintain 7-day streak → Unlock "Partner's Challenge" weekly scenario

This flow maintains engaging conversation while building comprehensive assessment data for both associates and partners.