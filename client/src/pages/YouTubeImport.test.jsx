import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import YouTubeImport from './YouTubeImport.jsx';

const subscriptionHandlers = new Map();

vi.mock('../api', () => ({
  api: {
    getClasses: vi.fn(),
    getAILimits: vi.fn(),
    warmupAiFunctions: vi.fn(),
    primeEdgeFunctionAuth: vi.fn(),
    createAiJob: vi.fn(),
    getAiJob: vi.fn(),
    subscribeToAiJob: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    show: vi.fn(),
  }),
}));

vi.mock('../components/ui/PricingModal', () => ({
  default: () => null,
}));

const { api } = await import('../api');

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/youtube']}>
      <Routes>
        <Route path="/youtube" element={<YouTubeImport />} />
        <Route path="/note/:noteId" element={<div>Opened note</div>} />
      </Routes>
    </MemoryRouter>,
  );

const emitJob = async (jobId, job) => {
  const handlers = subscriptionHandlers.get(jobId);
  if (!handlers) {
    throw new Error(`No subscription registered for ${jobId}`);
  }

  await act(async () => {
    handlers.onUpdate?.(job);
  });
};

describe('YouTubeImport', () => {
  beforeEach(() => {
    subscriptionHandlers.clear();
    vi.clearAllMocks();

    api.getClasses.mockResolvedValue([]);
    api.getAILimits.mockResolvedValue({ remaining: 3, max: 10 });
    api.warmupAiFunctions.mockReturnValue(undefined);
    api.primeEdgeFunctionAuth.mockResolvedValue(null);
    api.subscribeToAiJob.mockImplementation((jobId, handlers) => {
      subscriptionHandlers.set(jobId, handlers);
      return vi.fn();
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ title: 'Demo video' }),
    });
  });

  it('creates one direct notes job for notes-only imports and opens the completed note', async () => {
    api.createAiJob.mockResolvedValueOnce({
      jobId: 'notes-1',
      status: 'queued',
      phase: 'accepted',
      sourceKey: 'youtube:demo123',
    });

    api.getAiJob.mockResolvedValueOnce({
      id: 'notes-1',
      status: 'queued',
      phase: 'accepted',
      progress_percent: 0,
      progress_message: 'Queued',
      result_payload: {},
    });

    renderPage();

    fireEvent.change(screen.getByLabelText(/youtube url/i), {
      target: { value: 'https://www.youtube.com/watch?v=demo123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /notes/i }));
    fireEvent.click(screen.getByRole('button', { name: /generate 1 item/i }));

    await waitFor(() => {
      expect(api.createAiJob).toHaveBeenCalledTimes(1);
    });

    expect(api.createAiJob).toHaveBeenCalledWith('youtube_notes', expect.objectContaining({
      youtubeUrl: 'https://www.youtube.com/watch?v=demo123',
      titleSnapshot: expect.any(String),
    }));
    expect(api.subscribeToAiJob).toHaveBeenCalledTimes(1);

    await emitJob('notes-1', {
      id: 'notes-1',
      status: 'completed',
      phase: 'done',
      progress_percent: 100,
      progress_message: 'Notes generated successfully',
      result_payload: {
        note_id: 'note-42',
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Opened note')).toBeInTheDocument();
    });
  });

  it('shows a failed final state when the source transcript job fails and propagates the source error to pending derived jobs', async () => {
    api.createAiJob
      .mockResolvedValueOnce({
        jobId: 'source-1',
        status: 'queued',
        phase: 'accepted',
        sourceKey: 'youtube:demo123',
      })
      .mockResolvedValueOnce({
        jobId: 'notes-1',
        status: 'queued',
        phase: 'accepted',
      })
      .mockResolvedValueOnce({
        jobId: 'deck-1',
        status: 'queued',
        phase: 'accepted',
      });

    api.getAiJob.mockImplementation(async (jobId) => {
      if (jobId === 'source-1') {
        return {
          id: 'source-1',
          status: 'queued',
          phase: 'accepted',
          progress_message: 'Accepted video analysis job',
          result_payload: {},
        };
      }

      return {
        id: jobId,
        status: 'queued',
        phase: 'accepted',
        progress_percent: 0,
        progress_message: 'Queued',
        result_payload: {},
      };
    });

    renderPage();

    fireEvent.change(screen.getByLabelText(/youtube url/i), {
      target: { value: 'https://www.youtube.com/watch?v=demo123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /notes/i }));
    fireEvent.click(screen.getByRole('button', { name: /flashcards/i }));
    fireEvent.click(screen.getByRole('button', { name: /generate 2 items/i }));

    await waitFor(() => {
      expect(api.subscribeToAiJob).toHaveBeenCalledTimes(3);
    });

    await emitJob('source-1', {
      id: 'source-1',
      status: 'failed',
      phase: 'error',
      progress_message: 'Failed to fetch YouTube transcript. The video may not have captions available.',
      error_payload: {
        message: 'Failed to fetch YouTube transcript. The video may not have captions available.',
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Generation Failed')).toBeInTheDocument();
    });

    expect(screen.queryByText('Generation Complete')).not.toBeInTheDocument();
    expect(screen.getAllByText(/failed to fetch youtube transcript/i).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps successful outputs visible when other derived jobs fail', async () => {
    api.createAiJob
      .mockResolvedValueOnce({
        jobId: 'source-1',
        status: 'queued',
        phase: 'accepted',
        sourceKey: 'youtube:demo123',
      })
      .mockResolvedValueOnce({
        jobId: 'notes-1',
        status: 'queued',
        phase: 'accepted',
      })
      .mockResolvedValueOnce({
        jobId: 'deck-1',
        status: 'queued',
        phase: 'accepted',
      });

    api.getAiJob.mockImplementation(async (jobId) => {
      if (jobId === 'source-1') {
        return {
          id: 'source-1',
          status: 'queued',
          phase: 'accepted',
          progress_message: 'Accepted video analysis job',
          result_payload: {},
        };
      }

      return {
        id: jobId,
        status: 'queued',
        phase: 'accepted',
        progress_percent: 0,
        progress_message: 'Queued',
        result_payload: {},
      };
    });

    renderPage();

    fireEvent.change(screen.getByLabelText(/youtube url/i), {
      target: { value: 'https://www.youtube.com/watch?v=demo123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /notes/i }));
    fireEvent.click(screen.getByRole('button', { name: /flashcards/i }));
    fireEvent.click(screen.getByRole('button', { name: /generate 2 items/i }));

    await waitFor(() => {
      expect(api.subscribeToAiJob).toHaveBeenCalledTimes(3);
    });

    await emitJob('source-1', {
      id: 'source-1',
      status: 'completed',
      phase: 'done',
      progress_percent: 100,
      progress_message: 'Video source material is ready',
      result_payload: {},
    });

    await emitJob('notes-1', {
      id: 'notes-1',
      status: 'completed',
      phase: 'done',
      progress_percent: 100,
      progress_message: 'Notes generated successfully',
      result_payload: {
        note_id: 'note-42',
      },
    });

    await emitJob('deck-1', {
      id: 'deck-1',
      status: 'failed',
      phase: 'error',
      progress_percent: 12,
      progress_message: 'Deck generation failed',
      error_payload: {
        message: 'Deck generation failed',
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Done!')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /notes/i })).toHaveAttribute('href', '/note/note-42');
    expect(screen.getByText('Deck generation failed')).toBeInTheDocument();
  });

  it('shows preserved database messages when a direct notes job fails', async () => {
    api.createAiJob.mockResolvedValueOnce({
      jobId: 'notes-1',
      status: 'queued',
      phase: 'accepted',
    });

    api.getAiJob.mockResolvedValueOnce({
      id: 'notes-1',
      status: 'queued',
      phase: 'accepted',
      progress_percent: 0,
      progress_message: 'Queued',
      result_payload: {},
    });

    renderPage();

    fireEvent.change(screen.getByLabelText(/youtube url/i), {
      target: { value: 'https://www.youtube.com/watch?v=demo123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /notes/i }));
    fireEvent.click(screen.getByRole('button', { name: /generate 1 item/i }));

    await waitFor(() => {
      expect(api.subscribeToAiJob).toHaveBeenCalledTimes(1);
    });

    await emitJob('notes-1', {
      id: 'notes-1',
      status: 'failed',
      phase: 'error',
      progress_percent: 90,
      progress_message: 'new row for relation "notes" violates check constraint "notes_source_type_check"',
      error_payload: {
        message: 'new row for relation "notes" violates check constraint "notes_source_type_check"',
        code: '23514',
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Generation Failed')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/notes_source_type_check/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/unknown ai job error/i)).not.toBeInTheDocument();
  });

  it('sanitizes provider token-limit failures on direct notes jobs', async () => {
    api.createAiJob.mockResolvedValueOnce({
      jobId: 'notes-1',
      status: 'queued',
      phase: 'accepted',
    });

    api.getAiJob.mockResolvedValueOnce({
      id: 'notes-1',
      status: 'queued',
      phase: 'accepted',
      progress_percent: 0,
      progress_message: 'Queued',
      result_payload: {},
    });

    renderPage();

    fireEvent.change(screen.getByLabelText(/youtube url/i), {
      target: { value: 'https://www.youtube.com/watch?v=demo123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /notes/i }));
    fireEvent.click(screen.getByRole('button', { name: /generate 1 item/i }));

    await waitFor(() => {
      expect(api.subscribeToAiJob).toHaveBeenCalledTimes(1);
    });

    await emitJob('notes-1', {
      id: 'notes-1',
      status: 'failed',
      phase: 'error',
      progress_percent: 42,
      progress_message: '413 {"error":{"message":"Request too large for model `openai/gpt-oss-120b` in organization `org_abc` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 11881, Please reduce your message size and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing","type":"tokens","code":"rate_limit_exceeded"}}',
      error_payload: {
        message: '413 {"error":{"message":"Request too large for model `openai/gpt-oss-120b` in organization `org_abc` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 11881, Please reduce your message size and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing","type":"tokens","code":"rate_limit_exceeded"}}',
        code: 'rate_limit_exceeded',
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Generation Failed')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/riven hit the ai provider/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/org_abc/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/console\.groq\.com/i)).not.toBeInTheDocument();
  });
});
