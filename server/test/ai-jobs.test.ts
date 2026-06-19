import { describe, expect, it } from 'vitest';

import {
  createJobReporter,
  normalizeAiJobError,
} from '../../supabase/functions/_shared/aiJobs.ts';

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
