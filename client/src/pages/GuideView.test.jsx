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
    assistStudyCoach: vi.fn(),
    warmupAiFunctions: vi.fn(),
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
      lecture_style: 'storybook seminar',
      river_role: 'witty garden lecture frog',
    },
    lecture: {
      opening: 'Welcome to today’s River lecture on how cell division actually works.',
      agenda: [
        'Lock the outcome of mitosis.',
        'Separate mitosis from meiosis.',
      ],
      closing: 'You do not need perfection here. You need a clean mental frame you can retrieve again.',
    },
    river: {
      name: 'River',
      species: 'pond frog',
      style: 'garden guide mascot',
      tone: 'calm, precise, encouraging',
      default_expression: 'blink_soft',
      default_animation: 'pond_breath_idle',
      cue_map: {
        idle: { expression: 'blink_soft', animation: 'pond_breath_idle' },
        focus: { expression: 'steady_gaze', animation: 'crouch_listen_focus' },
        recover: { expression: 'gentle_reassure', animation: 'forelimb_offer_hint' },
        mastery: { expression: 'calm_pride', animation: 'reed_glow_mastery' },
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
          { level: 1, text: 'Think about how many cells you end with.', cue: { expression: 'reflective_blink', animation: 'forelimb_offer_hint' } },
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
        teaching: {
          explain: 'Mitosis is the division step that preserves the original genetic blueprint while making two new cells.',
          example: 'If your skin needs repair, mitosis helps create replacement cells with the same DNA instructions.',
          steps: [
            'Start with one parent cell.',
            'Copy the DNA so the information is ready to share.',
            'Separate the copies so each new cell gets the same set.',
          ],
          why_it_matters: 'This is the foundation for growth, repair, and keeping body tissues genetically consistent.',
        },
        assist_options: [
          {
            id: 'explain-simply',
            label: 'Explain simply',
            text: 'In simple terms: mitosis makes two matching replacement cells.',
            pose: 'encourage',
          },
          {
            id: 'show-example',
            label: 'Show another example',
            text: 'A healing cut uses mitosis to make more skin cells with the same DNA as the original ones.',
            pose: 'point',
          },
          {
            id: 'break-it-down',
            label: 'Break it down',
            text: 'One cell copies its DNA, lines it up, and splits into two equal genetic matches.',
            pose: 'teach',
          },
          {
            id: 'why-it-matters',
            label: 'Why this matters',
            text: 'If you confuse mitosis, you will also confuse how the body grows and repairs itself.',
            pose: 'thinking',
          },
        ],
        presentation: {
          pose: 'teach',
          emphasis_target: 'Two genetically identical daughter cells',
          reaction_cue: { expression: 'steady_gaze', animation: 'crouch_listen_focus' },
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
      pass_threshold: 0.5,
      partial_advances: true,
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
        struggling: { mastery_below: 45, river_expression: 'gentle_reassure', river_animation: 'forelimb_offer_hint' },
        mastery: { mastery_below: 101, river_expression: 'calm_pride', river_animation: 'reed_glow_mastery' },
      },
    },
    completion: {
      title: 'Session complete',
      mastery_message: 'You converted recall into structure.',
      confidence_close: 'One more clean retrieval tomorrow will lock it in.',
      next_review_message: 'Return tomorrow for a short reinforcement pass.',
      river_cue: { expression: 'calm_pride', animation: 'reed_glow_mastery' },
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

const makeToctGuide = () => makeGuide({
  id: 'guide-toct-1',
  title: 'Architecture Tutor Session',
  guide_data: {
    ...makeGuide().guide_data,
    cards: [
      {
        ...makeGuide().guide_data.cards[0],
        id: 'card-toct-1',
        prompt: 'How should a system design describe a web app?',
        target_answer: 'It should show components, data flow, APIs, and tradeoffs.',
        teaching: {
          explain: 'A system design is a map of the important parts of software and how those parts talk to each other.',
          intuition: 'Think of it like a campus map: buildings matter, but the paths between them explain how people actually move.',
          worked_examples: [
            {
              title: 'Checkout service',
              problem: 'Design the checkout path for a small store.',
              steps: [
                { step: 'Identify the browser, API server, payment provider, and database.', detail: 'These are the components that must cooperate.' },
                { step: 'Draw the payment request and confirmation flow.', detail: 'The arrows reveal the system behavior.' },
              ],
              result: 'The diagram explains both structure and flow.',
              takeaway: 'Good architecture names the parts and the paths.',
            },
          ],
          common_mistakes: ['Listing tools without showing how data moves.'],
          example: 'A store might include a React UI, Node API, Stripe, and Postgres.',
          steps: ['Name components.', 'Trace data flow.', 'Mark tradeoffs.'],
          why_it_matters: 'Architecture helps teams make changes without breaking hidden dependencies.',
        },
      },
    ],
  },
  study_state: {
    ...makeGuide().study_state,
    current_card_id: 'card-toct-1',
    card_states: {
      'card-toct-1': { attempts: 0, hints_used: 0, status: 'active', last_outcome: null, completed: false },
    },
  },
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
      stats: { xpTotal: 240, level: 3 },
      sessionOutcome: 'complete',
    });
    api.assistStudyCoach.mockResolvedValue({
      answer: 'River: focus on the outcome, not the stage names.',
      fallbackUsed: true,
    });
  });

  it('renders the River lecture flow and completes on a good-enough answer', async () => {
    api.getStudyGuide.mockResolvedValue(makeGuide());

    render(
      <MemoryRouter initialEntries={['/guide/guide-river-1']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    const intro = await screen.findByTestId('river-session-intro');
    expect(within(intro).getByText(/today's lecture/i)).toBeInTheDocument();
    expect(within(intro).getByText('Cell Division Tutor Session')).toBeInTheDocument();
    expect(within(intro).getAllByText(/Welcome to today’s River lecture/i).length).toBeGreaterThan(0);
    expect(within(intro).getByTestId('river-mascot')).toHaveAttribute('data-river-state', 'idle');
    expect(within(intro).getByRole('button', { name: /start with river/i })).toBeInTheDocument();

    fireEvent.click(within(intro).getByRole('button', { name: /start with river/i }));

    const teach = await screen.findByTestId('river-session-teach');
    expect(within(teach).getByTestId('river-mascot')).toHaveAttribute('data-river-state', 'teach');
    expect(within(teach).getAllByText(/Mitosis is the division step/i).length).toBeGreaterThan(0);
    expect(within(teach).getByRole('button', { name: /Explain simply/i })).toBeInTheDocument();
    expect(within(teach).getByRole('button', { name: /Show another example/i })).toBeInTheDocument();
    expect(within(teach).getByRole('button', { name: /Break it down/i })).toBeInTheDocument();
    expect(within(teach).getByRole('button', { name: /Why this matters/i })).toBeInTheDocument();

    fireEvent.click(within(teach).getByRole('button', { name: /i'm ready to answer/i }));

    const check = await screen.findByTestId('river-session-check');
    expect(within(check).queryByRole('button', { name: /ask river/i })).not.toBeInTheDocument();
    expect(within(check).getByTestId('river-mascot')).toHaveAttribute('data-river-state', 'thinking');
    expect(within(check).getByText(/What is the main outcome of mitosis/i)).toBeInTheDocument();

    fireEvent.change(within(check).getByLabelText(/your answer/i), {
      target: { value: 'Mitosis makes two daughter cells.' },
    });
    fireEvent.click(within(check).getByRole('button', { name: /submit answer/i }));

    const feedback = await screen.findByTestId('river-session-feedback');
    expect(within(feedback).getAllByText(/got the backbone/i).length).toBeGreaterThan(0);
    expect(within(feedback).getByText(/Two genetically identical daughter cells/i)).toBeInTheDocument();
    expect(within(feedback).getByTestId('river-mascot')).toHaveAttribute('data-river-state', 'encourage');

    fireEvent.click(within(feedback).getByRole('button', { name: /keep going/i }));

    const finish = await screen.findByTestId('river-session-complete');
    expect(within(finish).getByRole('heading', { name: /Session complete/i })).toBeInTheDocument();
    expect(within(finish).getByTestId('river-mascot')).toHaveAttribute('data-river-state', 'celebrate');
    expect(api.completeStudyCoachSession).toHaveBeenCalledWith(expect.objectContaining({
      guideId: 'guide-river-1',
      sessionOutcome: 'complete',
      exitReason: 'finished',
      studyStateAfter: expect.objectContaining({
        completed_at: expect.any(String),
        session_status: 'complete',
        active_stage: 'complete',
      }),
    }));

    await waitFor(() => {
      expect(api.updateStudyGuide).toHaveBeenCalledWith('guide-river-1', expect.objectContaining({
        study_state: expect.objectContaining({
          card_states: expect.objectContaining({
            'card-1': expect.objectContaining({
              completed: true,
              last_outcome: 'partial',
            }),
          }),
        }),
      }));
    });
  });

  it('places River as a pointing board teacher beside the active TOCT lecture text', async () => {
    api.getStudyGuide.mockResolvedValue(makeToctGuide());

    render(
      <MemoryRouter initialEntries={['/guide/guide-toct-1']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /start with river/i }));

    const teach = await screen.findByTestId('river-session-teach');
    const boardTeacher = within(teach).getByTestId('desktop-board-teacher');
    const boardFrame = within(teach).getByTestId('river-board-frame');
    const boardSurface = within(teach).getByTestId('river-board-surface');
    const boardContent = within(teach).getByTestId('river-board-content');
    expect(boardTeacher).toBeInTheDocument();
    expect(boardFrame).not.toContainElement(boardTeacher);
    expect(boardSurface).not.toContainElement(boardTeacher);
    expect(boardContent.className).not.toContain('lg:px-[10rem]');
    expect(boardContent.className).not.toContain('xl:px-[12rem]');
    expect(boardTeacher).toHaveAttribute('data-river-side', 'right');
    const teacherRig = within(boardTeacher).getByTestId('desktop-board-teacher-rig');
    expect(within(boardTeacher).getByTestId('desktop-board-teacher-perch')).toBeInTheDocument();
    expect(within(boardTeacher).queryByTestId('desktop-board-teacher-grip')).not.toBeInTheDocument();
    expect(within(boardTeacher).getByTestId('desktop-board-teacher-pointer')).toBeInTheDocument();
    const woodenStick = within(boardTeacher).getByTestId('desktop-board-teacher-stick');
    expect(woodenStick).toBeInTheDocument();
    expect(woodenStick).toHaveAttribute('fill', 'url(#river-pointer-wood)');
    expect(within(boardTeacher).getByTestId('desktop-board-teacher-stick-tip')).toBeInTheDocument();
    expect(teacherRig.getAttribute('style') || '').not.toContain('clip-path');
    expect(within(boardTeacher).getByTestId('river-mascot')).toHaveAttribute('data-river-state', 'point');
    expect(within(boardTeacher).getByTestId('river-mascot')).toHaveAttribute('data-river-variant', 'board-teacher');

    let activeTarget = teach.querySelector('[data-current-teach-target="true"]');
    expect(activeTarget).toHaveTextContent(/A system design is a map/i);
    expect(activeTarget.className).not.toContain('-mx-3');
    expect(activeTarget.className).not.toContain('px-3');

    fireEvent.click(within(teach).getByRole('button', { name: /Continue.*The Why/i }));

    await waitFor(() => {
      activeTarget = teach.querySelector('[data-current-teach-target="true"]');
      expect(activeTarget).toHaveTextContent(/campus map/i);
    });
    expect(within(boardTeacher).getByTestId('river-mascot')).toHaveAttribute('data-river-state', 'point');
  });

  it('reveals smart teaching chips without calling live assist', async () => {
    api.getStudyGuide.mockResolvedValue(makeGuide());

    render(
      <MemoryRouter initialEntries={['/guide/guide-river-1']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /start with river/i }));

    const teach = await screen.findByTestId('river-session-teach');
    fireEvent.click(within(teach).getByRole('button', { name: /Break it down/i }));

    await waitFor(() => {
      expect(within(teach).getAllByText(/One cell copies its DNA/i).length).toBeGreaterThan(0);
    });
    expect(api.assistStudyCoach).not.toHaveBeenCalled();
    expect(within(teach).getByTestId('river-mascot')).toHaveAttribute('data-river-state', 'teach');
  });

  it('uses gentle correction for misconception answers and still lets the learner continue', async () => {
    api.getStudyGuide.mockResolvedValue(makeGuide());

    render(
      <MemoryRouter initialEntries={['/guide/guide-river-1']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /start with river/i }));

    const teach = await screen.findByTestId('river-session-teach');
    fireEvent.click(within(teach).getByRole('button', { name: /i'm ready to answer/i }));

    const check = await screen.findByTestId('river-session-check');
    fireEvent.change(within(check).getByLabelText(/your answer/i), {
      target: { value: 'It makes four daughter cells.' },
    });
    fireEvent.click(within(check).getByRole('button', { name: /submit answer/i }));

    const feedback = await screen.findByTestId('river-session-feedback');
    expect(within(feedback).getByText(/That describes meiosis, not mitosis/i)).toBeInTheDocument();
    expect(within(feedback).getByTestId('river-mascot')).toHaveAttribute('data-river-state', 'gentle-correct');
    expect(within(feedback).getByRole('button', { name: /mark for later/i })).toBeInTheDocument();
  });

  it('pauses and returns to the library when the learner saves and leaves early', async () => {
    api.getStudyGuide.mockResolvedValue(makeGuide());

    render(
      <MemoryRouter initialEntries={['/guide/guide-river-1']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
          <Route path="/guides" element={<div data-testid="guides-route">Guides</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /start with river/i }));

    const teach = await screen.findByTestId('river-session-teach');
    fireEvent.click(within(teach).getByRole('button', { name: /save and leave/i }));

    expect(await screen.findByTestId('guides-route')).toBeInTheDocument();
    expect(api.completeStudyCoachSession).not.toHaveBeenCalled();
    expect(api.updateStudyGuide).toHaveBeenCalledWith('guide-river-1', expect.objectContaining({
      study_state: expect.objectContaining({
        current_card_id: 'card-1',
        session_status: 'paused',
        active_stage: 'teach',
        teach_section_index: 0,
        explain_revealed_count: 1,
        paused_at: expect.any(String),
        completed_at: null,
      }),
    }));
  });

  it('restores directly into the saved stage on re-entry', async () => {
    api.getStudyGuide.mockResolvedValue(makeGuide({
      study_state: {
        ...makeGuide().study_state,
        session_status: 'paused',
        active_stage: 'check',
        teach_section_index: 0,
        explain_revealed_count: 1,
        paused_at: '2026-04-05T12:00:00.000Z',
        last_interaction_at: '2026-04-05T12:00:00.000Z',
      },
    }));

    render(
      <MemoryRouter initialEntries={['/guide/guide-river-1']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    const check = await screen.findByTestId('river-session-check');
    expect(within(check).getByText(/What is the main outcome of mitosis/i)).toBeInTheDocument();
    expect(within(check).getByTestId('river-mascot')).toHaveAttribute('data-river-state', 'thinking');
    expect(screen.queryByTestId('river-session-intro')).not.toBeInTheDocument();
  });

  it('pauses instead of completing when the learner uses the back control mid-session', async () => {
    api.getStudyGuide.mockResolvedValue(makeGuide());

    render(
      <MemoryRouter initialEntries={['/guide/guide-river-1']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
          <Route path="/guides" element={<div data-testid="guides-route">Guides</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /start with river/i }));

    const teach = await screen.findByTestId('river-session-teach');
    expect(within(teach).getAllByText(/Mitosis is the division step/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /back to tutor sessions/i }));

    expect(await screen.findByTestId('guides-route')).toBeInTheDocument();
    expect(api.completeStudyCoachSession).not.toHaveBeenCalled();
    expect(api.updateStudyGuide).toHaveBeenCalledWith('guide-river-1', expect.objectContaining({
      study_state: expect.objectContaining({
        session_status: 'paused',
        active_stage: 'teach',
        paused_at: expect.any(String),
      }),
    }));
  });

  it('starts a repeat review pass from a completed session without clearing mastery history', async () => {
    api.getStudyGuide.mockResolvedValue(makeGuide({
      study_state: {
        ...makeGuide().study_state,
        session_status: 'complete',
        active_stage: 'complete',
        completed_at: '2026-04-05T12:00:00.000Z',
        last_reviewed_at: '2026-04-05T12:00:00.000Z',
        concept_mastery: {
          'concept-mitosis': { score: 34, status: 'struggling', attempts: 2, correct_attempts: 0, last_outcome: 'incorrect' },
        },
      },
    }));

    render(
      <MemoryRouter initialEntries={['/guide/guide-river-1']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    const complete = await screen.findByTestId('river-session-complete');
    fireEvent.click(within(complete).getByRole('button', { name: /start review pass/i }));

    const teach = await screen.findByTestId('river-session-teach');
    expect(within(teach).getAllByText(/Mitosis is the division step/i).length).toBeGreaterThan(0);
    expect(api.updateStudyGuide).toHaveBeenCalledWith('guide-river-1', expect.objectContaining({
      study_state: expect.objectContaining({
        session_status: 'active',
        active_stage: 'teach',
        completed_at: null,
        concept_mastery: expect.objectContaining({
          'concept-mitosis': expect.objectContaining({
            score: 34,
            status: 'struggling',
          }),
        }),
      }),
    }));
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
