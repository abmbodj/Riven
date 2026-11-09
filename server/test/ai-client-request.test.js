import { describe, expect, it } from 'vitest';

import { buildOpenAiGenerateContentParams } from '../../supabase/functions/_shared/aiClientRequest.ts';

describe('aiClient request shaping', () => {
  it('adds json_object response format for object-only callers', () => {
    const params = buildOpenAiGenerateContentParams({
      model: 'gpt-5.4-mini',
      messages: [{ role: 'user', content: 'Return a JSON object.' }],
      maxTokens: 512,
      responseFormat: 'json_object',
    });

    expect(params).toMatchObject({
      model: 'gpt-5.4-mini',
      max_completion_tokens: 512,
      response_format: { type: 'json_object' },
    });
  });

  it('omits response format for array-returning callers', () => {
    const params = buildOpenAiGenerateContentParams({
      model: 'gpt-5.4-mini',
      messages: [{ role: 'user', content: 'Return a JSON array.' }],
    });

    expect(params).not.toHaveProperty('response_format');
  });
});
