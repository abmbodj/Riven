import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GuideView from './GuideView.jsx';

const legacyGuideContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Updated treaty summary for sharing.' },
      ],
    },
  ],
};

vi.mock('../api', () => ({
  api: {
    getStudyGuide: vi.fn(),
    updateStudyGuide: vi.fn(),
    deleteStudyGuide: vi.fn(),
    generateAiDeckStream: vi.fn(),
    generateAiExamStream: vi.fn(),
    generateAiGuideStream: vi.fn(),
    getFriends: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('../components/editor/TiptapEditor', () => ({
  default: ({ placeholder, onUpdate }) => (
    <div>
      <div data-testid="guide-editor">{placeholder}</div>
      <button
        type="button"
        onClick={() => onUpdate?.(legacyGuideContent)}
      >
        Update guide content
      </button>
    </div>
  ),
}));

vi.mock('../components/ConfirmModal', () => ({
  default: () => null,
}));

vi.mock('../components/ui/PricingModal', () => ({
  default: () => null,
}));

const { api } = await import('../api');

const buildV2Guide = (studyState = {}) => ({
  id: 'guide-7',
  title: 'World War I Workbook',
  class_id: 'class-9',
  format_version: 2,
  guide_data: {
    overview: 'Review each front carefully before revealing the answer.',
    sections: [
      {
        id: 'alliances',
        title: 'Alliance System',
        recall_prompt: 'Explain how alliances escalated a regional conflict.',
        answer_points: ['Treaties pulled additional countries into the war.'],
        key_terms: ['Triple Entente'],
        mini_quiz: [{ prompt: 'What alliance included Britain?', answer: 'Triple Entente' }],
        common_traps: ['Do not treat alliances as the only cause.'],
      },
      {
        id: 'treaty',
        title: 'Treaty of Versailles',
        recall_prompt: 'List the treaty terms that shaped post-war Europe.',
        answer_points: ['Germany accepted blame and reparations.'],
        key_terms: ['reparations'],
        mini_quiz: [{ prompt: 'Who accepted war guilt?', answer: 'Germany' }],
        common_traps: ['Armistice and treaty are different events.'],
      },
    ],
  },
  study_state: {
    current_section_id: 'alliances',
    section_states: {
      alliances: { revealed: false, confidence: null, completed: false, note: '' },
      treaty: { revealed: false, confidence: null, completed: false, note: '' },
    },
    last_reviewed_at: null,
    ...studyState,
  },
  content: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Workbook summary preview' }],
      },
    ],
  },
});

const legacyGuide = {
  id: 'guide-9',
  title: 'World War I Guide',
  class_id: 'class-9',
  format_version: 1,
  content: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Treaty of Versailles summary' },
        ],
      },
    ],
  },
};

describe('GuideView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.updateStudyGuide.mockImplementation(async (id, updates) => {
      const base = api.getStudyGuide.mock.results[0]?.value
        ? await api.getStudyGuide.mock.results[0].value
        : buildV2Guide();

      return {
        ...base,
        id,
        ...updates,
        format_version: updates.format_version ?? base.format_version,
        guide_data: updates.guide_data ?? base.guide_data,
        study_state: updates.study_state ?? base.study_state,
        content: updates.content ?? base.content,
      };
    });
  });

  it('renders v2 guides in review mode and reveals the active section answer', async () => {
    api.getStudyGuide.mockResolvedValue(buildV2Guide({
      current_section_id: 'treaty',
    }));

    render(
      <MemoryRouter initialEntries={['/guide/guide-7']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('World War I Workbook')).toBeInTheDocument();
    expect(screen.getByText(/active recall workbook/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Treaty of Versailles' })).toBeInTheDocument();
    expect(screen.queryByText(/Germany accepted blame and reparations/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reveal answer/i }));

    expect(await screen.findByText(/Germany accepted blame and reparations/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /know it/i }));

    await waitFor(() => {
      expect(api.updateStudyGuide).toHaveBeenCalledWith('guide-7', expect.objectContaining({
        title: 'World War I Workbook',
        study_state: expect.objectContaining({
          current_section_id: 'treaty',
          section_states: expect.objectContaining({
            treaty: expect.objectContaining({
              revealed: true,
              confidence: 'know_it',
              completed: true,
            }),
          }),
        }),
      }));
    });
  });

  it('persists section notes and resume position when moving through workbook sections', async () => {
    api.getStudyGuide.mockResolvedValue(buildV2Guide());

    render(
      <MemoryRouter initialEntries={['/guide/guide-7']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Alliance System' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/personal note/i), {
      target: { value: 'Review this before the exam essay.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next section/i }));

    expect(await screen.findByRole('heading', { name: 'Treaty of Versailles' })).toBeInTheDocument();

    await waitFor(() => {
      expect(api.updateStudyGuide).toHaveBeenCalledWith('guide-7', expect.objectContaining({
        study_state: expect.objectContaining({
          current_section_id: 'treaty',
          section_states: expect.objectContaining({
            alliances: expect.objectContaining({
              note: 'Review this before the exam essay.',
            }),
          }),
        }),
      }));
    });
  });

  it('keeps legacy guides editable and exposes a workbook regeneration CTA', async () => {
    api.getStudyGuide.mockResolvedValue(legacyGuide);

    render(
      <MemoryRouter initialEntries={['/guide/guide-9']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('World War I Guide')).toBeInTheDocument();
    expect(screen.getByTestId('guide-editor')).toHaveTextContent('Your study guide content...');
    expect(screen.getByRole('button', { name: /regenerate workbook/i })).toBeInTheDocument();
  });

  it('flushes pending autosave before sharing a legacy guide', async () => {
    api.getStudyGuide.mockResolvedValue(legacyGuide);
    api.getFriends.mockResolvedValue([
      { id: 12, username: 'Bianca', avatar: null },
    ]);
    api.sendMessage.mockResolvedValue({ id: 99 });

    const { container } = render(
      <MemoryRouter initialEntries={['/guide/guide-9']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('World War I Guide')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /update guide content/i }));

    const stickyHeader = container.querySelector('div.sticky.top-0');
    fireEvent.click(within(stickyHeader).getByRole('button', { name: /share guide/i }));

    expect(await screen.findByText('Share Guide')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() => {
      expect(api.updateStudyGuide).toHaveBeenCalledWith('guide-9', {
        title: 'World War I Guide',
        content: legacyGuideContent,
      });
      expect(api.sendMessage).toHaveBeenCalledWith(
        12,
        'Shared a guide: World War I Guide',
        'guide',
        expect.objectContaining({
          kind: 'guide',
          sourceId: 'guide-9',
          title: 'World War I Guide',
          previewText: 'Updated treaty summary for sharing.',
        }),
      );
    });
  });
});
