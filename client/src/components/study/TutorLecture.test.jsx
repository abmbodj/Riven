import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TutorLecture from './TutorLecture.jsx';

const currentCard = {
  id: 'card-1',
  prompt: 'How does a request move through a web app?',
  teaching: {
    learning_objective: 'Trace a request through the system.',
    explain: 'The browser sends intent to an API.',
    intuition: 'Think of the request like a parcel moving through checkpoints.',
    worked_examples: [],
    common_mistakes: [],
    steps: [],
    why_it_matters: '',
    example: '',
  },
};

const makeProps = (overrides = {}) => ({
  content: {
    roleLabel: 'friendly lecture cat',
    currentCard,
    currentConcept: { title: 'Request flow' },
  },
  progress: {
    sections: [
      { key: 'explain', label: 'Explanation', type: 'explain' },
      {
        key: 'example-0',
        label: 'Example 1: Update a profile',
        type: 'worked_example',
        data: {
          title: 'Example 1: Update a profile',
          problem: 'A learner changes their display name.',
          steps: [
            { step: 'Send the form to the API.', detail: 'The browser serializes the new name.' },
            { step: 'Validate and store the change.', detail: 'The API checks permission before writing.' },
          ],
          result: 'The saved profile is returned.',
          takeaway: 'Every boundary has one responsibility.',
        },
      },
    ],
    activeSectionIndex: 0,
    visibleBeats: [{ id: 'beat-1', kind: 'text', text: 'The browser sends intent to an API.' }],
    explainRevealed: 1,
    explainTotal: 1,
    onExplainSection: true,
    showFuzzyPrompt: false,
    fuzzyPeek: false,
    expandedSteps: {},
  },
  river: { state: 'teach', caption: 'Follow the request one boundary at a time.' },
  chat: {
    assistOptions: [{ id: 'simple', label: 'Explain simply' }],
    history: [],
    input: '',
    loading: false,
    turnCount: 0,
    softCap: 8,
  },
  actions: {
    onContinue: vi.fn(),
    onSkip: vi.fn(),
    onSave: vi.fn(),
    onRevealNext: vi.fn(),
    onGotIt: vi.fn(),
    onFuzzy: vi.fn(),
    onToggleStep: vi.fn(),
    onToggleAllSteps: vi.fn(),
    onSelectAssist: vi.fn(),
    onChatInput: vi.fn(),
    onSendChat: vi.fn(),
  },
  ...overrides,
});

describe('TutorLecture', () => {
  it('keeps the explanation mounted when a worked example is appended inline', () => {
    const firstProps = makeProps();
    const view = render(<TutorLecture {...firstProps} />);
    const documentRoot = screen.getByTestId('river-lecture-document');

    view.rerender(
      <TutorLecture
        {...makeProps({
          progress: { ...firstProps.progress, activeSectionIndex: 1 },
        })}
      />
    );

    expect(screen.getByTestId('river-lecture-document')).toBe(documentRoot);
    expect(within(documentRoot).getByText(/browser sends intent/i)).toBeInTheDocument();
    expect(within(documentRoot).getByTestId('inline-worked-example')).toBeInTheDocument();
    expect(within(documentRoot).getByText(/learner changes their display name/i)).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-teacher-strip')).not.toBeInTheDocument();
  });

  it('keeps Ask River and lesson actions in one dock', () => {
    const props = makeProps();
    render(<TutorLecture {...props} />);

    const dock = screen.getByTestId('tutor-lecture-dock');
    fireEvent.click(within(dock).getByRole('button', { name: /Explain simply/i }));
    fireEvent.click(within(dock).getByRole('button', { name: /Skip to question/i }));

    expect(props.actions.onSelectAssist).toHaveBeenCalledWith(props.chat.assistOptions[0]);
    expect(props.actions.onSkip).toHaveBeenCalledTimes(1);
    expect(within(dock).getByLabelText(/Ask River/i)).toBeInTheDocument();
    expect(within(dock).getByRole('button', { name: /Save and leave/i })).toBeInTheDocument();
  });

  it('shows a recoverable unavailable state instead of a legacy teaching layout', () => {
    const props = makeProps({
      content: {
        roleLabel: 'friendly lecture cat',
        currentCard: { ...currentCard, teaching: null },
        currentConcept: { title: 'Request flow' },
      },
    });
    render(<TutorLecture {...props} />);

    expect(screen.getByTestId('tutor-teaching-unavailable')).toHaveTextContent(/missing its teaching content/i);
    fireEvent.click(screen.getByRole('button', { name: /Save and leave/i }));
    expect(props.actions.onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('river-board-frame')).not.toBeInTheDocument();
  });
});
