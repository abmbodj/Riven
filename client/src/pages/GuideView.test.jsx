import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GuideView from './GuideView.jsx';

vi.mock('../api', () => ({
  api: {
    getStudyGuide: vi.fn(),
    updateStudyGuide: vi.fn(),
    deleteStudyGuide: vi.fn(),
    completeStudyCoachSession: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('../components/ui/PricingModal', () => ({
  default: () => null,
}));

vi.mock('../components/ConfirmModal', () => ({
  default: () => null,
}));

const { api } = await import('../api');

const makeGuide = (overrides = {}) => ({
  id: 'guide-river-1',
  title: 'Cell Division Tutor Session',
  class_id: 'class-1',
  note_id: 'note-1',
  format_version: 4,
  guide_data: {
    session_meta: {
      subject: 'Biology',
      student_goal: 'Understand cell division',
      student_level: 'intermediate',
      exam_context: { label: 'Midterm', date: '2026-05-14' },
      source_mode: 'hybrid',
      estimated_minutes: 16,
      preferred_tutor_tone: 'calm review',
    },
    river: {
      name: 'River',
      species: 'grey cat',
      style: 'premium svg mascot',
      tone: 'calm, precise, encouraging',
      default_expression: 'blink_soft',
      default_animation: 'tail_sway_idle',
      cue_map: {
        idle: { expression: 'blink_soft', animation: 'tail_sway_idle' },
        focus: { expression: 'focus_lean_in', animation: 'ear_tilt_curious' },
        recover: { expression: 'soft_concern_mistake', animation: 'paw_point_hint' },
        mastery: { expression: 'whisker_pride', animation: 'sparkle_mastery' },
      },
      dialogue_variants: {
        opening: ['We will train this, not skim it.'],
        encouragement: ['Hold the structure and answer plainly.'],
        recovery: ['We can narrow the target.'],
        mastery: ['That answer is stable.'],
      },
    },
    knowledge_map: {
      concepts: [
        {
          id: 'concept-mitosis',
          title: 'Mitosis',
          summary: 'Mitosis produces two genetically identical daughter cells.',
          depends_on: [],
          weak_points: ['outcome'],
          misconception_tags: ['meiosis-mixup'],
        },
      ],
    },
    cards: [
      {
        id: 'card-1',
        concept_id: 'concept-mitosis',
        phase: 'diagnostic',
        difficulty: 'low',
        card_type: 'short_answer',
        prompt: 'What is the main outcome of mitosis?',
        target_answer: 'Two genetically identical daughter cells.',
        required_idea_tags: ['two-daughter-cells', 'identical-genetic-material'],
        optional_idea_tags: [],
        misconception_tags: ['meiosis-mixup'],
        hints: [
          { level: 1, text: 'Think about how many cells you end with.', cue: { expression: 'ear_tilt_curious', animation: 'paw_point_hint' } },
        ],
        feedback: {
          correct: ['Clean answer.'],
          partial: ['Partly there. Tighten it.'],
          incorrect: ['Reset around the outcome.'],
          empty: ['Start with the number of cells.'],
          misconception: [{ misconception_id: 'meiosis-mixup', responses: ['That describes meiosis, not mitosis.'] }],
        },
        river: {
          intro: 'Try it before I help.',
          success: 'That lands exactly where it should.',
          struggle: 'Let me narrow the frame.',
        },
        transitions: {
          on_correct: null,
          on_partial: 'retry',
          on_incorrect: 'hint',
          on_struggle: 'retry',
        },
        mastery_weight: 1,
      },
    ],
    evaluation_rules: {
      score_bands: { correct: 0.85, partial: 0.4 },
      empty_patterns: ['idk'],
      tag_synonyms: {
        'two-daughter-cells': ['two daughter cells', '2 daughter cells'],
        'identical-genetic-material': ['same dna', 'genetically identical', 'identical genetic material'],
      },
      misconception_rules: [
        {
          id: 'meiosis-mixup',
          concept_id: 'concept-mitosis',
          trigger_phrases: ['four daughter cells'],
          correction: 'That describes meiosis, not mitosis.',
        },
      ],
    },
    adaptation_rules: {
      max_attempts_before_recovery: 2,
      max_hints_per_card: 2,
      performance_bands: {
        struggling: { mastery_below: 45, river_expression: 'soft_concern_mistake', river_animation: 'paw_point_hint' },
        mastery: { mastery_below: 101, river_expression: 'whisker_pride', river_animation: 'sparkle_mastery' },
      },
    },
    completion: {
      title: 'Session complete',
      mastery_message: 'You converted recall into structure.',
      confidence_close: 'One more clean retrieval tomorrow will lock it in.',
      next_review_message: 'Return tomorrow for a short reinforcement pass.',
      river_cue: { expression: 'whisker_pride', animation: 'sparkle_mastery' },
    },
  },
  study_state: {
    current_card_id: 'card-1',
    session_phase: 'diagnostic',
    card_states: {
      'card-1': { attempts: 0, hints_used: 0, status: 'active', last_outcome: null, completed: false },
    },
    concept_mastery: {
      'concept-mitosis': { score: 0, status: 'unseen', attempts: 0, correct_attempts: 0, last_outcome: null },
    },
    last_interaction_at: null,
    completed_at: null,
    last_reviewed_at: null,
  },
  content: { type: 'doc', content: [] },
  ...overrides,
});

const legacyGuide = {
  id: 'guide-legacy',
  title: 'Old Exam Coach',
  format_version: 3,
  guide_data: {
    overview: 'Legacy coach',
    sections: [
      { id: 'old-1', title: 'Old', recall_prompt: 'Old prompt', answer_points: ['Old answer'] },
    ],
  },
  study_state: {},
  content: { type: 'doc', content: [] },
};

describe('GuideView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.updateStudyGuide.mockImplementation(async (id, updates) => ({
      ...makeGuide(),
      id,
      guide_data: updates.guide_data ?? makeGuide().guide_data,
      study_state: updates.study_state ?? makeGuide().study_state,
      title: updates.title ?? makeGuide().title,
    }));
    api.completeStudyCoachSession.mockResolvedValue({
      xpEarned: 60,
      masteryDelta: 18,
      weakTopicsRemaining: [],
      nextReviewAt: '2026-04-06T12:00:00.000Z',
    });
  });

  it('renders the River tutor intro and progresses through a one-card session', async () => {
    api.getStudyGuide.mockResolvedValue(makeGuide());

    render(
      <MemoryRouter initialEntries={['/guide/guide-river-1']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    const intro = await screen.findByTestId('river-session-intro');
    expect(within(intro).getByText('River Session')).toBeInTheDocument();
    expect(within(intro).getByText('Cell Division Tutor Session')).toBeInTheDocument();
    expect(within(intro).getByText(/River/i)).toBeInTheDocument();
    expect(within(intro).getByRole('button', { name: /start session/i })).toBeInTheDocument();

    fireEvent.click(within(intro).getByRole('button', { name: /start session/i }));

    const card = await screen.findByTestId('river-session-card');
    expect(within(card).getByText(/What is the main outcome of mitosis/i)).toBeInTheDocument();

    fireEvent.change(within(card).getByLabelText(/your answer/i), {
      target: { value: 'Mitosis makes two daughter cells with the same DNA.' },
    });
    fireEvent.click(within(card).getByRole('button', { name: /submit answer/i }));

    expect(await within(card).findByText(/Clean answer/i)).toBeInTheDocument();
    expect(within(card).getByText(/sparkle_mastery/i)).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: /continue/i }));

    const finish = await screen.findByTestId('river-session-complete');
    expect(within(finish).getByText(/Session complete/i)).toBeInTheDocument();
    expect(api.completeStudyCoachSession).toHaveBeenCalledWith(expect.objectContaining({
      guideId: 'guide-river-1',
      studyStateAfter: expect.objectContaining({
        completed_at: expect.any(String),
      }),
    }));

    await waitFor(() => {
      expect(api.updateStudyGuide).toHaveBeenCalledWith('guide-river-1', expect.objectContaining({
        study_state: expect.objectContaining({
          card_states: expect.objectContaining({
            'card-1': expect.objectContaining({
              completed: true,
              last_outcome: 'correct',
            }),
          }),
        }),
      }));
    });
  });

  it('shows the unsupported hard-cutover state for pre-v4 guides', async () => {
    api.getStudyGuide.mockResolvedValue(legacyGuide);

    render(
      <MemoryRouter initialEntries={['/guide/guide-legacy']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    const unsupported = await screen.findByTestId('river-session-unsupported');
    expect(within(unsupported).getByText(/This guide is no longer supported/i)).toBeInTheDocument();
    expect(screen.queryByTestId('river-session-card')).not.toBeInTheDocument();
  });
});
