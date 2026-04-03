# Study Guide Overhaul — "Ultimate Study Coach" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform study guides from a passive document viewer into an active study coach with forced recall, smart session modes, weakness tracking, and inline editing.

**Architecture:** Two phases sharing a utility layer. Phase 1 adds new helpers to `studyGuides.js`, three new React components, and wires them into `GuideView.jsx` behind a `viewMode` state machine. Phase 2 adds inline editing and an improved AI prompt. No new backend endpoints or DB tables required — all new features build on existing `study_state` and `guide_data` schemas, with one new field (`last_reviewed_at` per section) added via the existing normalization layer.

**Tech Stack:** React 19, Vitest + React Testing Library, Tailwind CSS with `claude-*` design tokens, `motion/react` for animations, `lucide-react` for icons, existing `updateStudyGuide` API call for all persistence.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `client/src/utils/studyGuides.js` | Modify | Add `getWeakSections`, `getSessionSections`, `getSectionStatus`, `updateSection`; add `last_reviewed_at` to normalization |
| `client/src/utils/studyGuides.test.js` | Create | Unit tests for all new helpers |
| `client/src/components/StudySection.jsx` | Create | 3-step active recall flow (recall → answer+confidence → quiz) |
| `client/src/components/StudySection.test.jsx` | Create | Component tests |
| `client/src/components/GuideProgressDashboard.jsx` | Create | Per-section weakness breakdown + "Review Weak Sections" CTA |
| `client/src/components/GuideProgressDashboard.test.jsx` | Create | Component tests |
| `client/src/components/QuizMeMode.jsx` | Create | Rapid-fire quiz mode (all mini_quiz items, reveal + thumbs) |
| `client/src/components/QuizMeMode.test.jsx` | Create | Component tests |
| `client/src/components/SectionEditor.jsx` | Create | Inline v2 section editor (Phase 2) |
| `client/src/pages/GuideView.jsx` | Modify | Add `viewMode` state machine, session entry screen, wire all new components |

---

## Phase 1

---

### Task 1: Extend `studyGuides.js` with new helpers

**Files:**
- Modify: `client/src/utils/studyGuides.js`
- Create: `client/src/utils/studyGuides.test.js`

- [ ] **Step 1: Write failing tests**

Create `client/src/utils/studyGuides.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
    getSessionSections,
    getSectionStatus,
    getWeakSections,
    normalizeGuideStudyState,
    updateSection,
} from './studyGuides.js';

const makeGuideData = (overrides = []) => ({
    overview: 'Review before revealing.',
    sections: [
        {
            id: 'sec-1',
            title: 'Cell Structure',
            recall_prompt: 'Describe cell structure.',
            answer_points: ['Has a nucleus', 'Has a membrane'],
            key_terms: ['nucleus'],
            mini_quiz: [{ prompt: 'What contains DNA?', answer: 'Nucleus' }],
            common_traps: [],
        },
        {
            id: 'sec-2',
            title: 'Mitosis',
            recall_prompt: 'Explain mitosis.',
            answer_points: ['4 phases', 'Produces 2 daughter cells'],
            key_terms: ['mitosis'],
            mini_quiz: [],
            common_traps: ['Confusing mitosis with meiosis'],
        },
        {
            id: 'sec-3',
            title: 'Protein Synthesis',
            recall_prompt: 'Explain protein synthesis.',
            answer_points: ['Transcription', 'Translation'],
            key_terms: [],
            mini_quiz: [{ prompt: 'Where does translation occur?', answer: 'Ribosomes' }],
            common_traps: [],
        },
        ...overrides,
    ],
});

const makeStudyState = (sectionOverrides = {}) => ({
    current_section_id: 'sec-1',
    section_states: {
        'sec-1': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
        'sec-2': { revealed: true, confidence: 'need_work', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
        'sec-3': { revealed: false, confidence: null, completed: false, note: '', last_reviewed_at: null },
        ...sectionOverrides,
    },
    last_reviewed_at: new Date().toISOString(),
});

describe('normalizeGuideStudyState', () => {
    it('includes last_reviewed_at: null in default section state', () => {
        const state = normalizeGuideStudyState(makeGuideData(), {});
        expect(state.section_states['sec-1'].last_reviewed_at).toBe(null);
    });

    it('preserves last_reviewed_at when present', () => {
        const ts = '2026-03-01T10:00:00.000Z';
        const state = normalizeGuideStudyState(makeGuideData(), {
            section_states: { 'sec-1': { last_reviewed_at: ts } },
            last_reviewed_at: null,
        });
        expect(state.section_states['sec-1'].last_reviewed_at).toBe(ts);
    });
});

describe('getSectionStatus', () => {
    it('returns review_now for null confidence (unstudied)', () => {
        expect(getSectionStatus({ confidence: null }, null)).toBe('review_now');
    });

    it('returns review_now for need_work', () => {
        expect(getSectionStatus({ confidence: 'need_work' }, new Date().toISOString())).toBe('review_now');
    });

    it('returns coming_up for okay', () => {
        expect(getSectionStatus({ confidence: 'okay' }, new Date().toISOString())).toBe('coming_up');
    });

    it('returns good for know_it reviewed within 3 days', () => {
        expect(getSectionStatus({ confidence: 'know_it' }, new Date().toISOString())).toBe('good');
    });

    it('returns review_soon for know_it reviewed more than 3 days ago', () => {
        const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
        expect(getSectionStatus({ confidence: 'know_it' }, fourDaysAgo)).toBe('review_soon');
    });

    it('returns review_soon for know_it with no last_reviewed_at', () => {
        expect(getSectionStatus({ confidence: 'know_it' }, null)).toBe('review_soon');
    });
});

describe('getWeakSections', () => {
    it('returns sections with review_now or coming_up status', () => {
        const guideData = makeGuideData();
        const studyState = makeStudyState();
        const weak = getWeakSections(guideData, studyState);
        const weakIds = weak.map((s) => s.id);
        expect(weakIds).toContain('sec-2'); // need_work
        expect(weakIds).toContain('sec-3'); // unstudied
        expect(weakIds).not.toContain('sec-1'); // know_it + recent
    });

    it('returns empty array when guideData is null', () => {
        expect(getWeakSections(null, {})).toEqual([]);
    });
});

describe('getSessionSections', () => {
    it('fills time budget with highest-priority sections first', () => {
        const guideData = makeGuideData();
        const studyState = makeStudyState();
        // 5 min: sec-2 (need_work, no quiz = 3min) + sec-3 (unstudied, has quiz = 4min) → only sec-2 fits
        const sections5 = getSessionSections(guideData, studyState, 5);
        expect(sections5.map((s) => s.id)).toEqual(['sec-2']);

        // 10 min: sec-2 (3min) + sec-3 (4min) = 7min → both fit
        const sections10 = getSessionSections(guideData, studyState, 10);
        expect(sections10.map((s) => s.id)).toContain('sec-2');
        expect(sections10.map((s) => s.id)).toContain('sec-3');
    });

    it('returns empty array for null guideData', () => {
        expect(getSessionSections(null, {}, 10)).toEqual([]);
    });
});

describe('updateSection', () => {
    it('updates a section by id', () => {
        const guideData = makeGuideData();
        const updated = updateSection(guideData, 'sec-1', { title: 'Updated Title' });
        expect(updated.sections.find((s) => s.id === 'sec-1').title).toBe('Updated Title');
    });

    it('leaves other sections unchanged', () => {
        const guideData = makeGuideData();
        const updated = updateSection(guideData, 'sec-1', { title: 'X' });
        expect(updated.sections.find((s) => s.id === 'sec-2').title).toBe('Mitosis');
    });

    it('returns guideData unchanged when id not found', () => {
        const guideData = makeGuideData();
        const updated = updateSection(guideData, 'nonexistent', { title: 'X' });
        expect(updated.sections).toHaveLength(3);
    });
});
```

