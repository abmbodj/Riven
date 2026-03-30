# Skills Tracking

> **Status:** Planned | **Priority:** Medium | **Effort:** XL (2-4 weeks) | **Alpha-Critical:** No

## Summary

A new feature where Riven AI infers competency skills from completed assignments and study activity. Skills are displayed on the user's profile as badges/chips with proficiency levels. LinkedIn CSV export enables resume building. Behavioral interview prep uses AI-generated questions with STAR method feedback. This is the "Riven helps your career, not just your grades" narrative — strong for capstone and differentiation.

## Current State Audit

### Relevant Existing Infrastructure
| What | Where | Status |
|---|---|---|
| Assignment completion | `ClassView.jsx` — toggle complete | Working |
| Class names + subjects | `classes` table: `name`, `color` | Populated |
| Linked decks per class | `class_decks` junction table | Working |
| AI generation pattern | `server/routes/ai.js` — Gemini calls | Working pattern |
| AI rate limiting | `supabase/functions/ai-limits` | Working |
| User profile | `client/src/pages/Account.jsx`, `EditProfile.jsx` | Working |
| Public profile | `client/src/pages/UserProfile.jsx` | Working |

### What's Missing
- No skill inference or tracking
- No profile skills section
- No LinkedIn export
- No interview prep feature

## Data Model

### New Table: `skills`
```sql
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT, -- e.g. "Computer Science", "Mathematics"
  proficiency INTEGER DEFAULT 1 CHECK (proficiency BETWEEN 1 AND 5),
  source TEXT DEFAULT 'ai_inferred' CHECK (source IN ('ai_inferred', 'manual')),
  evidence_count INTEGER DEFAULT 1, -- number of assignments that contributed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);
```

### New Table: `interview_sessions`
```sql
CREATE TABLE interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  user_answer TEXT,
  ai_feedback TEXT,
  score INTEGER CHECK (score BETWEEN 1 AND 5),
  practiced_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Feature Spec

### 1. Skill Inference (AI)

**Trigger:** When an assignment is marked complete in ClassView.

**Flow:**
1. User marks assignment complete
2. Client sends: `POST /api/skills/infer`
3. Payload: `{ assignment_title, class_name, existing_skills[] }`
4. Server: Gemini prompt extracts 1-3 skill names

**Gemini Prompt:**
```
You are analyzing a completed university assignment to infer skills developed.

Class: {class_name}
Assignment: {assignment_title}
Existing skills: {existing_skills}

Extract 1-3 specific, professional skills this assignment likely developed.
Return JSON: [{ "name": "Skill Name", "category": "Field" }]

Rules:
- Be specific: "Binary Search Trees" not "Programming"
- Use industry-standard terminology
- Don't duplicate existing skills — return only NEW skills
- Categories: Computer Science, Mathematics, Writing, Research, etc.
```

**Rate limit:** Same as existing AI limits (free tier = 5/day, Pro = unlimited).

**Background processing:** Don't block the assignment completion flow. Fire-and-forget with a toast: "Analyzing skills developed..." -> "New skill: Binary Search Trees"

### 2. Skills Profile Section

**Location:** `Account.jsx` — new "Skills" section after bio.

**Also visible on:** `UserProfile.jsx` (public profile, read-only).

```
┌──────────────────────────────────┐
│  Skills                          │
│                                  │
│  Computer Science                │
│  [Data Structures ●●●●○]        │
│  [Algorithms ●●●○○]             │
│  [Python ●●●●●]                 │
│                                  │
│  Mathematics                     │
│  [Linear Algebra ●●●○○]         │
│  [Calculus ●●○○○]               │
│                                  │
│  [+ Add Skill]  [Export →]       │
└──────────────────────────────────┘
```

**Chip design:**
- `rounded-full border border-claude-border/50 px-3 py-1.5`
- Skill name: `text-xs font-mono uppercase tracking-wider`
- Proficiency dots: 5 circles, filled = `bg-claude-accent`, empty = `bg-claude-border/30`
- Grouped by category with category heading

**Interactions:**
- Tap chip: opens edit popover (adjust proficiency 1-5, delete, view evidence count)
- "+ Add Skill": text input + category dropdown + proficiency slider
- "Export": generates LinkedIn CSV

### 3. LinkedIn CSV Export

**Button:** "Export to LinkedIn" in Skills section.

**CSV format:**
```csv
Skill,Proficiency,Category
Data Structures,Advanced,Computer Science
Algorithms,Intermediate,Computer Science
Linear Algebra,Intermediate,Mathematics
```

**Proficiency mapping:**
| Level | Label |
|---|---|
| 1 | Beginner |
| 2 | Elementary |
| 3 | Intermediate |
| 4 | Advanced |
| 5 | Expert |

**Implementation:**
- Client-side CSV generation (no server needed)
- `Blob` + `URL.createObjectURL` + `<a download>`
- Filename: `riven-skills-{username}-{date}.csv`

**Future (Phase 2):** LinkedIn API OAuth for direct skill sync (requires LinkedIn Developer approval).

### 4. Behavioral Interview Prep

**Entry point:** Per-skill "Practice" button on the skills chip, or dedicated `/interview-prep` page.

**Flow:**
```
┌──────────────────────────────────┐
│  Interview Prep: Data Structures │
│                                  │
│  "Tell me about a time you had   │
│   to choose between different    │
│   data structures to optimize    │
│   performance."                  │
│                                  │
│  ┌────────────────────────────┐  │
│  │ Your answer...             │  │
│  │                            │  │
│  │                            │  │
│  └────────────────────────────┘  │
│              or                  │
│  [Record Audio Answer]           │
│                                  │
│  [Submit for Feedback]           │
└──────────────────────────────────┘
```

**After submission:**
```
┌──────────────────────────────────┐
│  AI Feedback                     │
│                                  │
│  STAR Analysis:                  │
│  ✓ Situation: Clear context      │
│  ✓ Task: Well-defined            │
│  △ Action: Could be more specific│
│  ✓ Result: Quantified outcome    │
│                                  │
│  Score: ●●●●○ (4/5)             │
│                                  │
│  Suggestion: "Try to include     │
│  specific metrics or outcomes    │
│  when describing your actions."  │
│                                  │
│  [Try Another Question]          │
└──────────────────────────────────┘
```

**Gemini prompt for question generation:**
```
Generate a behavioral interview question for a student
skilled in {skill_name} ({category}).
The question should use the "Tell me about a time..." format.
Difficulty: {entry|mid|senior}
Return: { "question": "..." }
```

**Gemini prompt for answer evaluation:**
```
Evaluate this behavioral interview answer using the STAR method.

