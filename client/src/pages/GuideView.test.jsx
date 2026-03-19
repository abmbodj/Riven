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
    generateAiDeckStream: vi.fn(),
    generateAiExamStream: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('../components/editor/TiptapEditor', () => ({
  default: ({ placeholder }) => (
    <div data-testid="guide-editor">{placeholder}</div>
  ),
}));

vi.mock('../components/ConfirmModal', () => ({
  default: () => null,
}));

vi.mock('../components/ui/PricingModal', () => ({
  default: () => null,
}));

const { api } = await import('../api');

const guide = {
  id: 'guide-7',
  title: 'World War I Guide',
  class_id: 'class-9',
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

describe('GuideView AI toolbar layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getStudyGuide.mockResolvedValue(guide);
  });

  it('renders AI actions inside the sticky header instead of a bottom-fixed footer', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/guide/guide-7']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('World War I Guide')).toBeInTheDocument();

    const stickyHeader = container.querySelector('div.sticky.top-0');
    expect(stickyHeader).toBeTruthy();

    expect(within(stickyHeader).getByRole('button', { name: /flashcards/i })).toBeInTheDocument();
    expect(within(stickyHeader).getByRole('button', { name: /mock exam/i })).toBeInTheDocument();
    expect(container.querySelector('div.fixed.bottom-24')).not.toBeInTheDocument();
  });

  it('keeps both AI actions visible and disables them while generation is active', async () => {
    api.generateAiDeckStream.mockResolvedValue({
      chunks: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => new Promise(() => {}),
        }),
      }),
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/guide/guide-7']}>
        <Routes>
          <Route path="/guide/:id" element={<GuideView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('World War I Guide')).toBeInTheDocument();

    const stickyHeader = container.querySelector('div.sticky.top-0');
    const flashcardsButton = within(stickyHeader).getByRole('button', { name: /flashcards/i });
    const mockExamButton = within(stickyHeader).getByRole('button', { name: /mock exam/i });

    fireEvent.click(flashcardsButton);

    await waitFor(() => {
      expect(flashcardsButton).toBeDisabled();
      expect(mockExamButton).toBeDisabled();
    });
  });
});
