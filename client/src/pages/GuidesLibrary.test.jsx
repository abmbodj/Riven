import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GuidesLibrary from './GuidesLibrary.jsx';

vi.mock('../api', () => ({
  api: {
    getStudyGuides: vi.fn(),
    getNotes: vi.fn(),
    getClasses: vi.fn(),
    generateAiGuide: vi.fn(),
    deleteStudyGuide: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('../components/ConfirmModal', () => ({
  default: () => null,
}));

vi.mock('../components/ui/PricingModal', () => ({
  default: () => null,
}));

const { api } = await import('../api');

const makeGuide = (overrides = {}) => ({
  id: 'guide-1',
  title: 'Biology River Session',
  class_id: null,
  updated_at: '2026-04-03T10:00:00.000Z',
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
        {
          id: 'concept-cytokinesis',
          title: 'Cytokinesis',
          summary: 'Cytokinesis splits the cytoplasm after mitosis.',
          depends_on: ['concept-mitosis'],
          weak_points: ['timing'],
          misconception_tags: [],
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
        hints: [],
        feedback: {
          correct: ['Clean answer.'],
          partial: ['Partly there.'],
          incorrect: ['Reset around the outcome.'],
          empty: ['Start with the number of cells.'],
          misconception: [{ misconception_id: 'meiosis-mixup', responses: ['That describes meiosis, not mitosis.'] }],
        },
        river: { intro: 'Try it before I help.', success: 'That lands exactly where it should.', struggle: 'Let me narrow the frame.' },
        transitions: { on_correct: 'card-2', on_partial: 'retry', on_incorrect: 'hint', on_struggle: 'retry' },
        mastery_weight: 1,
      },
      {
        id: 'card-2',
        concept_id: 'concept-cytokinesis',
        phase: 'apply',
        difficulty: 'medium',
        card_type: 'short_answer',
        prompt: 'What does cytokinesis split?',
        target_answer: 'The cytoplasm.',
        required_idea_tags: ['splits-cytoplasm'],
        optional_idea_tags: [],
        misconception_tags: [],
        hints: [],
        feedback: {
          correct: ['Exactly.'],
          partial: ['Add what gets split.'],
          incorrect: ['Separate nuclear division from cytoplasmic division.'],
          empty: ['Name what gets divided after mitosis finishes.'],
          misconception: [],
        },
        river: { intro: 'Now apply the sequence.', success: 'That is clear.', struggle: 'Separate the jobs.' },
        transitions: { on_correct: null, on_partial: 'retry', on_incorrect: 'hint', on_struggle: 'retry' },
        mastery_weight: 1,
      },
    ],
    evaluation_rules: {
      score_bands: { correct: 0.85, partial: 0.4 },
      empty_patterns: ['idk'],
      tag_synonyms: {
        'two-daughter-cells': ['two daughter cells', '2 daughter cells'],
        'identical-genetic-material': ['same dna', 'genetically identical'],
        'splits-cytoplasm': ['the cytoplasm', 'splits the cytoplasm'],
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
        steady: { mastery_below: 80, river_expression: 'focus_lean_in', river_animation: 'ear_tilt_curious' },
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
    current_card_id: 'card-2',
    session_phase: 'apply',
    card_states: {
      'card-1': { attempts: 1, hints_used: 0, status: 'mastered', last_outcome: 'correct', completed: true },
      'card-2': { attempts: 0, hints_used: 0, status: 'unseen', last_outcome: null, completed: false },
    },
    concept_mastery: {
      'concept-mitosis': { score: 84, status: 'mastered', attempts: 1, correct_attempts: 1, last_outcome: 'correct' },
      'concept-cytokinesis': { score: 28, status: 'struggling', attempts: 1, correct_attempts: 0, last_outcome: 'incorrect' },
    },
    last_interaction_at: '2026-04-03T10:00:00.000Z',
    last_reviewed_at: '2026-04-03T10:00:00.000Z',
    completed_at: null,
  },
  ...overrides,
});

describe('GuidesLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getNotes.mockResolvedValue([]);
    api.getClasses.mockResolvedValue([]);
  });

  it('shows tutor-session progress metadata and a resume CTA for v4 guides', async () => {
    api.getStudyGuides.mockResolvedValue([makeGuide()]);

    render(
      <MemoryRouter>
        <GuidesLibrary />
      </MemoryRouter>
    );

    expect(await screen.findByText('Biology River Session')).toBeInTheDocument();
    expect(screen.getByText('Tutor session')).toBeInTheDocument();
    expect(screen.getByText(/resume river session/i)).toBeInTheDocument();
    expect(screen.getByText(/2 concepts/i)).toBeInTheDocument();
    expect(screen.getByText(/open session/i)).toBeInTheDocument();
  });

  it('shows adaptive mastery and review timing metadata for River sessions', async () => {
    api.getStudyGuides.mockResolvedValue([makeGuide()]);

    render(
      <MemoryRouter>
        <GuidesLibrary />
      </MemoryRouter>
    );

    expect(await screen.findByText('Biology River Session')).toBeInTheDocument();
    expect(screen.getByText(/weak concepts/i)).toBeInTheDocument();
    expect(screen.getByText(/mastery/i)).toBeInTheDocument();
    expect(screen.getByText(/review due/i)).toBeInTheDocument();
  });

  it('shows a start-session cue for untouched River sessions', async () => {
    api.getStudyGuides.mockResolvedValue([
      makeGuide({
        id: 'guide-untouched',
        title: 'Chemistry River Session',
        guide_data: {
          ...makeGuide().guide_data,
          session_meta: {
            ...makeGuide().guide_data.session_meta,
            subject: 'Chemistry',
            student_goal: 'Understand bonding',
          },
          knowledge_map: {
            concepts: [
              {
                id: 'concept-bonding',
                title: 'Chemical Bonding',
                summary: 'Ionic bonds transfer electrons.',
                depends_on: [],
                weak_points: ['bond-types'],
                misconception_tags: [],
              },
            ],
          },
          cards: [
            {
              ...makeGuide().guide_data.cards[0],
              id: 'card-bonding-1',
              concept_id: 'concept-bonding',
              prompt: 'Explain ionic versus covalent bonding.',
              target_answer: 'Ionic bonding transfers electrons; covalent bonding shares them.',
              transitions: { on_correct: null, on_partial: 'retry', on_incorrect: 'hint', on_struggle: 'retry' },
            },
          ],
        },
        study_state: {
          current_card_id: 'card-bonding-1',
          session_phase: 'diagnostic',
          card_states: {
            'card-bonding-1': { attempts: 0, hints_used: 0, status: 'unseen', last_outcome: null, completed: false },
          },
          concept_mastery: {
            'concept-bonding': { score: 0, status: 'unseen', attempts: 0, correct_attempts: 0, last_outcome: null },
          },
          last_interaction_at: null,
          last_reviewed_at: null,
          completed_at: null,
        },
      }),
    ]);

    render(
      <MemoryRouter>
        <GuidesLibrary />
      </MemoryRouter>
    );

    expect(await screen.findByText('Chemistry River Session')).toBeInTheDocument();
    expect(screen.getByText(/start session/i)).toBeInTheDocument();
    expect(screen.getByText(/next checkpoint: chemical bonding/i)).toBeInTheDocument();
  });

  it('hides pre-v4 guides from the library surface', async () => {
    api.getStudyGuides.mockResolvedValue([
      {
        id: 'guide-legacy',
        title: 'Legacy History Guide',
        format_version: 3,
        guide_data: {
          overview: 'Old guide',
          sections: [
            { id: 'old-1', title: 'Old section', recall_prompt: 'Old prompt', answer_points: ['Old answer'] },
          ],
        },
        study_state: {},
        content: { type: 'doc', content: [] },
      },
    ]);

    render(
      <MemoryRouter>
        <GuidesLibrary />
      </MemoryRouter>
    );

    expect(await screen.findByText(/no tutor sessions yet/i)).toBeInTheDocument();
    expect(screen.queryByText('Legacy History Guide')).not.toBeInTheDocument();
  });

  it('can create a tutor session from setup answers without separate source material', async () => {
    api.getStudyGuides.mockResolvedValue([]);
    api.generateAiGuide.mockResolvedValue({ guide_id: 'guide-setup' });

    render(
      <MemoryRouter>
        <GuidesLibrary />
      </MemoryRouter>
    );

    await screen.findByText(/no tutor sessions yet/i);
    fireEvent.click(screen.getByRole('button', { name: /create tutor session/i }));

    expect(await screen.findByText(/create tutor session/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/what are you studying for/i), {
      target: { value: 'Biology Midterm' },
    });
    fireEvent.change(screen.getByLabelText(/what topics should we cover/i), {
      target: { value: 'Cells, Mitosis' },
    });
    fireEvent.change(screen.getByLabelText(/which topics feel weakest right now/i), {
      target: { value: 'Mitosis' },
    });
    fireEvent.click(screen.getByRole('button', { name: /focused/i }));
    fireEvent.click(screen.getByRole('button', { name: /build tutor session/i }));

    await waitFor(() => {
      expect(api.generateAiGuide).toHaveBeenCalledWith(
        null,
        null,
        'Biology Midterm Tutor Session',
        null,
        null,
        null,
        null,
        expect.objectContaining({
          creationMode: 'setup',
          examLabel: 'Biology Midterm',
          userTopics: ['Cells', 'Mitosis'],
          weakTopics: ['Mitosis'],
          preferredTone: 'focused',
        }),
      );
    });
  });
});
