import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NoteEditor from './NoteEditor.jsx';

const updatedNoteContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Updated note content for sharing.' },
      ],
    },
  ],
};

vi.mock('../api', () => ({
  api: {
    warmupAiFunctions: vi.fn(),
    primeEdgeFunctionAuth: vi.fn().mockResolvedValue(null),
    getClasses: vi.fn(),
    getNote: vi.fn(),
    updateNote: vi.fn(),
    createNote: vi.fn(),
    getFriends: vi.fn(),
    sendMessage: vi.fn(),
    listAiJobs: vi.fn(),
    subscribeToAiJob: vi.fn(() => () => {}),
    generateAiDeckStream: vi.fn(),
    generateAiGuideStream: vi.fn(),
    generateAiExamStream: vi.fn(),
    deleteNote: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('../hooks/useAudioRecorder', () => ({
  default: () => ({
    state: 'idle',
    duration: 0,
    hasRecoveryData: false,
    setProcessingState: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    getBlob: vi.fn(() => null),
  }),
}));

vi.mock('../components/editor/TiptapEditor', () => ({
  default: ({ placeholder, onUpdate }) => (
    <div>
      <div data-testid="note-editor">{placeholder}</div>
      <button
        type="button"
        onClick={() => onUpdate?.({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Updated note content for sharing.' },
              ],
            },
          ],
        })}
      >
        Update note content
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

const note = {
  id: 'note-42',
  title: 'Cell Respiration Notes',
  class_id: null,
  content: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Mitochondria power ATP production.' },
        ],
      },
    ],
  },
  enhanced_content: null,
  audio_url: null,
};

describe('NoteEditor sharing flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getClasses.mockResolvedValue([]);
    api.getNote.mockResolvedValue(note);
    api.listAiJobs.mockResolvedValue([]);
  });

  it('flushes pending autosave before sharing a note', async () => {
    api.getFriends.mockResolvedValue([
      { id: 12, username: 'Bianca', avatar: null },
    ]);
    api.updateNote.mockResolvedValue({
      ...note,
      title: 'Cell Respiration Notes Revised',
    });
    api.sendMessage.mockResolvedValue({ id: 100 });

    const { container } = render(
      <MemoryRouter initialEntries={['/note/note-42']}>
        <Routes>
          <Route path="/note/:id" element={<NoteEditor />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('Cell Respiration Notes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /update note content/i }));

    const stickyHeader = container.querySelector('div.sticky.top-0');
    fireEvent.click(within(stickyHeader).getByRole('button', { name: /share note/i }));

    expect(await screen.findByText('Share Note')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() => {
      expect(api.updateNote).toHaveBeenCalledWith('note-42', {
        title: 'Cell Respiration Notes',
        content: updatedNoteContent,
        class_id: null,
      });
      expect(api.sendMessage).toHaveBeenCalledWith(
        12,
        'Shared a note: Cell Respiration Notes',
        'note',
        expect.objectContaining({
          kind: 'note',
          sourceId: 'note-42',
          title: 'Cell Respiration Notes',
          previewText: 'Updated note content for sharing.',
        }),
      );
    });
  });
});
