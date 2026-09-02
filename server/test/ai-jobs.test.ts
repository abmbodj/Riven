import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'Deno', {
    configurable: true,
    value: { env: { get: () => undefined } },
  });
});

vi.mock('npm:groq-sdk@0.24.0', () => ({
  default: class Groq {},
}));
vi.mock('npm:@sentry/deno@10.45.0', () => ({
  captureException: vi.fn(),
  init: vi.fn(),
  withScope: vi.fn(),
}));

import {
  createJobReporter,
  getAiModelMap,
  normalizeAiJobError,
} from '../../supabase/functions/_shared/aiJobs.ts';
import * as aiJobProcessors from '../../supabase/functions/_shared/aiJobProcessors.ts';

type StreamChunk = { text: string };
type StreamWithFallback = (args: {
  ai: { streamContent: (args: { model: string }) => AsyncIterable<StreamChunk> };
  primaryModel: string;
  fallbackModel: string;
  messages: unknown[];
  maxTokens: number;
}) => AsyncIterable<StreamChunk>;

const getStreamWithFallback = () => (
  aiJobProcessors as unknown as { streamWithFallback?: StreamWithFallback }
).streamWithFallback;

const collectStream = async (stream: AsyncIterable<StreamChunk>) => {
  const chunks: StreamChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
};

const createAdminRecorder = () => {
  const updates: unknown[] = [];

  return {
    updates,
    admin: {
      from: (table: string) => ({
        update: (payload: unknown) => {
          updates.push({ table, payload });
          return {
            eq: async () => ({ error: null }),
          };
        },
      }),
    },
  };
};

describe('ai job error reporting', () => {
  it('uses active Groq models when no model overrides are configured', () => {
    vi.stubGlobal('Deno', { env: { get: vi.fn(() => undefined) } });

    expect(getAiModelMap()).toEqual({
      draft: 'openai/gpt-oss-20b',
      final: 'openai/gpt-oss-120b',
      grading: 'openai/gpt-oss-120b',
    });

    vi.unstubAllGlobals();
  });

  it('honors configured model overrides', () => {
    const models = new Map([
      ['AI_DRAFT_MODEL', 'custom-draft'],
      ['AI_FINAL_MODEL', 'custom-final'],
      ['AI_GRADING_MODEL', 'custom-grading'],
    ]);
    vi.stubGlobal('Deno', { env: { get: vi.fn((key: string) => models.get(key)) } });

    expect(getAiModelMap()).toEqual({
      draft: 'custom-draft',
      final: 'custom-final',
      grading: 'custom-grading',
    });

    vi.unstubAllGlobals();
  });

  it('retries a retired draft model when it fails before the first streamed chunk', async () => {
    const streamWithFallback = getStreamWithFallback();
    expect(streamWithFallback).toBeTypeOf('function');
    if (!streamWithFallback) return;

    const primaryStream = async function* (): AsyncGenerator<StreamChunk> {
      throw new Error('The model has been decommissioned');
    };
    const fallbackStream = async function* (): AsyncGenerator<StreamChunk> {
      yield { text: '{"type":"doc"}' };
    };
    const ai = {
      streamContent: vi.fn(({ model }: { model: string }) => (
        model === 'retired-draft' ? primaryStream() : fallbackStream()
      )),
    };

    await expect(collectStream(streamWithFallback({
      ai,
      primaryModel: 'retired-draft',
      fallbackModel: 'active-final',
      messages: [],
      maxTokens: 64,
    }))).resolves.toEqual([{ text: '{"type":"doc"}' }]);
    expect(ai.streamContent).toHaveBeenCalledWith(expect.objectContaining({ model: 'retired-draft' }));
    expect(ai.streamContent).toHaveBeenCalledWith(expect.objectContaining({ model: 'active-final' }));
  });

  it('does not merge a fallback stream after the draft has emitted content', async () => {
    const streamWithFallback = getStreamWithFallback();
    expect(streamWithFallback).toBeTypeOf('function');
    if (!streamWithFallback) return;

    const partialStream = async function* (): AsyncGenerator<StreamChunk> {
      yield { text: '{"type"' };
      throw new Error('model unavailable');
    };
    const ai = { streamContent: vi.fn(() => partialStream()) };

    await expect(collectStream(streamWithFallback({
      ai,
      primaryModel: 'retired-draft',
      fallbackModel: 'active-final',
      messages: [],
      maxTokens: 64,
    }))).rejects.toThrow('model unavailable');
    expect(ai.streamContent).toHaveBeenCalledTimes(1);
  });

  it('preserves Supabase-style plain object error fields', async () => {
    const { admin, updates } = createAdminRecorder();
    const reporter = createJobReporter(admin, {
      id: 'job-1',
      user_id: 7,
      kind: 'youtube_notes',
      status: 'saving',
      phase: 'saving',
      progress_percent: 90,
      progress_message: 'Saving imported notes',
      input_payload: {},
      result_payload: {},
      error_payload: {},
    });

    await reporter.fail({
      message: 'new row for relation "notes" violates check constraint "notes_source_type_check"',
      code: '23514',
      details: 'Failing row contains source_type youtube.',
      hint: 'Update the notes source_type constraint.',
      status: 400,
    });

    expect(reporter.getRow()).toMatchObject({
      status: 'failed',
      phase: 'error',
      progress_message: 'new row for relation "notes" violates check constraint "notes_source_type_check"',
      error_payload: {
        message: 'new row for relation "notes" violates check constraint "notes_source_type_check"',
        status: 400,
        code: '23514',
        details: 'Failing row contains source_type youtube.',
        hint: 'Update the notes source_type constraint.',
      },
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      table: 'ai_jobs',
      payload: {
        status: 'failed',
        error_payload: {
          code: '23514',
        },
      },
    });
  });

  it('keeps Error statusCode and diagnostic fields when available', () => {
    const error = new Error('Upstream model failed') as Error & {
      statusCode: number;
      code: string;
      details: string;
      provider_status: number;
      strategy_errors: string[];
    };
    error.statusCode = 502;
    error.code = 'MODEL_UPSTREAM';
    error.details = 'The model provider returned a temporary error.';
    error.provider_status = 429;
    error.strategy_errors = [
      'custom:No captions available',
      'transcriptapi:TranscriptAPI returned 429',
    ];

    expect(normalizeAiJobError(error)).toEqual({
      message: 'Upstream model failed',
      status: 502,
      code: 'MODEL_UPSTREAM',
      details: 'The model provider returned a temporary error.',
      provider_status: 429,
      strategy_errors: [
        'custom:No captions available',
        'transcriptapi:TranscriptAPI returned 429',
      ],
    });
  });
});
