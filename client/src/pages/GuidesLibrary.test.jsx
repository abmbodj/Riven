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

describe('GuidesLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getNotes.mockResolvedValue([]);
    api.getClasses.mockResolvedValue([]);
  });

  it('shows study-session progress metadata and a resume CTA for v2 guides', async () => {
    api.getStudyGuides.mockResolvedValue([
      {
        id: 'guide-1',
        title: 'Biology Recall Workbook',
        class_id: null,
        updated_at: '2026-03-21T10:00:00.000Z',
        format_version: 2,
        guide_data: {
          overview: 'Review the core concepts.',
          sections: [
            {
              id: 'cell',
              title: 'Cell Theory',
              recall_prompt: 'Explain cell theory.',
              answer_points: ['All living things are made of cells.'],
              key_terms: ['cell'],
              mini_quiz: [],
              common_traps: [],
            },
            {
              id: 'mitosis',
              title: 'Mitosis',
              recall_prompt: 'Explain the stages of mitosis.',
              answer_points: ['Prophase comes first.'],
              key_terms: ['prophase'],
              mini_quiz: [],
              common_traps: [],
            },
          ],
        },
        study_state: {
          current_section_id: 'mitosis',
          section_states: {
            cell: { revealed: true, confidence: 'okay', completed: true, note: '' },
            mitosis: { revealed: false, confidence: null, completed: false, note: '' },
          },
          last_reviewed_at: '2026-03-20T14:00:00.000Z',
        },
      },
    ]);

    render(
      <MemoryRouter>
        <GuidesLibrary />
      </MemoryRouter>
    );

    expect(await screen.findByText('Biology Recall Workbook')).toBeInTheDocument();
    expect(screen.getByText('1/2 complete')).toBeInTheDocument();
    expect(screen.getByText('Exam coach')).toBeInTheDocument();
    expect(screen.getByText(/resume coach session/i)).toBeInTheDocument();
    expect(screen.getByText('2 checkpoints')).toBeInTheDocument();
    expect(screen.getByText(/next checkpoint: mitosis/i)).toBeInTheDocument();
    expect(screen.getByText(/open coach view/i)).toBeInTheDocument();
  });

  it('shows a start-session cue for untouched workbooks', async () => {
    api.getStudyGuides.mockResolvedValue([
      {
        id: 'guide-3',
        title: 'Chemistry Recall Workbook',
        class_id: null,
        updated_at: '2026-03-21T10:00:00.000Z',
        format_version: 2,
        guide_data: {
          overview: 'Review bonding basics.',
          sections: [
            {
              id: 'bonding',
              title: 'Chemical Bonding',
              recall_prompt: 'Explain ionic vs covalent bonds.',
              answer_points: ['Ionic bonds transfer electrons.'],
              key_terms: ['ionic', 'covalent'],
              mini_quiz: [],
              common_traps: [],
            },
          ],
        },
        study_state: {
          current_section_id: 'bonding',
          section_states: {
            bonding: { revealed: false, confidence: null, completed: false, note: '' },
          },
          last_reviewed_at: null,
        },
      },
    ]);

    render(
      <MemoryRouter>
        <GuidesLibrary />
      </MemoryRouter>
    );

    expect(await screen.findByText('Chemistry Recall Workbook')).toBeInTheDocument();
    expect(screen.getByText(/start session/i)).toBeInTheDocument();
    expect(screen.getByText(/next checkpoint: chemical bonding/i)).toBeInTheDocument();
  });

  it('shows adaptive mastery and review timing metadata for v3 coach guides', async () => {
    api.getStudyGuides.mockResolvedValue([
      {
        id: 'guide-v3',
        title: 'Adaptive Biology Coach',
        class_id: null,
        updated_at: '2026-04-03T10:00:00.000Z',
        format_version: 3,
        guide_data: {
          overview: 'Adaptive review.',
          topics: [
            {
              id: 'cells',
              title: 'Cells',
              subtopics: [
                {
                  id: 'membrane',
                  title: 'Cell Membrane',
                  summary: 'Transport and homeostasis.',
                  recall_prompt: 'Explain the cell membrane.',
                  answer_points: ['It regulates transport.'],
                  key_terms: [{ term: 'osmosis', definition: 'Water diffusion.' }],
                  checks: [{ prompt: 'What moves through osmosis?', answer: 'Water' }],
                  flashcards: [{ front: 'Osmosis', back: 'Water diffusion' }],
                  common_traps: ['Do not confuse it with active transport.'],
                  ai_helpers: { simpler: 'Smart gate.' },
                },
              ],
            },
          ],
        },
        study_state: {
          current_section_id: 'membrane',
          section_states: {
            membrane: {
              revealed: true,
              confidence: 'need_work',
              completed: true,
              note: '',
              last_reviewed_at: '2026-04-01T10:00:00.000Z',
              quiz_correct: 0,
              quiz_total: 1,
            },
          },
          last_reviewed_at: '2026-04-01T10:00:00.000Z',
        },
      },
    ]);

    render(
      <MemoryRouter>
        <GuidesLibrary />
      </MemoryRouter>
    );

    expect(await screen.findByText('Adaptive Biology Coach')).toBeInTheDocument();
    expect(screen.getAllByText(/exam coach/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/weak topics/i)).toBeInTheDocument();
    expect(screen.getByText(/mastery/i)).toBeInTheDocument();
    expect(screen.getByText(/review due/i)).toBeInTheDocument();
  });

  it('keeps legacy guides distinguishable in the library', async () => {
    api.getStudyGuides.mockResolvedValue([
      {
        id: 'guide-2',
        title: 'Legacy History Guide',
        class_id: null,
        updated_at: '2026-03-21T10:00:00.000Z',
        format_version: 1,
        content: { type: 'doc', content: [] },
      },
    ]);

    render(
      <MemoryRouter>
        <GuidesLibrary />
      </MemoryRouter>
    );

    expect(await screen.findByText('Legacy History Guide')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Legacy guide')).toBeInTheDocument();
      expect(screen.getByText('Convert to coach')).toBeInTheDocument();
    });
  });

  it('can create an exam coach from setup answers without separate source material', async () => {
    api.getStudyGuides.mockResolvedValue([]);
    api.generateAiGuide.mockResolvedValue({ guide_id: 'guide-setup' });

    render(
      <MemoryRouter>
        <GuidesLibrary />
      </MemoryRouter>
    );

    await screen.findByText(/no exam coaches yet/i);
    fireEvent.click(screen.getByRole('button', { name: /create exam coach/i }));

    expect(await screen.findByText(/create exam coach/i)).toBeInTheDocument();

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
    fireEvent.click(screen.getByRole('button', { name: /build exam coach/i }));

    await waitFor(() => {
      expect(api.generateAiGuide).toHaveBeenCalledWith(
        null,
        null,
        'Biology Midterm Coach',
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
