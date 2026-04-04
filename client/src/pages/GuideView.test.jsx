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

vi.mock('../components/StudySection.jsx', () => ({
  default: ({ section, sectionState, onReveal, onConfidenceSelect, onComplete }) => (
    <div data-testid="study-section">
      <p data-testid="study-section-title">{section.title}</p>
      <p data-testid="study-section-prompt">{section.recall_prompt}</p>
      {!sectionState.revealed ? (
        <button type="button" onClick={onReveal}>Reveal Answer</button>
      ) : (
        <div>
          {section.answer_points.map((point) => <p key={point}>{point}</p>)}
          <button type="button" onClick={() => onConfidenceSelect('know_it')}>Know it</button>
          <button type="button" onClick={() => onConfidenceSelect('okay')}>Okay</button>
          <button type="button" onClick={() => onConfidenceSelect('struggled')}>Struggled</button>
        </div>
      )}
      <button type="button" onClick={onComplete}>Complete section</button>
    </div>
  ),
}));

vi.mock('../components/GuideProgressDashboard.jsx', () => ({
  default: ({ guideData: _guideData, studyState: _studyState, onStartWeakSession }) => (
    <div data-testid="guide-progress-dashboard">
      <p>Progress Dashboard</p>
      <button type="button" onClick={onStartWeakSession}>Start weak session</button>
    </div>
  ),
}));

