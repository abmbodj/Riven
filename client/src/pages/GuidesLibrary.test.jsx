import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
    expect(screen.getByText('Study session')).toBeInTheDocument();
    expect(screen.getByText('2 checkpoints')).toBeInTheDocument();
    expect(screen.getByText(/next: mitosis/i)).toBeInTheDocument();
    expect(screen.getByText(/resume session/i)).toBeInTheDocument();
    expect(screen.getByText(/open study session/i)).toBeInTheDocument();
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
    expect(screen.getByText(/next: chemical bonding/i)).toBeInTheDocument();
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
      expect(screen.getByText('Classic guide')).toBeInTheDocument();
      expect(screen.getByText('Convert to workbook')).toBeInTheDocument();
    });
  });
});