- [ ] **Step 2: Run tests — verify they all fail**

```bash
cd client && npx vitest run src/utils/studyGuides.test.js
```

Expected: failures — functions not exported yet.

- [ ] **Step 3: Add `last_reviewed_at` to `buildDefaultSectionState` and `normalizeGuideStudyState`**

In `client/src/utils/studyGuides.js`, find `buildDefaultSectionState` and update it:

```js
const buildDefaultSectionState = () => ({
    revealed: false,
    confidence: null,
    completed: false,
    note: '',
    last_reviewed_at: null,
});
```

In `normalizeGuideStudyState`, inside the `sections.map`, update the section state object to include `last_reviewed_at`:

```js
return [section.id, {
    revealed: Boolean(incoming.revealed),
    confidence: typeof incoming.confidence === 'string' ? incoming.confidence : null,
    completed: Boolean(incoming.completed),
    note: typeof incoming.note === 'string' ? incoming.note : '',
    last_reviewed_at: typeof incoming.last_reviewed_at === 'string' ? incoming.last_reviewed_at : null,
}];
```

- [ ] **Step 4: Add `getSectionStatus`, `getWeakSections`, `getSessionSections`, `updateSection` to `studyGuides.js`**

Add these exports at the end of `client/src/utils/studyGuides.js`:

```js
// Returns 'review_now' | 'coming_up' | 'good' | 'review_soon'
export const getSectionStatus = (sectionState, sectionLastReviewedAt) => {
    const confidence = sectionState?.confidence ?? null;
    if (!confidence) return 'review_now';
    if (confidence === 'need_work') return 'review_now';
    if (confidence === 'okay') return 'coming_up';
    if (confidence === 'know_it') {
        if (!sectionLastReviewedAt) return 'review_soon';
        const daysSince = (Date.now() - new Date(sectionLastReviewedAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince > 3 ? 'review_soon' : 'good';
    }
    return 'review_now';
};

export const getWeakSections = (guideData, studyState) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    const normalizedStudyState = normalizeGuideStudyState(guideData, studyState);
    if (!normalizedGuideData) return [];
    return normalizedGuideData.sections.filter((section) => {
        const sectionState = normalizedStudyState.section_states[section.id];
        const status = getSectionStatus(sectionState, sectionState?.last_reviewed_at ?? null);
        return status === 'review_now' || status === 'coming_up';
    });
};

const SECTION_PRIORITY = ['review_now', 'coming_up', 'review_soon', 'good'];
const MINUTES_PER_SECTION = 3;
const QUIZ_EXTRA_MINUTES = 1;

export const getSessionSections = (guideData, studyState, durationMinutes) => {
    const normalizedGuideData = normalizeGuideData(guideData);
    const normalizedStudyState = normalizeGuideStudyState(guideData, studyState);
    if (!normalizedGuideData) return [];

    const ranked = normalizedGuideData.sections
        .map((section) => {
            const sectionState = normalizedStudyState.section_states[section.id];
            const status = getSectionStatus(sectionState, sectionState?.last_reviewed_at ?? null);
            return { section, status, priority: SECTION_PRIORITY.indexOf(status) };
        })
        .sort((a, b) => a.priority - b.priority);

    const selected = [];
    let budget = durationMinutes;

    for (const { section } of ranked) {
        const hasQuiz = section.mini_quiz?.length > 0;
        const cost = MINUTES_PER_SECTION + (hasQuiz ? QUIZ_EXTRA_MINUTES : 0);
        if (budget >= cost) {
            selected.push(section);
            budget -= cost;
        }
        if (budget < MINUTES_PER_SECTION) break;
    }

    return selected;
};

export const updateSection = (guideData, sectionId, updates) => {
    const normalized = normalizeGuideData(guideData);
    if (!normalized) return guideData;
    return {
        ...normalized,
        sections: normalized.sections.map((section) => (
            section.id === sectionId ? { ...section, ...updates } : section
        )),
    };
};
```

- [ ] **Step 5: Run tests — verify they all pass**

```bash
cd client && npx vitest run src/utils/studyGuides.test.js
```

Expected: all tests pass.

- [ ] **Step 6: Also update `DEFAULT_SECTION_STATE` in `GuideView.jsx`**

In `client/src/pages/GuideView.jsx`, find:

```js
const DEFAULT_SECTION_STATE = {
    revealed: false,
    confidence: null,
    completed: false,
    note: '',
};
```

Replace with:

```js
const DEFAULT_SECTION_STATE = {
    revealed: false,
    confidence: null,
    completed: false,
    note: '',
    last_reviewed_at: null,
};
```

- [ ] **Step 7: Commit**

```bash
git add client/src/utils/studyGuides.js client/src/utils/studyGuides.test.js client/src/pages/GuideView.jsx
git commit -m "feat: add study guide session helpers (getWeakSections, getSessionSections, getSectionStatus, updateSection)"
```

---

### Task 2: Build `StudySection` component

**Files:**
- Create: `client/src/components/StudySection.jsx`
- Create: `client/src/components/StudySection.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `client/src/components/StudySection.test.jsx`:

```jsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StudySection from './StudySection.jsx';

const section = {
    id: 'sec-1',
    title: 'Protein Synthesis',
    recall_prompt: 'How does DNA become a protein?',
    answer_points: ['Transcription: DNA → mRNA', 'Translation: mRNA → protein'],
    common_traps: ['Confusing polymerase with ribosomes'],
    mini_quiz: [{ prompt: 'Where does translation occur?', answer: 'Ribosomes' }],
    key_terms: [],
};

const sectionNoQuiz = { ...section, mini_quiz: [] };

const defaultProps = {
    section,
    sectionState: { revealed: false, confidence: null, completed: false, note: '', last_reviewed_at: null },
    onReveal: vi.fn(),
    onConfidenceSelect: vi.fn(),
    onComplete: vi.fn(),
};

