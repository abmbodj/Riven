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
  note_id: 'note-7',
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

const brokenWorkbook = {
  id: 'guide-10',
  title: 'Broken Workbook',
  class_id: 'class-4',
  format_version: 2,
  guide_data: null,
  study_state: {},
  content: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Fallback workbook summary' },
        ],
      },
    ],
  },
};

const mockMatchMedia = (matches = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe('GuideView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchMedia(false);
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

  it('keeps the richer workbook layout on desktop and reveals the active section answer', async () => {
    api.getStudyGuide.mockResolvedValue(buildV2Guide({
      current_section_id: 'treaty',
      section_states: {
        alliances: { revealed: true, confidence: 'okay', completed: true, note: '' },
        treaty: { revealed: false, confidence: null, completed: false, note: '' },
      },
      last_reviewed_at: '2026-03-20T14:00:00.000Z',
    }));

    render(
      <MemoryRouter initialEntries={['/guide/guide-7']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('World War I Workbook')).toBeInTheDocument();
    expect(screen.getByTestId('guide-screen').className).toContain('safe-area-bottom');
    expect(screen.queryByTestId('mobile-focus-shell')).not.toBeInTheDocument();
    expect(screen.getByTestId('workbook-shell-grid').className).toContain('grid-cols-1');
    expect(screen.getByTestId('workbook-shell-grid').className).toContain('xl:grid-cols-[1.45fr,0.95fr]');
    expect(screen.getByTestId('guide-session-layout').className).toContain('grid-cols-1');
    expect(screen.getByTestId('checkpoint-chip-row').className).toContain('overflow-x-auto');
    expect(screen.getByText(/study session/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resume session/i })).toBeInTheDocument();
    expect(screen.getByText(/pick up with treaty of versailles/i)).toBeInTheDocument();
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

  it('renders the mobile workbook in focus mode with collapsed details and note editing', async () => {
    mockMatchMedia(true);
    api.getStudyGuide.mockResolvedValue(buildV2Guide());

    render(
      <MemoryRouter initialEntries={['/guide/guide-7']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    const focusShell = await screen.findByTestId('mobile-focus-shell');
    const activeCard = screen.getByTestId('mobile-active-section-card');

    expect(within(focusShell).getByText(/active recall workbook/i)).toBeInTheDocument();
    expect(screen.queryByTestId('checkpoint-chip-row')).not.toBeInTheDocument();
    expect(screen.queryByText(/checkpoint map/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/session snapshot/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('mobile-bottom-bar')).toBeInTheDocument();

    fireEvent.click(within(activeCard).getByRole('button', { name: /reveal answer/i }));

    expect(await screen.findByText(/Treaties pulled additional countries into the war/i)).toBeInTheDocument();
    expect(screen.queryByText('Triple Entente')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /more details/i }));
    expect(screen.getAllByText('Triple Entente')).toHaveLength(2);
    expect(screen.getByText(/What alliance included Britain\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add note/i }));
    fireEvent.change(screen.getByLabelText(/personal note/i), {
      target: { value: 'Review this before the exam essay.' },
    });
    fireEvent.click(within(activeCard).getByRole('button', { name: /know it/i }));

    await waitFor(() => {
      expect(api.updateStudyGuide).toHaveBeenCalledWith('guide-7', expect.objectContaining({
        study_state: expect.objectContaining({
          current_section_id: 'alliances',
          section_states: expect.objectContaining({
            alliances: expect.objectContaining({
              confidence: 'know_it',
              completed: true,
              note: 'Review this before the exam essay.',
            }),
          }),
        }),
      }));
    });
  });

  it('opens a mobile sections sheet and updates the current checkpoint when a section is selected', async () => {
    mockMatchMedia(true);
    api.getStudyGuide.mockResolvedValue(buildV2Guide());

    render(
      <MemoryRouter initialEntries={['/guide/guide-7']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    const focusShell = await screen.findByTestId('mobile-focus-shell');
    fireEvent.click(within(focusShell).getByRole('button', { name: /sections/i }));

    const sectionsSheet = await screen.findByTestId('mobile-sections-sheet');
    expect(sectionsSheet.className.split(/\s+/)).toContain('bg-claude-bg/95');
    expect(sectionsSheet.className.split(/\s+/)).not.toContain('bg-claude-bg');
    expect(within(sectionsSheet).getByText(/0\/2 complete/i)).toBeInTheDocument();

    fireEvent.click(within(sectionsSheet).getByRole('button', { name: /treaty of versailles/i }));

    expect(await screen.findByRole('heading', { name: 'Treaty of Versailles' })).toBeInTheDocument();

    await waitFor(() => {
      expect(api.updateStudyGuide).toHaveBeenCalledWith('guide-7', expect.objectContaining({
        study_state: expect.objectContaining({
          current_section_id: 'treaty',
        }),
      }));
    });
  });

  it('moves secondary mobile actions into a single more sheet', async () => {
    mockMatchMedia(true);
    api.getStudyGuide.mockResolvedValue(buildV2Guide());

    render(
      <MemoryRouter initialEntries={['/guide/guide-7']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('World War I Workbook')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /more workbook actions/i }));

    const moreSheet = await screen.findByTestId('mobile-more-sheet');
    expect(moreSheet.className.split(/\s+/)).toContain('bg-claude-bg');
    expect(moreSheet.className.split(/\s+/)).not.toContain('bg-claude-bg/95');
    expect(within(moreSheet).getByRole('button', { name: /^share$/i })).toBeInTheDocument();
    expect(within(moreSheet).getByRole('button', { name: /flashcards/i })).toBeInTheDocument();
    expect(within(moreSheet).getByRole('button', { name: /mock exam/i })).toBeInTheDocument();
    expect(within(moreSheet).getByRole('button', { name: /rebuild workbook/i })).toBeInTheDocument();
    expect(within(moreSheet).getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
  });

  it('keeps classic guides editable and exposes a convert-to-workbook CTA', async () => {
    api.getStudyGuide.mockResolvedValue(legacyGuide);

    render(
      <MemoryRouter initialEntries={['/guide/guide-9']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('World War I Guide')).toBeInTheDocument();
    expect(screen.getByText(/classic guide/i)).toBeInTheDocument();
    expect(screen.getByTestId('guide-editor')).toHaveTextContent('Your study guide content...');
    expect(screen.getByRole('button', { name: /convert to workbook/i })).toBeInTheDocument();
  });

  it('rebuilds a legacy guide in place and swaps into workbook mode', async () => {
    let releaseDone;
    const doneSignal = new Promise((resolve) => {
      releaseDone = resolve;
    });

    api.getStudyGuide
      .mockResolvedValueOnce(legacyGuide)
      .mockResolvedValueOnce({
        ...buildV2Guide({
          current_section_id: 'treaty',
          section_states: {
            alliances: { revealed: true, confidence: 'okay', completed: true, note: '' },
            treaty: { revealed: false, confidence: null, completed: false, note: '' },
          },
          last_reviewed_at: '2026-03-20T14:00:00.000Z',
        }),
        id: 'guide-9',
        title: 'World War I Recall Workbook',
      });

    api.generateAiGuideStream.mockResolvedValue({
      chunks: async function* chunks() {
        await doneSignal;
        yield { type: 'done', data: { guide_id: 'guide-9', title: 'World War I Recall Workbook' } };
      },
    });

    render(
      <MemoryRouter initialEntries={['/guide/guide-9']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('World War I Guide')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /convert to workbook/i }));

    await waitFor(() => {
      expect(api.generateAiGuideStream).toHaveBeenCalledWith(
        'Treaty of Versailles summary',
        null,
        'World War I Guide Recall Workbook',
        null,
        'class-9',
        null,
        'guide-9',
      );
    });
    expect(await screen.findByText(/converting guide into a workbook/i)).toBeInTheDocument();
    expect(screen.queryByText(/classic guide/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('guide-editor')).not.toBeInTheDocument();

    releaseDone();

    expect(await screen.findByDisplayValue('World War I Recall Workbook')).toBeInTheDocument();
    expect(screen.getByText(/study session/i)).toBeInTheDocument();
    expect(screen.queryByText(/classic guide/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('guide-editor')).not.toBeInTheDocument();
  });

  it('shows an explicit workbook repair state instead of falling back to the legacy editor', async () => {
    api.getStudyGuide.mockResolvedValue(brokenWorkbook);

    render(
      <MemoryRouter initialEntries={['/guide/guide-10']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('Broken Workbook')).toBeInTheDocument();
    expect(screen.getByText(/workbook needs rebuilding/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rebuild workbook/i })).toBeInTheDocument();
    expect(screen.queryByText(/classic guide/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('guide-editor')).not.toBeInTheDocument();
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