vi.mock('../components/QuizMeMode.jsx', () => ({
  default: ({ questions, onComplete }) => (
    <div data-testid="quiz-me-mode">
      <p>Quiz Mode ({questions.length} questions)</p>
      <button type="button" onClick={onComplete}>Finish quiz</button>
    </div>
  ),
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
  const renderGuide = () => {
    api.getStudyGuide.mockResolvedValue(buildV2Guide());
    return render(
      <MemoryRouter initialEntries={['/guide/guide-7']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

  it('shows session entry screen on desktop and can start a full session to study a section', async () => {
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

    const entryScreen = await screen.findByTestId('session-entry');
    expect(screen.getByTestId('guide-screen').className).toContain('safe-area-bottom');
    expect(within(entryScreen).getByRole('heading', { name: 'World War I Workbook' })).toBeInTheDocument();
    const workspaceGrid = screen.getByTestId('workbook-shell-grid');
    const desktopRail = screen.getByTestId('desktop-guide-rail');
    const desktopStage = screen.getByTestId('desktop-guide-stage');
    const desktopContext = screen.getByTestId('desktop-guide-context');
    expect(workspaceGrid).toBeInTheDocument();
    expect(workspaceGrid).toHaveAttribute('data-desktop-layout', 'adaptive');
    expect(desktopRail).toBeInTheDocument();
    expect(desktopStage).toHaveClass('lg:col-start-2');
    expect(desktopContext).toHaveClass('lg:row-start-2');
    expect(desktopContext.className).toContain('2xl:col-start-3');
    expect(screen.queryByTestId('mobile-focus-shell')).not.toBeInTheDocument();
    expect(within(desktopRail).getByRole('button', { name: /Alliance System/i })).toBeInTheDocument();

    // Expand other options to access full session / quiz me / quick session chips
    fireEvent.click(within(entryScreen).getByRole('button', { name: /other options/i }));
    expect(screen.getByTestId('checkpoint-chip-row')).toBeInTheDocument();
    expect(within(entryScreen).getByRole('button', { name: /full session/i })).toBeInTheDocument();
    expect(within(entryScreen).getByRole('button', { name: /quiz me/i })).toBeInTheDocument();

    // Navigate into full session (starts at first section = alliances, already revealed)
    fireEvent.click(within(entryScreen).getByRole('button', { name: /full session/i }));

    const studyingScreen = await screen.findByTestId('session-studying');
    expect(screen.queryByTestId('session-entry')).not.toBeInTheDocument();
    expect(screen.getByTestId('desktop-guide-context')).toBeInTheDocument();
    const studySection = within(studyingScreen).getByTestId('study-section');
    expect(studySection).toBeInTheDocument();
    // alliances is already revealed, so answer points are shown — rate confidence
    expect(within(studySection).getByText(/Treaties pulled additional countries into the war/i)).toBeInTheDocument();
    fireEvent.click(within(studySection).getByRole('button', { name: /know it/i }));

    await waitFor(() => {
      expect(api.updateStudyGuide).toHaveBeenCalledWith('guide-7', expect.objectContaining({
        study_state: expect.objectContaining({
          section_states: expect.objectContaining({
            alliances: expect.objectContaining({
              revealed: true,
              confidence: 'know_it',
              last_reviewed_at: expect.any(String),
            }),
          }),
        }),
      }));
    });
  });

  it('uses a compact desktop studying rail and a collapsible note module', async () => {
    api.getStudyGuide.mockResolvedValue(buildV2Guide());

    render(
      <MemoryRouter initialEntries={['/guide/guide-7']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    const entryScreen = await screen.findByTestId('session-entry');
    fireEvent.click(within(entryScreen).getByRole('button', { name: /other options/i }));
    fireEvent.click(within(entryScreen).getByRole('button', { name: /full session/i }));

    await screen.findByTestId('session-studying');

    expect(screen.getByTestId('desktop-rail-overview')).toHaveClass('guide-clamp-4');

    const noteModule = screen.getByTestId('desktop-note-module');
    expect(within(noteModule).getByText(/keep one short memory hook here when you need it/i)).toBeInTheDocument();
    expect(within(noteModule).queryByTestId('desktop-note-textarea')).not.toBeInTheDocument();

    fireEvent.click(within(noteModule).getByTestId('desktop-note-toggle'));

    expect(within(noteModule).getByTestId('desktop-note-textarea')).toBeInTheDocument();
  });

  it('renders the mobile workbook session entry and allows starting a quick session', async () => {
    mockMatchMedia(true);
    api.getStudyGuide.mockResolvedValue(buildV2Guide());

    render(
      <MemoryRouter initialEntries={['/guide/guide-7']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    const entryScreen = await screen.findByTestId('session-entry');
    expect(within(entryScreen).getByRole('heading', { name: 'World War I Workbook' })).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-focus-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-bottom-bar')).not.toBeInTheDocument();

    // Expand other options to reveal quick session chips
    fireEvent.click(within(entryScreen).getByRole('button', { name: /other options/i }));
    expect(screen.getByTestId('checkpoint-chip-row')).toBeInTheDocument();

    // Start a quick 5-min session
    fireEvent.click(within(entryScreen).getByRole('button', { name: /5 min/i }));

    const studyingScreen = await screen.findByTestId('session-studying');
    expect(screen.queryByTestId('session-entry')).not.toBeInTheDocument();
    expect(screen.getByTestId('mobile-focus-shell')).toBeInTheDocument();
    expect(within(studyingScreen).getByTestId('study-section')).toBeInTheDocument();

    // Reveal and rate confidence to trigger save
    fireEvent.click(within(studyingScreen).getByRole('button', { name: /reveal answer/i }));
    fireEvent.click(within(studyingScreen).getByRole('button', { name: /know it/i }));

    await waitFor(() => {
      expect(api.updateStudyGuide).toHaveBeenCalledWith('guide-7', expect.objectContaining({
        study_state: expect.objectContaining({
          section_states: expect.objectContaining({
            alliances: expect.objectContaining({
              confidence: 'know_it',
              revealed: true,
            }),
          }),
        }),
      }));
    });
  });

  it('opens the mobile more sheet from the header menu', async () => {
    mockMatchMedia(true);
    api.getStudyGuide.mockResolvedValue(buildV2Guide());

    render(
      <MemoryRouter initialEntries={['/guide/guide-7']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByTestId('session-entry');

    fireEvent.click(screen.getByRole('button', { name: /more workbook actions/i }));

    const moreSheet = await screen.findByTestId('mobile-more-sheet');
    expect(moreSheet).toBeInTheDocument();
    expect(within(moreSheet).getByRole('button', { name: /^share$/i })).toBeInTheDocument();
  });

  it('keeps secondary mobile actions inside the opaque more sheet', async () => {
    mockMatchMedia(true);
    api.getStudyGuide.mockResolvedValue(buildV2Guide());

    render(
      <MemoryRouter initialEntries={['/guide/guide-7']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByTestId('session-entry');
    fireEvent.click(screen.getByRole('button', { name: /more workbook actions/i }));

    const moreSheet = await screen.findByTestId('mobile-more-sheet');
    expect(moreSheet.className.split(/\s+/)).toContain('bg-claude-bg/95');
    expect(within(moreSheet).getByRole('button', { name: /^share$/i })).toBeInTheDocument();
    expect(within(moreSheet).getByRole('button', { name: /flashcards/i })).toBeInTheDocument();
    expect(within(moreSheet).getByRole('button', { name: /mock exam/i })).toBeInTheDocument();
    expect(within(moreSheet).getByRole('button', { name: /rebuild workbook/i })).toBeInTheDocument();
    expect(within(moreSheet).getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
  });

  it('shows session-studying screen with sections sheet and note sheet on mobile', async () => {
    mockMatchMedia(true);
    api.getStudyGuide.mockResolvedValue(buildV2Guide());

    render(
      <MemoryRouter initialEntries={['/guide/guide-7']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    const entryScreen = await screen.findByTestId('session-entry');
    fireEvent.click(within(entryScreen).getByRole('button', { name: /other options/i }));
    fireEvent.click(within(entryScreen).getByRole('button', { name: /full session/i }));

    const studyingScreen = await screen.findByTestId('session-studying');
    expect(screen.getByTestId('mobile-focus-shell')).toBeInTheDocument();
    expect(within(studyingScreen).getByTestId('study-section')).toBeInTheDocument();

    // Sections and Note sheets are rendered by GuideView — verify the rail is accessible
    // (dock buttons live in MobileBottomNav outside this render, so sheets are tested
    //  via the mobile-more-sheet path instead)
    fireEvent.click(screen.getByRole('button', { name: /more workbook actions/i }));
    const moreSheet = await screen.findByTestId('mobile-more-sheet');
    expect(moreSheet).toBeInTheDocument();
  });

  it('enters studying mode for a quiz-only section on mobile', async () => {
    mockMatchMedia(true);
    const quizOnlyGuide = buildV2Guide();
    quizOnlyGuide.guide_data.sections = [
      {
        ...quizOnlyGuide.guide_data.sections[0],
        title: 'Quiz-only checkpoint',
        key_terms: [],
        common_traps: [],
        mini_quiz: [{ prompt: 'What started the chain reaction?', answer: 'Alliance escalation' }],
      },
      quizOnlyGuide.guide_data.sections[1],
    ];
    api.getStudyGuide.mockResolvedValue(quizOnlyGuide);

    render(
      <MemoryRouter initialEntries={['/guide/guide-7']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    const entryScreen = await screen.findByTestId('session-entry');
    fireEvent.click(within(entryScreen).getByRole('button', { name: /other options/i }));
    fireEvent.click(within(entryScreen).getByRole('button', { name: /full session/i }));

    const studyingScreen = await screen.findByTestId('session-studying');
    expect(screen.getByTestId('mobile-focus-shell')).toBeInTheDocument();
    expect(within(studyingScreen).getByTestId('study-section')).toBeInTheDocument();
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

    const rebuiltEntry = await screen.findByTestId('session-entry');
    expect(within(rebuiltEntry).getByRole('heading', { name: 'World War I Recall Workbook' })).toBeInTheDocument();
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

  it('shows the first-run hint card when localStorage key is absent', async () => {
    // The mock renders with no localStorage key set by default
    const { getByText } = renderGuide();
    await screen.findByTestId('session-entry');
    expect(getByText('How this works')).toBeInTheDocument();
  });

  it('dismisses the hint card when the dismiss button is clicked', async () => {
    const { getByLabelText, queryByText } = renderGuide();
    await screen.findByTestId('session-entry');
    fireEvent.click(getByLabelText('Dismiss hint'));
    await waitFor(() => {
      expect(queryByText('How this works')).not.toBeInTheDocument();
    });
    expect(localStorage.getItem('riven_guide_onboarded')).toBe('true');
  });

  it('shows the recommended-cta button on the entry screen', async () => {
    const { getByTestId } = renderGuide();
    await screen.findByTestId('session-entry');
    expect(getByTestId('recommended-cta')).toBeInTheDocument();
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