describe('StudySection', () => {
    it('starts on recall step — shows recall prompt and Show Answer button', () => {
        render(<StudySection {...defaultProps} />);
        expect(screen.getByTestId('study-section-recall')).toBeTruthy();
        expect(screen.getByText('How does DNA become a protein?')).toBeTruthy();
        expect(screen.getByText('Show Answer')).toBeTruthy();
    });

    it('advances to answer step when Show Answer is tapped', () => {
        const onReveal = vi.fn();
        render(<StudySection {...defaultProps} onReveal={onReveal} />);
        fireEvent.click(screen.getByText('Show Answer'));
        expect(onReveal).toHaveBeenCalledOnce();
        expect(screen.getByTestId('study-section-answer')).toBeTruthy();
        expect(screen.getByText('Transcription: DNA → mRNA')).toBeTruthy();
    });

    it('shows common_traps on answer step', () => {
        render(<StudySection {...defaultProps} />);
        fireEvent.click(screen.getByText('Show Answer'));
        expect(screen.getByText('Confusing polymerase with ribosomes')).toBeTruthy();
    });

    it('calls onConfidenceSelect and advances to quiz step when section has quiz', () => {
        const onConfidenceSelect = vi.fn();
        render(<StudySection {...defaultProps} onConfidenceSelect={onConfidenceSelect} />);
        fireEvent.click(screen.getByText('Show Answer'));
        fireEvent.click(screen.getByTestId('confidence-know_it'));
        expect(onConfidenceSelect).toHaveBeenCalledWith('know_it');
        expect(screen.getByTestId('study-section-quiz')).toBeTruthy();
    });

    it('calls onComplete directly after confidence when section has no quiz', () => {
        const onComplete = vi.fn();
        render(<StudySection {...defaultProps} section={sectionNoQuiz} onComplete={onComplete} />);
        fireEvent.click(screen.getByText('Show Answer'));
        fireEvent.click(screen.getByTestId('confidence-okay'));
        expect(onComplete).toHaveBeenCalledOnce();
    });

    it('calls onComplete after thumbs up/down in quiz step', () => {
        const onComplete = vi.fn();
        render(<StudySection {...defaultProps} onComplete={onComplete} />);
        fireEvent.click(screen.getByText('Show Answer'));
        fireEvent.click(screen.getByTestId('confidence-know_it'));
        // Now in quiz step — reveal answer first
        fireEvent.click(screen.getByText('Show Answer'));
        fireEvent.click(screen.getByTestId('quiz-thumbs-up'));
        expect(onComplete).toHaveBeenCalledOnce();
    });

    it('resets to recall step when section.id changes', () => {
        const { rerender } = render(<StudySection {...defaultProps} />);
        fireEvent.click(screen.getByText('Show Answer'));
        expect(screen.getByTestId('study-section-answer')).toBeTruthy();
        rerender(<StudySection {...defaultProps} section={{ ...section, id: 'sec-2' }} />);
        expect(screen.getByTestId('study-section-recall')).toBeTruthy();
    });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd client && npx vitest run src/components/StudySection.test.jsx
```

Expected: `StudySection.jsx` not found.

- [ ] **Step 3: Implement `StudySection.jsx`**

Create `client/src/components/StudySection.jsx`:

```jsx
import React, { useEffect, useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

export default function StudySection({
    section,
    sectionState,
    onReveal,
    onConfidenceSelect,
    onComplete,
}) {
    const [step, setStep] = useState('recall');
    const [quizRevealed, setQuizRevealed] = useState(false);
    const hasQuiz = section.mini_quiz?.length > 0;
    const quizItem = section.mini_quiz?.[0] ?? null;

    useEffect(() => {
        setStep('recall');
        setQuizRevealed(false);
    }, [section.id]);

    const handleShowAnswer = () => {
        onReveal();
        setStep('answer');
    };

    const handleConfidence = (confidence) => {
        onConfidenceSelect(confidence);
        if (hasQuiz) {
            setStep('quiz');
        } else {
            onComplete();
        }
    };

    if (step === 'recall') {
        return (
            <div data-testid="study-section-recall" className="flex flex-col gap-4">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">
                    {section.title}
                </p>
                <p className="text-base font-semibold leading-relaxed text-claude-text">
                    {section.recall_prompt}
                </p>
                <textarea
                    className="w-full resize-none rounded-xl border border-claude-border bg-claude-surface px-3 py-3 text-sm text-claude-text placeholder:text-claude-secondary focus:outline-none focus:ring-1 focus:ring-claude-accent"
                    rows={3}
                    placeholder="Type your answer here (optional)..."
                    aria-label="Draft answer"
                />
                <p className="text-center text-xs text-claude-secondary">
                    Can&apos;t recall? That&apos;s okay — just tap.
                </p>
                <button
                    type="button"
                    onClick={handleShowAnswer}
                    className="w-full rounded-2xl bg-claude-accent px-4 py-4 text-sm font-bold text-white transition-opacity active:opacity-80"
                >
                    Show Answer
                </button>
            </div>
        );
    }

    if (step === 'answer') {
        return (
            <div data-testid="study-section-answer" className="flex flex-col gap-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">
                    {section.title}
                </p>
                <ul className="space-y-1 pl-4">
                    {section.answer_points.map((point, i) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <li key={i} className="list-disc text-sm leading-relaxed text-claude-text">
                            {point}
                        </li>
                    ))}
                </ul>
                {section.common_traps.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="mb-1 text-[10px] font-mono uppercase tracking-[0.14em] text-amber-700">
                            Common trap
                        </p>
                        {section.common_traps.map((trap, i) => (
                            // eslint-disable-next-line react/no-array-index-key
                            <p key={i} className="text-xs text-amber-800">{trap}</p>
                        ))}
                    </div>
                )}
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                    How did you do?
                </p>
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { value: 'need_work', label: 'Need Work', className: 'border-red-200 bg-red-50 text-red-700' },
                        { value: 'okay', label: 'Okay', className: 'border-yellow-200 bg-yellow-50 text-yellow-700' },
                        { value: 'know_it', label: 'Got It', className: 'border-green-200 bg-green-50 text-green-700' },
                    ].map(({ value, label, className }) => (
                        <button
                            key={value}
                            type="button"
                            data-testid={`confidence-${value}`}
                            onClick={() => handleConfidence(value)}
                            className={`rounded-xl border px-2 py-3 text-xs font-semibold transition-opacity active:opacity-70 ${className}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // step === 'quiz'
    return (
        <div data-testid="study-section-quiz" className="flex flex-col gap-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">
                Checkpoint
            </p>
            <p className="text-base font-semibold leading-relaxed text-claude-text">
                {quizItem.prompt}
            </p>
            {!quizRevealed ? (
                <button
                    type="button"
                    onClick={() => setQuizRevealed(true)}
                    className="w-full rounded-2xl border border-claude-border bg-claude-surface px-4 py-3 text-sm font-semibold text-claude-text"
                >
                    Show Answer
                </button>
            ) : (
                <>
                    <div className="rounded-xl border border-claude-border bg-claude-surface px-3 py-3">
                        <p className="text-sm text-claude-text">{quizItem.answer}</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            data-testid="quiz-thumbs-down"
                            onClick={onComplete}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700"
                        >
                            <ThumbsDown className="h-4 w-4" />
                            Got it wrong
                        </button>
                        <button
                            type="button"
                            data-testid="quiz-thumbs-up"
                            onClick={onComplete}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-sm font-semibold text-green-700"
                        >
                            <ThumbsUp className="h-4 w-4" />
                            Got it right
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Run tests — verify they all pass**

```bash
cd client && npx vitest run src/components/StudySection.test.jsx
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/StudySection.jsx client/src/components/StudySection.test.jsx
git commit -m "feat: add StudySection component with 3-step active recall flow"
```

---

### Task 3: Build `GuideProgressDashboard` component

**Files:**
- Create: `client/src/components/GuideProgressDashboard.jsx`
- Create: `client/src/components/GuideProgressDashboard.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `client/src/components/GuideProgressDashboard.test.jsx`:

```jsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GuideProgressDashboard from './GuideProgressDashboard.jsx';

const guideData = {
    overview: 'Review before revealing.',
    sections: [
        { id: 'sec-1', title: 'Cell Structure', recall_prompt: '', answer_points: [], key_terms: [], mini_quiz: [], common_traps: [] },
        { id: 'sec-2', title: 'Mitosis', recall_prompt: '', answer_points: [], key_terms: [], mini_quiz: [], common_traps: [] },
        { id: 'sec-3', title: 'Protein Synthesis', recall_prompt: '', answer_points: [], key_terms: [], mini_quiz: [], common_traps: [] },
    ],
};

const studyState = {
    current_section_id: 'sec-1',
    last_reviewed_at: new Date().toISOString(),
    section_states: {
        'sec-1': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
        'sec-2': { revealed: true, confidence: 'need_work', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
        'sec-3': { revealed: false, confidence: null, completed: false, note: '', last_reviewed_at: null },
    },
};

describe('GuideProgressDashboard', () => {
    it('renders each section title', () => {
        render(<GuideProgressDashboard guideData={guideData} studyState={studyState} onStartWeakSession={vi.fn()} />);
        expect(screen.getByText('Cell Structure')).toBeTruthy();
        expect(screen.getByText('Mitosis')).toBeTruthy();
        expect(screen.getByText('Protein Synthesis')).toBeTruthy();
    });

    it('shows Review Now label for need_work section', () => {
        render(<GuideProgressDashboard guideData={guideData} studyState={studyState} onStartWeakSession={vi.fn()} />);
        expect(screen.getAllByText('Review Now').length).toBeGreaterThan(0);
    });

    it('shows Not Studied label for unstudied section', () => {
        render(<GuideProgressDashboard guideData={guideData} studyState={studyState} onStartWeakSession={vi.fn()} />);
        expect(screen.getByText('Not Studied')).toBeTruthy();
    });

    it('calls onStartWeakSession when CTA is clicked', () => {
        const onStartWeakSession = vi.fn();
        render(<GuideProgressDashboard guideData={guideData} studyState={studyState} onStartWeakSession={onStartWeakSession} />);
        fireEvent.click(screen.getByTestId('review-weak-cta'));
        expect(onStartWeakSession).toHaveBeenCalledOnce();
    });

    it('hides CTA when no weak sections exist', () => {
        const strongState = {
            ...studyState,
            section_states: {
                'sec-1': { confidence: 'know_it', last_reviewed_at: new Date().toISOString(), revealed: true, completed: true, note: '' },
                'sec-2': { confidence: 'know_it', last_reviewed_at: new Date().toISOString(), revealed: true, completed: true, note: '' },
                'sec-3': { confidence: 'know_it', last_reviewed_at: new Date().toISOString(), revealed: true, completed: true, note: '' },
            },
        };
        render(<GuideProgressDashboard guideData={guideData} studyState={strongState} onStartWeakSession={vi.fn()} />);
        expect(screen.queryByTestId('review-weak-cta')).toBeNull();
    });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd client && npx vitest run src/components/GuideProgressDashboard.test.jsx
```

Expected: component not found.

- [ ] **Step 3: Implement `GuideProgressDashboard.jsx`**

Create `client/src/components/GuideProgressDashboard.jsx`:

```jsx
import React from 'react';
import { getGuideProgress, getSectionStatus, getWeakSections, normalizeGuideData, normalizeGuideStudyState } from '../utils/studyGuides.js';

const STATUS_CONFIG = {
    review_now: { label: 'Review Now', rowClass: 'border-l-red-400 bg-red-50', badgeClass: 'bg-red-100 text-red-700' },
    coming_up: { label: 'Coming Up', rowClass: 'border-l-yellow-400 bg-yellow-50', badgeClass: 'bg-yellow-100 text-yellow-700' },
    review_soon: { label: 'Review Soon', rowClass: 'border-l-yellow-300 bg-yellow-50', badgeClass: 'bg-yellow-100 text-yellow-800' },
    good: { label: 'Good', rowClass: 'border-l-green-400 bg-green-50', badgeClass: 'bg-green-100 text-green-700' },
    unstudied: { label: 'Not Studied', rowClass: 'border-l-red-300 bg-red-50', badgeClass: 'bg-red-100 text-red-600' },
};

export default function GuideProgressDashboard({ guideData, studyState, onStartWeakSession }) {
    const normalizedGuideData = normalizeGuideData(guideData);
    const normalizedStudyState = normalizeGuideStudyState(guideData, studyState);
    const progress = getGuideProgress(normalizedGuideData, normalizedStudyState);
    const weakSections = getWeakSections(guideData, studyState);

    if (!normalizedGuideData) return null;

    const sections = normalizedGuideData.sections.map((section) => {
        const sectionState = normalizedStudyState.section_states[section.id];
        const rawStatus = getSectionStatus(sectionState, sectionState?.last_reviewed_at ?? null);
        const status = !sectionState?.confidence ? 'unstudied' : rawStatus;
        return { section, status };
    });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-2xl font-bold text-claude-accent">{progress.completionPercent}%</p>
                    <p className="text-xs text-claude-secondary">Overall mastery</p>
                </div>
                <p className="text-sm text-claude-secondary">
                    {progress.completedCount}/{progress.totalSections} sections complete
                </p>
            </div>

            <div className="flex flex-col gap-2">
                {sections.map(({ section, status }) => {
                    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.unstudied;
                    return (
                        <div
                            key={section.id}
                            className={`flex items-center gap-3 rounded-xl border-l-4 px-3 py-3 ${config.rowClass}`}
                        >
                            <p className="flex-1 text-sm font-medium text-claude-text">{section.title}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${config.badgeClass}`}>
                                {config.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {weakSections.length > 0 && (
                <button
                    type="button"
                    data-testid="review-weak-cta"
                    onClick={onStartWeakSession}
                    className="w-full rounded-2xl bg-red-500 px-4 py-4 text-sm font-bold text-white transition-opacity active:opacity-80"
                >
                    Review Weak Sections Now ({weakSections.length})
                </button>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Run tests — verify they all pass**

```bash
cd client && npx vitest run src/components/GuideProgressDashboard.test.jsx
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/GuideProgressDashboard.jsx client/src/components/GuideProgressDashboard.test.jsx
git commit -m "feat: add GuideProgressDashboard with weakness breakdown and review CTA"
```

---

### Task 4: Build `QuizMeMode` component

**Files:**
- Create: `client/src/components/QuizMeMode.jsx`
- Create: `client/src/components/QuizMeMode.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `client/src/components/QuizMeMode.test.jsx`:

```jsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuizMeMode from './QuizMeMode.jsx';

const questions = [
    { prompt: 'Where does translation occur?', answer: 'Ribosomes', sectionId: 'sec-1', sectionTitle: 'Protein Synthesis' },
    { prompt: 'What is the net ATP yield of glycolysis?', answer: '2 ATP', sectionId: 'sec-2', sectionTitle: 'Cellular Respiration' },
];

describe('QuizMeMode', () => {
    it('shows first question prompt', () => {
        render(<QuizMeMode questions={questions} onComplete={vi.fn()} />);
        expect(screen.getByText('Where does translation occur?')).toBeTruthy();
    });

    it('hides answer until Show Answer is tapped', () => {
        render(<QuizMeMode questions={questions} onComplete={vi.fn()} />);
        expect(screen.queryByText('Ribosomes')).toBeNull();
        fireEvent.click(screen.getByText('Show Answer'));
        expect(screen.getByText('Ribosomes')).toBeTruthy();
    });

    it('advances to next question after thumbs up', () => {
        render(<QuizMeMode questions={questions} onComplete={vi.fn()} />);
        fireEvent.click(screen.getByText('Show Answer'));
        fireEvent.click(screen.getByTestId('quiz-correct'));
        expect(screen.getByText('What is the net ATP yield of glycolysis?')).toBeTruthy();
    });

    it('calls onComplete with score and weakSectionIds after all questions', () => {
        const onComplete = vi.fn();
        render(<QuizMeMode questions={questions} onComplete={onComplete} />);
        // Q1: wrong
        fireEvent.click(screen.getByText('Show Answer'));
        fireEvent.click(screen.getByTestId('quiz-incorrect'));
        // Q2: correct
        fireEvent.click(screen.getByText('Show Answer'));
        fireEvent.click(screen.getByTestId('quiz-correct'));
        expect(onComplete).toHaveBeenCalledWith({ score: 1, total: 2, weakSectionIds: ['sec-1'] });
    });

    it('shows empty state when no questions', () => {
        render(<QuizMeMode questions={[]} onComplete={vi.fn()} />);
        expect(screen.getByTestId('quiz-empty')).toBeTruthy();
    });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd client && npx vitest run src/components/QuizMeMode.test.jsx
```

Expected: component not found.

- [ ] **Step 3: Implement `QuizMeMode.jsx`**

Create `client/src/components/QuizMeMode.jsx`:

```jsx
import React, { useState } from 'react';

export default function QuizMeMode({ questions, onComplete }) {
    const [index, setIndex] = useState(0);
    const [revealed, setRevealed] = useState(false);
    const [results, setResults] = useState([]); // { sectionId, correct }[]

    if (questions.length === 0) {
        return (
            <div data-testid="quiz-empty" className="flex flex-col items-center gap-4 py-8 text-center">
                <p className="text-sm text-claude-secondary">
                    No quiz questions available for this guide.
                </p>
            </div>
        );
    }

    const question = questions[index];
    const progress = `${index + 1} / ${questions.length}`;

    const handleAnswer = (correct) => {
        const newResults = [...results, { sectionId: question.sectionId, correct }];
        if (index + 1 >= questions.length) {
            const score = newResults.filter((r) => r.correct).length;
            const weakSectionIds = [...new Set(newResults.filter((r) => !r.correct).map((r) => r.sectionId))];
            onComplete({ score, total: questions.length, weakSectionIds });
        } else {
            setResults(newResults);
            setIndex(index + 1);
            setRevealed(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">
                    Quiz Me
                </p>
                <p className="text-xs text-claude-secondary">{progress}</p>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-claude-border">
                <div
                    className="h-full rounded-full bg-claude-accent transition-all"
                    style={{ width: `${((index) / questions.length) * 100}%` }}
                />
            </div>

            <p className="text-base font-semibold leading-relaxed text-claude-text">
                {question.prompt}
            </p>

            {!revealed ? (
                <button
                    type="button"
                    onClick={() => setRevealed(true)}
                    className="w-full rounded-2xl bg-claude-accent px-4 py-4 text-sm font-bold text-white transition-opacity active:opacity-80"
                >
                    Show Answer
                </button>
            ) : (
                <>
                    <div className="rounded-xl border border-claude-border bg-claude-surface px-4 py-3">
                        <p className="text-sm text-claude-text">{question.answer}</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            data-testid="quiz-incorrect"
                            onClick={() => handleAnswer(false)}
                            className="flex flex-1 items-center justify-center rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-700"
                        >
                            Got it wrong
                        </button>
                        <button
                            type="button"
                            data-testid="quiz-correct"
                            onClick={() => handleAnswer(true)}
                            className="flex flex-1 items-center justify-center rounded-xl border border-green-200 bg-green-50 py-3 text-sm font-semibold text-green-700"
                        >
                            Got it right
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Run tests — verify they all pass**

```bash
cd client && npx vitest run src/components/QuizMeMode.test.jsx
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/QuizMeMode.jsx client/src/components/QuizMeMode.test.jsx
git commit -m "feat: add QuizMeMode rapid-fire quiz component"
```

---

### Task 5: Integrate new components into `GuideView.jsx`

This is the largest task. It adds the session entry screen, wires all three modes, and shows the dashboard post-session. The existing desktop/mobile split layout for v2 guides is replaced by a mode-driven view. v1 (legacy) guides are not touched.

**Files:**
- Modify: `client/src/pages/GuideView.jsx`

- [ ] **Step 1: Add new imports at the top of `GuideView.jsx`**

After the existing imports block, add:

```js
import StudySection from '../components/StudySection.jsx';
import GuideProgressDashboard from '../components/GuideProgressDashboard.jsx';
import QuizMeMode from '../components/QuizMeMode.jsx';
import {
    getSessionSections,
    getWeakSections,
    getSectionStatus,
} from '../utils/studyGuides.js';
```

- [ ] **Step 2: Add session mode state variables**

Inside `GuideView()`, after the existing `useState` declarations, add:

```js
// Session mode state — drives the new study flow for v2 guides
// 'entry' | 'studying' | 'quiz' | 'dashboard'
const [sessionMode, setSessionMode] = useState('entry');
const [sessionSections, setSessionSections] = useState([]);
const [sessionIndex, setSessionIndex] = useState(0);
```

Also add a reset on guide load — inside `loadGuide`, after `setStudyState(normalizedState)`:

```js
setSessionMode('entry');
setSessionSections([]);
setSessionIndex(0);
```

- [ ] **Step 3: Add helper callbacks for session actions**

Inside `GuideView()`, after the existing `focusSession` callback, add:

```js
const startStudySession = useCallback((sections) => {
    if (!sections.length) return;
    setSessionSections(sections);
    setSessionIndex(0);
    setSessionMode('studying');
}, []);

const startFullSession = useCallback(() => {
    startStudySession(normalizedGuideData?.sections ?? []);
}, [startStudySession, normalizedGuideData]);

const startQuickSession = useCallback((durationMinutes) => {
    const sections = getSessionSections(normalizedGuideData, normalizedStudyState, durationMinutes);
    startStudySession(sections.length ? sections : normalizedGuideData?.sections ?? []);
}, [startStudySession, normalizedGuideData, normalizedStudyState]);

const startWeakSession = useCallback(() => {
    const weak = getWeakSections(normalizedGuideData, normalizedStudyState);
    startStudySession(weak.length ? weak : normalizedGuideData?.sections ?? []);
}, [startStudySession, normalizedGuideData, normalizedStudyState]);

const startQuizMode = useCallback(() => {
    setSessionMode('quiz');
}, []);

const handleSectionReveal = useCallback((sectionId) => {
    updateStudyState((state) => ({
        ...state,
        section_states: {
            ...state.section_states,
            [sectionId]: {
                ...state.section_states[sectionId],
                revealed: true,
            },
        },
    }));
}, [updateStudyState]);

const handleConfidenceSelect = useCallback((sectionId, confidence) => {
    const now = new Date().toISOString();
    updateStudyState((state) => ({
        ...state,
        section_states: {
            ...state.section_states,
            [sectionId]: {
                ...state.section_states[sectionId],
                confidence,
                revealed: true,
                last_reviewed_at: now,
            },
        },
        last_reviewed_at: now,
    }), { immediate: true });
}, [updateStudyState]);

const handleSectionComplete = useCallback((sectionId) => {
    updateStudyState((state) => ({
        ...state,
        section_states: {
            ...state.section_states,
            [sectionId]: {
                ...state.section_states[sectionId],
                completed: true,
            },
        },
    }));
    setSessionIndex((prev) => {
        if (prev + 1 >= sessionSections.length) {
            setSessionMode('dashboard');
            return prev;
        }
        return prev + 1;
    });
}, [updateStudyState, sessionSections.length]);

const handleQuizComplete = useCallback(() => {
    setSessionMode('dashboard');
}, []);

const allQuizQuestions = useMemo(() => (
    (normalizedGuideData?.sections ?? []).flatMap((section) => (
        section.mini_quiz.map((item) => ({
            prompt: item.prompt,
            answer: item.answer,
            sectionId: section.id,
            sectionTitle: section.title,
        }))
    ))
), [normalizedGuideData]);

const weakCoachMessage = useMemo(() => {
    if (!normalizedGuideData || !normalizedStudyState) return null;
    const weak = getWeakSections(normalizedGuideData, normalizedStudyState);
    if (!weak.length) return null;
    if (weak.length === 1) return `You're weak on ${weak[0].title}. Focus there first.`;
    if (weak.length === 2) return `You're weak on ${weak[0].title} and ${weak[1].title}. Start there.`;
    return `${weak.length} sections need review. Start with the weakest ones.`;
}, [normalizedGuideData, normalizedStudyState]);
```

- [ ] **Step 4: Add the session entry JSX helper function**

Before the `return` statement of `GuideView`, add:

```js
const renderSessionEntry = () => (
    <div data-testid="session-entry" className="flex flex-col gap-4 px-4 py-4">
        <div>
            <h1 className="font-serif text-2xl font-bold italic text-claude-text">{title}</h1>
            {normalizedStudyState.last_reviewed_at && (
                <p className="mt-1 text-xs text-claude-secondary">
                    Last studied {formatLastReviewed(normalizedStudyState.last_reviewed_at)}
                </p>
            )}
        </div>

        {weakCoachMessage && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="mb-1 text-[10px] font-mono uppercase tracking-[0.14em] text-blue-600">Study Coach</p>
                <p className="text-sm text-blue-800">{weakCoachMessage}</p>
            </div>
        )}

        <div className="flex flex-col gap-3">
            <div className="rounded-2xl bg-claude-accent p-4 text-white">
                <p className="font-bold">⚡ Quick Session</p>
                <p className="mt-1 text-xs opacity-80">Pick a time — app selects what matters most</p>
                <div className="mt-3 flex gap-2">
                    {[5, 10, 20].map((min) => (
                        <button
                            key={min}
                            type="button"
                            onClick={() => startQuickSession(min)}
                            className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/30 transition-colors"
                        >
                            {min} min
                        </button>
                    ))}
                </div>
            </div>

            <button
                type="button"
                onClick={startFullSession}
                className="rounded-2xl border border-claude-border bg-claude-surface p-4 text-left"
            >
                <p className="font-bold text-claude-text">📚 Full Session</p>
                <p className="mt-1 text-xs text-claude-secondary">
                    All {sections.length} sections · ~{sections.length * 3} min
                </p>
            </button>

            {allQuizQuestions.length > 0 && (
                <button
                    type="button"
                    onClick={startQuizMode}
                    className="rounded-2xl border border-claude-border bg-claude-surface p-4 text-left"
                >
                    <p className="font-bold text-claude-text">🎯 Quiz Me</p>
                    <p className="mt-1 text-xs text-claude-secondary">
                        Rapid-fire · {allQuizQuestions.length} questions · Pure recall
                    </p>
                </button>
            )}
        </div>

        <button
            type="button"
            onClick={() => setSessionMode('dashboard')}
            className="text-center text-xs text-claude-secondary underline"
        >
            View progress dashboard
        </button>
    </div>
);
```

- [ ] **Step 5: Add the studying and dashboard JSX helper functions**

```js
const activeSessionSection = sessionSections[sessionIndex] ?? null;
const activeSessionSectionState = activeSessionSection
    ? normalizedStudyState.section_states[activeSessionSection.id] ?? DEFAULT_SECTION_STATE
    : null;

const renderStudying = () => {
    if (!activeSessionSection) return null;
    return (
        <div data-testid="session-studying" className="flex flex-col gap-4 px-4 py-4">
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => setSessionMode('entry')}
                    className="flex items-center gap-1 text-xs text-claude-secondary"
                >
                    <ChevronLeft className="h-3 w-3" /> Exit session
                </button>
                <p className="text-xs text-claude-secondary">
                    {sessionIndex + 1} / {sessionSections.length}
                </p>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-claude-border">
                <div
                    className="h-full rounded-full bg-claude-accent transition-all"
                    style={{ width: `${(sessionIndex / sessionSections.length) * 100}%` }}
                />
            </div>

            <StudySection
                section={activeSessionSection}
                sectionState={activeSessionSectionState}
                onReveal={() => handleSectionReveal(activeSessionSection.id)}
                onConfidenceSelect={(confidence) => handleConfidenceSelect(activeSessionSection.id, confidence)}
                onComplete={() => handleSectionComplete(activeSessionSection.id)}
            />
        </div>
    );
};

const renderDashboard = () => (
    <div data-testid="session-dashboard" className="flex flex-col gap-4 px-4 py-4">
        <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-bold italic text-claude-text">Progress</h2>
            <button
                type="button"
                onClick={() => setSessionMode('entry')}
                className="text-xs text-claude-secondary underline"
            >
                Back
            </button>
        </div>
        <GuideProgressDashboard
            guideData={normalizedGuideData}
            studyState={normalizedStudyState}
            onStartWeakSession={startWeakSession}
        />
    </div>
);

const renderQuiz = () => (
    <div data-testid="session-quiz" className="flex flex-col gap-4 px-4 py-4">
        <div className="flex items-center justify-between">
            <button
                type="button"
                onClick={() => setSessionMode('entry')}
                className="flex items-center gap-1 text-xs text-claude-secondary"
            >
                <ChevronLeft className="h-3 w-3" /> Exit quiz
            </button>
        </div>
        <QuizMeMode questions={allQuizQuestions} onComplete={handleQuizComplete} />
    </div>
);
```

- [ ] **Step 6: Wire the mode-driven rendering into the workbook guide JSX**

In `GuideView.jsx`, find the section that renders the workbook guide (where `workbookGuide` is true and `!workbookSchemaIssue`). This is the large block that renders the section list + study area. Replace the workbook content area with the mode router:

```jsx
{workbookGuide && !workbookSchemaIssue && (
    <div>
        {sessionMode === 'entry' && renderSessionEntry()}
        {sessionMode === 'studying' && renderStudying()}
        {sessionMode === 'quiz' && renderQuiz()}
        {sessionMode === 'dashboard' && renderDashboard()}
    </div>
)}
```

Keep all existing guard conditions (`workbookSchemaIssue` error UI, `legacyGuide` Tiptap editor, etc.) intact — only replace the main workbook content area.

- [ ] **Step 7: Run the full test suite to catch regressions**

```bash
cd client && npx vitest run src/pages/GuideView.test.jsx
```

Expected: existing tests pass. If any fail, investigate — the most common issue is that existing tests reference session UI elements that have been replaced. Update test assertions to use new `data-testid` values (`session-entry`, `session-studying`, etc.) if needed.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/GuideView.jsx
git commit -m "feat: integrate session entry, active recall flow, quiz mode, and dashboard into GuideView"
```

---

## Phase 2

---

### Task 6: Add `updateSection` helper and `SectionEditor` component

**Files:**
- `client/src/utils/studyGuides.js` — `updateSection` already added in Task 1
- Create: `client/src/components/SectionEditor.jsx`

`updateSection` is already implemented and tested from Task 1. This task only builds the UI.

- [ ] **Step 1: Write failing tests for `SectionEditor`**

Create `client/src/components/SectionEditor.test.jsx`:

```jsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SectionEditor from './SectionEditor.jsx';

const section = {
    id: 'sec-1',
    title: 'Protein Synthesis',
    recall_prompt: 'How does DNA become a protein?',
    answer_points: ['Transcription: DNA → mRNA', 'Translation: mRNA → protein'],
    common_traps: ['Confusing polymerase with ribosomes'],
    key_terms: ['mRNA', 'ribosome'],
    mini_quiz: [],
};

describe('SectionEditor', () => {
    it('renders section fields pre-filled', () => {
        render(<SectionEditor section={section} onSave={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByDisplayValue('Protein Synthesis')).toBeTruthy();
        expect(screen.getByDisplayValue('How does DNA become a protein?')).toBeTruthy();
        expect(screen.getByText('Transcription: DNA → mRNA')).toBeTruthy();
    });

    it('calls onSave with updated title', () => {
        const onSave = vi.fn();
        render(<SectionEditor section={section} onSave={onSave} onCancel={vi.fn()} />);
        const titleInput = screen.getByDisplayValue('Protein Synthesis');
        fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
        fireEvent.click(screen.getByTestId('section-editor-save'));
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated Title' }));
    });

    it('calls onSave with answer_points after removing one', () => {
        const onSave = vi.fn();
        render(<SectionEditor section={section} onSave={onSave} onCancel={vi.fn()} />);
        fireEvent.click(screen.getAllByTestId('remove-answer-point')[0]);
        fireEvent.click(screen.getByTestId('section-editor-save'));
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({ answer_points: ['Translation: mRNA → protein'] })
        );
    });

    it('calls onCancel when Cancel is clicked', () => {
        const onCancel = vi.fn();
        render(<SectionEditor section={section} onSave={vi.fn()} onCancel={onCancel} />);
        fireEvent.click(screen.getByTestId('section-editor-cancel'));
        expect(onCancel).toHaveBeenCalledOnce();
    });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd client && npx vitest run src/components/SectionEditor.test.jsx
```

Expected: component not found.

- [ ] **Step 3: Implement `SectionEditor.jsx`**

Create `client/src/components/SectionEditor.jsx`:

```jsx
import React, { useState } from 'react';
import { X } from 'lucide-react';

function EditableList({ items, onChange, placeholder, testIdPrefix }) {
    const handleChange = (index, value) => {
        const next = items.map((item, i) => (i === index ? value : item));
        onChange(next);
    };

    const handleRemove = (index) => {
        onChange(items.filter((_, i) => i !== index));
    };

    const handleAdd = () => {
        onChange([...items, '']);
    };

    return (
        <div className="flex flex-col gap-1.5">
            {items.map((item, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={index} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={item}
                        onChange={(e) => handleChange(index, e.target.value)}
                        className="flex-1 rounded-lg border border-claude-border bg-claude-surface px-3 py-2 text-sm text-claude-text focus:outline-none focus:ring-1 focus:ring-claude-accent"
                    />
                    <button
                        type="button"
                        data-testid={`remove-${testIdPrefix}`}
                        onClick={() => handleRemove(index)}
                        className="text-claude-secondary hover:text-red-500 transition-colors"
                        aria-label="Remove"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={handleAdd}
                className="text-left text-xs text-claude-accent hover:underline"
            >
                + Add {placeholder}
            </button>
        </div>
    );
}

export default function SectionEditor({ section, onSave, onCancel }) {
    const [title, setTitle] = useState(section.title);
    const [recallPrompt, setRecallPrompt] = useState(section.recall_prompt);
    const [answerPoints, setAnswerPoints] = useState(section.answer_points);
    const [commonTraps, setCommonTraps] = useState(section.common_traps);
    const [keyTerms, setKeyTerms] = useState(section.key_terms);

    const handleSave = () => {
        onSave({
            title,
            recall_prompt: recallPrompt,
            answer_points: answerPoints.filter(Boolean),
            common_traps: commonTraps.filter(Boolean),
            key_terms: keyTerms.filter(Boolean),
        });
    };

    return (
        <div className="flex flex-col gap-5">
            <div>
                <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary">
                    Section Title
                </p>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-claude-border bg-claude-surface px-3 py-2.5 text-sm font-semibold text-claude-text focus:outline-none focus:ring-1 focus:ring-claude-accent"
                />
            </div>

            <div>
                <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary">
                    Recall Prompt
                </p>
                <textarea
                    value={recallPrompt}
                    onChange={(e) => setRecallPrompt(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-claude-border bg-claude-surface px-3 py-2.5 text-sm text-claude-text focus:outline-none focus:ring-1 focus:ring-claude-accent"
                />
            </div>

            <div>
                <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary">
                    Answer Points
                </p>
                <EditableList
                    items={answerPoints}
                    onChange={setAnswerPoints}
                    placeholder="answer point"
                    testIdPrefix="answer-point"
                />
            </div>

            <div>
                <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary">
                    Common Traps
                </p>
                <EditableList
                    items={commonTraps}
                    onChange={setCommonTraps}
                    placeholder="common trap"
                    testIdPrefix="common-trap"
                />
            </div>

            <div>
                <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary">
                    Key Terms
                </p>
                <EditableList
                    items={keyTerms}
                    onChange={setKeyTerms}
                    placeholder="key term"
                    testIdPrefix="key-term"
                />
            </div>

            <div className="flex gap-3">
                <button
                    type="button"
                    data-testid="section-editor-save"
                    onClick={handleSave}
                    className="flex-1 rounded-2xl bg-claude-accent px-4 py-3 text-sm font-bold text-white transition-opacity active:opacity-80"
                >
                    Save Changes
                </button>
                <button
                    type="button"
                    data-testid="section-editor-cancel"
                    onClick={onCancel}
                    className="rounded-2xl border border-claude-border bg-claude-surface px-4 py-3 text-sm text-claude-secondary"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run tests — verify they all pass**

```bash
cd client && npx vitest run src/components/SectionEditor.test.jsx
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/SectionEditor.jsx client/src/components/SectionEditor.test.jsx
git commit -m "feat: add SectionEditor component for inline v2 section editing"
```

---

### Task 7: Wire `SectionEditor` into `GuideView`

**Files:**
- Modify: `client/src/pages/GuideView.jsx`

- [ ] **Step 1: Add SectionEditor import and state**

In `GuideView.jsx`, add to the imports:

```js
import SectionEditor from '../components/SectionEditor.jsx';
import { updateSection } from '../utils/studyGuides.js';
```

Add state after the existing `useState` declarations:

```js
const [editingSectionId, setEditingSectionId] = useState(null);
```

- [ ] **Step 2: Add the save handler**

Inside `GuideView()`, after the existing callbacks:

```js
const handleSaveSection = useCallback(async (sectionId, updates) => {
    const currentGuideData = guideDataRef.current;
    const updatedGuideData = updateSection(currentGuideData, sectionId, updates);
    const normalizedNewState = normalizeGuideStudyState(updatedGuideData, studyStateRef.current);

    setGuideData(updatedGuideData);
    guideDataRef.current = updatedGuideData;
    setStudyState(normalizedNewState);
    studyStateRef.current = normalizedNewState;
    setEditingSectionId(null);

    try {
        await api.updateStudyGuide(id, { guide_data: updatedGuideData });
    } catch {
        toast.error('Failed to save section');
    }
}, [id, toast]);
```

- [ ] **Step 3: Add a pencil icon button to each section in the study flow**

In `renderStudying()` (added in Task 5), after the section title line, add an edit button:

```jsx
<div className="flex items-center justify-between">
    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">
        {activeSessionSection.title}
    </p>
    <button
        type="button"
        onClick={() => setEditingSectionId(activeSessionSection.id)}
        className="text-claude-secondary hover:text-claude-accent transition-colors"
        aria-label="Edit section"
    >
        <Pencil className="h-3.5 w-3.5" />
    </button>
</div>
```

Add `Pencil` to the lucide-react import at the top of the file.

- [ ] **Step 4: Add the SectionEditor modal/sheet**

In the workbook guide section of the JSX (where `workbookGuide && !workbookSchemaIssue`), add after the mode router div:

```jsx
{editingSectionId && (() => {
    const sectionToEdit = normalizedGuideData?.sections.find((s) => s.id === editingSectionId);
    if (!sectionToEdit) return null;
    return (
        <MobileBottomSheet
            open
            title="Edit Section"
            onClose={() => setEditingSectionId(null)}
            opaque
        >
            <SectionEditor
                section={sectionToEdit}
                onSave={(updates) => handleSaveSection(editingSectionId, updates)}
                onCancel={() => setEditingSectionId(null)}
            />
        </MobileBottomSheet>
    );
})()}
```

- [ ] **Step 5: Run full test suite**

```bash
cd client && npx vitest run src/pages/GuideView.test.jsx
```

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/GuideView.jsx
git commit -m "feat: wire SectionEditor into GuideView with inline save"
```

---

### Task 8: Improve AI prompt in `aiCore.mjs`

**Files:**
- Modify: `supabase/functions/_shared/aiCore.mjs`

- [ ] **Step 1: Update `buildGuidePrompt` in `supabase/functions/_shared/aiCore.mjs`**

The function is at line ~346. Find this exact block:

```js
const buildGuidePrompt = (className) => `You are an expert tutor creating an active-recall study workbook.

${buildSubjectContext(className)}

Output ONLY a valid JSON object. No markdown, backticks, or text outside the object.
Required structure:
{
  "overview": "1-3 sentence overview",
```

And the tail of the function:

```js
      "answer_points": ["3-6 concise correct points"],
      "key_terms": ["important terms or formulas"],
      "mini_quiz": [
        { "prompt": "short checkpoint question", "answer": "short answer" }
      ],
      "common_traps": ["common misconception or mistake"]
    }
  ]
}
Build an active-recall workbook, not passive notes.
Create 4-8 sections when possible. Keep answer_points concrete and exam-useful.`;
```

Replace the entire `buildGuidePrompt` function with:

```js
const buildGuidePrompt = (className) => `You are an expert tutor creating an active-recall study workbook${className ? ` for ${className}` : ''}.
${className ? `Tailor section granularity, terminology, and common traps specifically to ${className}.` : ''}

${buildSubjectContext(className)}

Output ONLY a valid JSON object. No markdown, backticks, or text outside the object.
Required structure:
{
  "overview": "1-3 sentence overview",
  "sections": [
    {
      "id": "optional-short-slug",
      "title": "Section title",
      "recall_prompt": "Prompt that forces the student to answer before revealing the guide",
      "answer_points": ["3-5 exam-testable points — every point must be something that could appear on an exam, no definitional filler"],
      "key_terms": ["important terms or formulas"],
      "mini_quiz": [
        { "prompt": "short checkpoint question", "answer": "short answer" }
      ],
      "common_traps": ["common misconception or mistake"]
    }
  ]
}
Build an active-recall workbook, not passive notes.
Create 4-8 sections when possible. Keep answer_points concrete and exam-useful. Max 5 answer_points per section.
Each section must map to a DISTINCT testable concept — sections must not overlap in content.
If a concept in a section is commonly confused with another concept, it MUST appear in common_traps. Do not leave common_traps empty for sections where confusion is likely.`;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/aiCore.mjs
git commit -m "feat: tighten AI study guide prompt — max 5 points, mandatory traps, no section overlap"
```

---

## Verification Checklist

Run through these manually after all tasks are complete:

**Phase 1:**
- [ ] Open a v2 guide → see entry screen with 3 mode cards + coach banner if any weak sections
- [ ] Tap "5 min" Quick Session → session starts, sections are prioritized by weakness
- [ ] Study a section → recall prompt shown first, answer hidden → tap "Show Answer" → answer + traps revealed → tap a confidence button → advances to next section (or quiz step if mini_quiz present)
- [ ] Complete all sections in session → progress dashboard shown
- [ ] Tap "Review Weak Sections Now" on dashboard → new session starts with only weak sections
- [ ] Tap "Quiz Me" from entry → rapid-fire questions → score shown at end → redirects to dashboard
- [ ] Open a v1 (legacy) guide → Tiptap editor still works unchanged

**Phase 2:**
- [ ] Open a v2 guide in study mode → see pencil icon on section header
- [ ] Tap pencil → SectionEditor opens as bottom sheet → edit an answer point → save → section updated immediately, no full guide reload
- [ ] Generate a new guide → sections have ≤5 answer points, common_traps populated where relevant
- [ ] Section with `know_it` confidence last reviewed 4 days ago → shows "Review Soon" (yellow) in dashboard

**Regression:**
- [ ] `npx vitest run` in `client/` — all tests pass
- [ ] v1 guide edit still saves via Tiptap without errors
- [ ] Guide generation quota and streaming UI unchanged
