import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import NoteEditor from './NoteEditor.jsx';

const { subscriptionHandlers, toast, recorderMock } = vi.hoisted(() => ({
  subscriptionHandlers: new Map(),
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    show: vi.fn(),
  },
  recorderMock: {
    state: 'idle',
    globalState: 'idle',
    duration: 0,
    audioPath: null,
    hasRecoveryData: false,
    activeNoteId: 'note-42',
    activeNoteTitle: 'Cell Respiration Notes',
    isAnotherNoteRecording: false,
    reset: vi.fn(),
    setProcessingState: vi.fn(),
    setAudioPath: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    getBlob: vi.fn(() => null),
    discardRecovery: vi.fn(),
    recover: vi.fn(),
    goToActiveNote: vi.fn(),
  },
}));

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
    getAiJob: vi.fn(),
    updateNote: vi.fn(),
    createNote: vi.fn(),
    getFriends: vi.fn(),
    sendMessage: vi.fn(),
    listAiJobs: vi.fn(),
    subscribeToAiJob: vi.fn(() => () => {}),
    uploadNoteAudio: vi.fn(),
    deleteNoteAudio: vi.fn(),
    createAiJob: vi.fn(),
    generateAiDeckStream: vi.fn(),
    generateAiGuideStream: vi.fn(),
    generateAiExamStream: vi.fn(),
    deleteNote: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => toast,
}));

vi.mock('../hooks/useRecordingSession.js', () => ({
  default: () => recorderMock,
}));

vi.mock('../components/editor/TiptapEditor', () => ({
  default: ({ placeholder, onUpdate, content, editable = true }) => {
    const extractMockText = (node) => {
      if (!node || typeof node !== 'object') return '';
      const segments = [];

      const walk = (currentNode) => {
        if (!currentNode || typeof currentNode !== 'object') return;
        if (typeof currentNode.text === 'string') {
          segments.push(currentNode.text);
        }
        if (Array.isArray(currentNode.content)) {
          currentNode.content.forEach(walk);
        }
      };

      walk(node);
      return segments.join(' ').trim();
    };

    return (
      <div>
        <div data-testid={editable ? 'note-editor' : 'note-editor-readonly'}>{placeholder}</div>
        <div data-testid={editable ? 'note-editor-content' : 'note-editor-content-readonly'}>
          {extractMockText(content)}
        </div>
        {onUpdate ? (
          <button
            type="button"
            onClick={() => onUpdate({
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
        ) : null}
      </div>
    );
  },
}));

vi.mock('../components/ConfirmModal', () => ({
  default: ({
    isOpen,
    title,
    message,
    confirmText = 'Delete',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
  }) => (isOpen ? (
    <div data-testid="confirm-modal">
      <h2>{title}</h2>
      <p>{message}</p>
      <button type="button" onClick={onCancel}>{cancelText}</button>
      <button type="button" onClick={onConfirm}>{confirmText}</button>
    </div>
  ) : null),
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

const renderNoteEditor = () =>
  render(
    <MemoryRouter initialEntries={['/note/note-42']}>
      <Routes>
        <Route path="/note/:id" element={<NoteEditor />} />
      </Routes>
    </MemoryRouter>
  );

const flushAsync = async (cycles = 4) => {
  await act(async () => {
    for (let index = 0; index < cycles; index += 1) {
      await Promise.resolve();
    }
  });
};

const clickBannerDismissButton = (actionButtonName) => {
  const actionButton = screen.getByRole('button', { name: actionButtonName });
  const actionGroup = actionButton.parentElement;
  const buttons = within(actionGroup).getAllByRole('button');
  fireEvent.click(buttons[buttons.length - 1]);
};

const buildEnhancementJob = (overrides = {}) => ({
  id: 'job-1',
  status: 'saving',
  phase: 'saving',
  progress_percent: 90,
  progress_message: 'Saving enhanced notes',
  result_payload: {},
  error_payload: {},
  ...overrides,
});

const makeDoc = (text) => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text },
      ],
    },
  ],
});