Question: {question}
Answer: {answer}
Skill: {skill_name}

Rate each STAR component (1-5):
- Situation: Did they set clear context?
- Task: Did they define their responsibility?
- Action: Did they describe specific actions taken?
- Result: Did they quantify the outcome?

Return JSON: {
  situation: { score: N, feedback: "..." },
  task: { score: N, feedback: "..." },
  action: { score: N, feedback: "..." },
  result: { score: N, feedback: "..." },
  overall_score: N,
  suggestion: "..."
}
```

**Audio input:** Reuse `FloatingRecordingWidget` pattern + existing audio transcription pipeline from note enhancement.

## API Endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/skills/infer` | Infer skills from completed assignment |
| `GET` | `/api/skills` | List user's skills |
| `POST` | `/api/skills` | Manually add a skill |
| `PUT` | `/api/skills/:id` | Update proficiency |
| `DELETE` | `/api/skills/:id` | Remove a skill |
| `POST` | `/api/skills/:id/interview` | Generate interview question |
| `POST` | `/api/skills/:id/interview/evaluate` | Evaluate answer |
| `GET` | `/api/skills/:id/interview/history` | Past practice sessions |

## Component Tree

```
SkillsSection (in Account.jsx)
├── SkillCategoryGroup[]
│   ├── CategoryHeading
│   └── SkillChip[]
│       ├── SkillName
│       ├── ProficiencyDots
│       └── SkillEditPopover (on tap)
├── AddSkillModal
└── ExportButton

InterviewPrepPage (or modal)
├── QuestionCard
├── AnswerInput (textarea or audio recorder)
├── SubmitButton
└── FeedbackCard
    ├── STARBreakdown
    ├── OverallScore
    └── SuggestionText
```

## Files to Create / Modify

| File | Change |
|------|--------|
| `client/src/components/skills/SkillsSection.jsx` | **New** — skills display + management |
| `client/src/components/skills/SkillChip.jsx` | **New** — individual skill badge |
| `client/src/components/skills/AddSkillModal.jsx` | **New** — manual skill creation |
| `client/src/components/skills/InterviewPrep.jsx` | **New** — interview practice UI |
| `client/src/pages/Account.jsx` | Add SkillsSection after bio |
| `client/src/pages/UserProfile.jsx` | Add read-only SkillsSection |
| `client/src/pages/ClassView.jsx` | Trigger skill inference on assignment complete |
| `server/routes/skills.js` | **New** — skills CRUD + AI inference + interview |
| `supabase/migrations/` | Add `skills` + `interview_sessions` tables |

## Acceptance Criteria

- [ ] Marking assignment complete triggers background skill inference
- [ ] Inferred skills appear as chips on profile with proficiency dots
- [ ] Skills grouped by category (Computer Science, Mathematics, etc.)
- [ ] Tap chip opens edit popover with proficiency slider + delete
- [ ] Manual "Add Skill" works with name, category, proficiency inputs
- [ ] LinkedIn CSV export downloads correctly formatted file
- [ ] Interview prep generates relevant behavioral questions per skill
- [ ] Answer evaluation returns STAR method breakdown with scores
- [ ] Audio answer input works (reuses existing recording infrastructure)
- [ ] Rate limited: same as existing AI limits
- [ ] Skills visible on public profile (read-only)
- [ ] `prefers-reduced-motion` disables chip mount animations

## Phased Rollout

- **Alpha:** Skill inference + profile display only (manual add + auto-infer)
- **v1.0:** LinkedIn CSV export
- **v1.1:** Behavioral interview prep with STAR feedback
- **v2.0:** LinkedIn API OAuth direct sync, interview history analytics