describe('NoteEditor', () => {
  beforeEach(() => {
    subscriptionHandlers.clear();
    vi.clearAllMocks();
    toast.error.mockReset();
    toast.success.mockReset();
    toast.show.mockReset();
    recorderMock.reset.mockReset();
    recorderMock.setProcessingState.mockReset();
    recorderMock.setAudioPath.mockReset();
    recorderMock.start.mockReset();
    recorderMock.stop.mockReset();
    recorderMock.getBlob.mockReset();
    recorderMock.getBlob.mockReturnValue(null);
    recorderMock.discardRecovery.mockReset();
    recorderMock.recover.mockReset();
    recorderMock.goToActiveNote.mockReset();
    recorderMock.isAnotherNoteRecording = false;
    recorderMock.activeNoteId = 'note-42';
    recorderMock.activeNoteTitle = 'Cell Respiration Notes';
    recorderMock.state = 'idle';
    recorderMock.globalState = 'idle';
    recorderMock.duration = 0;
    recorderMock.audioPath = null;
    recorderMock.hasRecoveryData = false;
    api.getClasses.mockResolvedValue([]);
    api.getNote.mockResolvedValue(note);
    api.getAiJob.mockResolvedValue(null);
    api.listAiJobs.mockResolvedValue([]);
    api.deleteNoteAudio.mockResolvedValue({ path: '7/note-42.webm' });
    api.subscribeToAiJob.mockImplementation((jobId, handlers) => {
      subscriptionHandlers.set(jobId, handlers);
      return vi.fn();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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

    const { container } = renderNoteEditor();

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

  it('creates a note before starting a recording from a new draft', async () => {
    api.createNote.mockResolvedValue({
      id: 'note-new',
      title: 'Untitled',
      class_id: null,
      content: {},
    });

    render(
      <MemoryRouter initialEntries={['/note/new']}>
        <Routes>
          <Route path="/note/:id" element={<NoteEditor />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByPlaceholderText('Untitled')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /record lecture/i }));

    await waitFor(() => {
      expect(api.createNote).toHaveBeenCalledWith('Untitled', {}, null);
      expect(recorderMock.start).toHaveBeenCalledWith('note-new', 'Untitled');
    });
  });

  it('shows a banner when another note is recording and routes back on demand', async () => {
    recorderMock.isAnotherNoteRecording = true;
    recorderMock.activeNoteId = 'note-77';
    recorderMock.activeNoteTitle = 'World History Lecture';

    renderNoteEditor();

    expect(await screen.findByText(/world history lecture is still recording/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to recording/i }));

    expect(recorderMock.goToActiveNote).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /recording in world history lecture/i })).toBeDisabled();
  });

  it('keeps the captured audio when discard is cancelled from the enhance banner', async () => {
    recorderMock.state = 'stopped';
    recorderMock.duration = 15;
    recorderMock.getBlob.mockReturnValue(new Blob(['audio'], { type: 'audio/webm' }));

    renderNoteEditor();

    expect(await screen.findByText(/lecture captured - enhance your notes with ai/i)).toBeInTheDocument();

    clickBannerDismissButton(/enhance/i);

    expect(screen.getByText('Discard this recording?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /keep audio/i }));

    expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
    expect(screen.getByText(/lecture captured - enhance your notes with ai/i)).toBeInTheDocument();
    expect(api.deleteNoteAudio).not.toHaveBeenCalled();
    expect(recorderMock.reset).not.toHaveBeenCalled();
  });

  it('discards a local-only recording from the enhance banner', async () => {
    recorderMock.state = 'stopped';
    recorderMock.duration = 15;
    recorderMock.getBlob.mockReturnValue(new Blob(['audio'], { type: 'audio/webm' }));

    renderNoteEditor();

    expect(await screen.findByText(/lecture captured - enhance your notes with ai/i)).toBeInTheDocument();

    clickBannerDismissButton(/enhance/i);
    fireEvent.click(screen.getByRole('button', { name: /discard audio/i }));

    await waitFor(() => {
      expect(recorderMock.reset).toHaveBeenCalledTimes(1);
      expect(recorderMock.setAudioPath).toHaveBeenCalledWith(null);
    });

    expect(api.deleteNoteAudio).not.toHaveBeenCalled();
    expect(screen.queryByText(/lecture captured - enhance your notes with ai/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
  });

  it('deletes uploaded note audio when discarding from the enhancement error banner', async () => {
    recorderMock.state = 'stopped';
    recorderMock.duration = 15;
    recorderMock.getBlob.mockReturnValue(new Blob(['audio'], { type: 'audio/webm' }));
    api.uploadNoteAudio.mockResolvedValue({ path: '7/note-42.webm' });
    api.createAiJob.mockRejectedValue(new Error('Enhancement failed upstream'));

    renderNoteEditor();

    expect(await screen.findByText(/lecture captured - enhance your notes with ai/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /enhance/i }));

    expect(await screen.findByText('Enhancement failed upstream')).toBeInTheDocument();

    clickBannerDismissButton(/retry/i);
    fireEvent.click(screen.getByRole('button', { name: /discard audio/i }));

    await waitFor(() => {
      expect(api.deleteNoteAudio).toHaveBeenCalledWith('7/note-42.webm');
      expect(recorderMock.reset).toHaveBeenCalledTimes(1);
      expect(recorderMock.setAudioPath).toHaveBeenCalledWith(null);
    });

    expect(screen.queryByText('Enhancement failed upstream')).not.toBeInTheDocument();
    expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
  });

  it('reconciles a saving enhancement job to completion when realtime misses the final update', async () => {
    vi.useFakeTimers();

    const previewDoc = makeDoc('Preview enhancement section');
    const finalDoc = makeDoc('Enhanced notes from polling reconciliation.');

    api.listAiJobs.mockResolvedValue([
      buildEnhancementJob({
        result_payload: {
          preview_doc: previewDoc,
          note_id: 'note-42',
        },
      }),
    ]);
    api.getAiJob
      .mockResolvedValueOnce(buildEnhancementJob({
        result_payload: {
          preview_doc: previewDoc,
          note_id: 'note-42',
        },
      }))
      .mockResolvedValueOnce(buildEnhancementJob({
        result_payload: {
          preview_doc: previewDoc,
          note_id: 'note-42',
        },
      }));
    api.getNote
      .mockResolvedValueOnce(note)
      .mockResolvedValueOnce({
        ...note,
        content: finalDoc,
        enhanced_content: finalDoc,
      });

    renderNoteEditor();
    await flushAsync(6);

    expect(screen.getByDisplayValue('Cell Respiration Notes')).toBeInTheDocument();
    expect(screen.getByText('Importing into note')).toBeInTheDocument();
    expect(screen.queryByText('AI Enhancement Preview')).not.toBeInTheDocument();
    expect(screen.getByTestId('note-editor-content-readonly')).toHaveTextContent('Preview enhancement section');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await flushAsync(4);

    expect(screen.getByTestId('note-editor-content')).toHaveTextContent('Enhanced notes from polling reconciliation.');
    expect(toast.success).toHaveBeenCalledWith('Notes enhanced with AI');
    expect(recorderMock.setProcessingState).toHaveBeenCalledWith('complete');
    expect(api.getAiJob).toHaveBeenCalledTimes(2);
    expect(api.getNote).toHaveBeenCalledTimes(2);
  });

  it('resolves a saving enhancement job immediately when note_persisted arrives', async () => {
    vi.useFakeTimers();

    const finalDoc = makeDoc('Enhanced notes resolved from the persisted checkpoint.');

    api.getNote
      .mockResolvedValueOnce(note)
      .mockResolvedValueOnce({
        ...note,
        content: finalDoc,
        enhanced_content: finalDoc,
      });
    api.listAiJobs.mockResolvedValue([
      buildEnhancementJob({
        result_payload: {
          final_doc: finalDoc,
          note_id: 'note-42',
        },
      }),
    ]);
    api.getAiJob.mockResolvedValueOnce(buildEnhancementJob({
      result_payload: {
        final_doc: finalDoc,
        note_id: 'note-42',
      },
    }));

    renderNoteEditor();
    await flushAsync(6);

    expect(screen.getByText('Importing into note')).toBeInTheDocument();

    await act(async () => {
      subscriptionHandlers.get('job-1')?.onUpdate?.(buildEnhancementJob({
        result_payload: {
          final_doc: finalDoc,
          note_id: 'note-42',
          note_persisted: true,
          persisted_at: '2026-04-08T21:09:00.000Z',
        },
      }));
      await Promise.resolve();
    });
    await flushAsync(6);

    expect(screen.getByTestId('note-editor-content')).toHaveTextContent('Enhanced notes resolved from the persisted checkpoint.');
    expect(toast.success).toHaveBeenCalledWith('Notes enhanced with AI');
    expect(recorderMock.setProcessingState).toHaveBeenCalledWith('complete');
    expect(api.getNote).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    await flushAsync(2);
  });

  it('locally resolves a saving enhancement job after the grace window even when note readback stays stale at first', async () => {
    vi.useFakeTimers();

    const finalDoc = makeDoc('Enhanced notes resolved after the saving grace window.');
    const staleNote = {
      ...note,
      content: note.content,
      enhanced_content: null,
    };

    api.listAiJobs.mockResolvedValue([
      buildEnhancementJob({
        result_payload: {
          final_doc: finalDoc,
          note_id: 'note-42',
        },
      }),
    ]);
    api.getAiJob
      .mockResolvedValueOnce(buildEnhancementJob({
        result_payload: {
          final_doc: finalDoc,
          note_id: 'note-42',
        },
      }))
      .mockResolvedValueOnce(buildEnhancementJob({
        result_payload: {
          final_doc: finalDoc,
          note_id: 'note-42',
        },
      }))
      .mockResolvedValueOnce(buildEnhancementJob({
        result_payload: {
          final_doc: finalDoc,
          note_id: 'note-42',
        },
      }));
    api.getNote
      .mockResolvedValueOnce(note)
      .mockResolvedValueOnce(staleNote)
      .mockResolvedValueOnce(staleNote)
      .mockResolvedValueOnce({
        ...note,
        content: finalDoc,
        enhanced_content: finalDoc,
      });

    renderNoteEditor();
    await flushAsync(6);

    expect(screen.getByText('Importing into note')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await flushAsync(4);

    expect(screen.getByText('Importing into note')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await flushAsync(6);

    expect(screen.getByTestId('note-editor-content')).toHaveTextContent('Enhanced notes resolved after the saving grace window.');
    expect(toast.success).toHaveBeenCalledWith('Notes enhanced with AI');
    expect(api.getAiJob).toHaveBeenCalledTimes(3);
    expect(api.getNote).toHaveBeenCalledTimes(4);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    await flushAsync(2);

  });

  it('refreshes the persisted note once when a completed job is missing final_doc', async () => {
    const refreshedDoc = makeDoc('Enhanced notes loaded from the saved note row.');

    api.getNote
      .mockResolvedValueOnce(note)
      .mockResolvedValueOnce({
        ...note,
        content: refreshedDoc,
        enhanced_content: refreshedDoc,
      });
    api.listAiJobs.mockResolvedValue([
      buildEnhancementJob(),
    ]);
    api.getAiJob.mockResolvedValueOnce(buildEnhancementJob({
      status: 'completed',
      phase: 'done',
      progress_percent: 100,
      progress_message: 'Notes enhanced successfully',
      result_payload: {
        note_id: 'note-42',
      },
    }));

    renderNoteEditor();
    await flushAsync(6);

    await waitFor(() => {
      expect(api.getNote).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByTestId('note-editor-content')).toHaveTextContent('Enhanced notes loaded from the saved note row.');
    });
    expect(screen.queryByText('Importing into note')).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Notes enhanced with AI');
  });

  it('shows active enhancement content in the main editor without rendering a separate preview card', async () => {
    const previewDoc = makeDoc('Streaming note import content');

    api.listAiJobs.mockResolvedValue([
      buildEnhancementJob({
        status: 'running',
        phase: 'drafting',
        progress_percent: 62,
        progress_message: 'Drafting enhanced notes',
        result_payload: {
          preview_doc: previewDoc,
          note_id: 'note-42',
        },
      }),
    ]);
    api.getAiJob.mockResolvedValueOnce(buildEnhancementJob({
      status: 'running',
      phase: 'drafting',
      progress_percent: 62,
      progress_message: 'Drafting enhanced notes',
      result_payload: {
        preview_doc: previewDoc,
        note_id: 'note-42',
      },
    }));

    renderNoteEditor();
    await flushAsync(6);

    expect(screen.getByText('Importing into note')).toBeInTheDocument();
    expect(screen.queryByText('AI Enhancement Preview')).not.toBeInTheDocument();
    expect(screen.getByTestId('note-editor-content-readonly')).toHaveTextContent('Streaming note import content');
  });

  it('restores the original note content when an active enhancement job fails', async () => {
    const previewDoc = makeDoc('Streaming note import content');

    api.listAiJobs.mockResolvedValue([
      buildEnhancementJob({
        status: 'running',
        phase: 'drafting',
        progress_percent: 62,
        progress_message: 'Drafting enhanced notes',
        result_payload: {
          preview_doc: previewDoc,
          note_id: 'note-42',
        },
      }),
    ]);
    api.getAiJob.mockResolvedValueOnce(buildEnhancementJob({
      status: 'running',
      phase: 'drafting',
      progress_percent: 62,
      progress_message: 'Drafting enhanced notes',
      result_payload: {
        preview_doc: previewDoc,
        note_id: 'note-42',
      },
    }));

    renderNoteEditor();
    await flushAsync(6);

    expect(screen.getByTestId('note-editor-content-readonly')).toHaveTextContent('Streaming note import content');

    await act(async () => {
      subscriptionHandlers.get('job-1')?.onError?.(buildEnhancementJob({
        status: 'failed',
        phase: 'error',
        progress_percent: 62,
        progress_message: 'Enhancement failed',
        result_payload: {
          note_id: 'note-42',
        },
        error_payload: {
          message: 'Enhancement failed',
        },
      }));
      await Promise.resolve();
    });
    await flushAsync(4);

    await waitFor(() => {
      expect(screen.getByTestId('note-editor-content')).toHaveTextContent('Mitochondria power ATP production.');
      expect(screen.getByText('Enhancement failed')).toBeInTheDocument();
    });
  });

  it('ignores stale saving updates after a job was locally resolved', async () => {
    vi.useFakeTimers();

    const finalDoc = makeDoc('Enhanced notes that should stay visible.');

    api.getNote
      .mockResolvedValueOnce(note)
      .mockResolvedValueOnce({
        ...note,
        content: finalDoc,
        enhanced_content: finalDoc,
      });
    api.listAiJobs.mockResolvedValue([
      buildEnhancementJob({
        result_payload: {
          final_doc: finalDoc,
          note_id: 'note-42',
        },
      }),
    ]);
    api.getAiJob.mockResolvedValueOnce(buildEnhancementJob({
      result_payload: {
        final_doc: finalDoc,
        note_id: 'note-42',
      },
    }));

    renderNoteEditor();
    await flushAsync(6);

    await act(async () => {
      subscriptionHandlers.get('job-1')?.onUpdate?.(buildEnhancementJob({
        result_payload: {
          final_doc: finalDoc,
          note_id: 'note-42',
          note_persisted: true,
          persisted_at: '2026-04-08T21:09:00.000Z',
        },
      }));
      await Promise.resolve();
    });
    await flushAsync(6);

    expect(screen.getByTestId('note-editor-content')).toHaveTextContent('Enhanced notes that should stay visible.');

    await act(async () => {
      subscriptionHandlers.get('job-1')?.onUpdate?.(buildEnhancementJob({
        progress_message: 'Saving enhanced notes',
        result_payload: {
          final_doc: finalDoc,
          note_id: 'note-42',
        },
      }));
      await Promise.resolve();
    });
    await flushAsync(4);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    await flushAsync(2);

    expect(screen.getByTestId('note-editor-content')).toHaveTextContent('Enhanced notes that should stay visible.');
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('stops enhancement polling when the editor unmounts', async () => {
    vi.useFakeTimers();

    const unsubscribe = vi.fn();
    api.subscribeToAiJob.mockImplementation((jobId, handlers) => {
      subscriptionHandlers.set(jobId, handlers);
      return unsubscribe;
    });
    api.listAiJobs.mockResolvedValue([
      buildEnhancementJob({
        status: 'running',
        phase: 'drafting',
        progress_percent: 62,
        progress_message: 'Drafting enhanced notes',
      }),
    ]);
    api.getAiJob.mockResolvedValueOnce(buildEnhancementJob({
      status: 'running',
      phase: 'drafting',
      progress_percent: 62,
      progress_message: 'Drafting enhanced notes',
    }));

    const view = renderNoteEditor();
    await flushAsync(6);

    expect(api.getAiJob).toHaveBeenCalledTimes(1);

    view.unmount();

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(api.getAiJob).toHaveBeenCalledTimes(1);
  });
});
