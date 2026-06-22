/* @vitest-environment jsdom */
/**
 * Egress regression guard. PostgREST (database) reads were ~99% of a free-tier egress
 * overage; the fix projects list reads to explicit columns and drops heavy JSONB. These
 * tests fail if a multi-row list read regresses back to select('*') or starts shipping
 * the heavy blobs again (exam answers / note content). See docs/plan: "Cut Supabase
 * PostgREST Egress". Detail/single-row reads (getNote, getMockExam) intentionally keep
 * full columns and are not guarded here.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}));

import { supabase } from '../lib/supabaseClient';
import * as authApi from './authApi';

// Records the column string passed to .select() per table behind a chainable,
// awaitable builder that mimics the supabase-js query builder.
const selectByTable = {};
const makeBuilder = (table) => {
  const builder = {
    select: vi.fn((cols) => { selectByTable[table] = cols; return builder; }),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    then: (resolve) => resolve({ data: [], error: null }),
  };
  return builder;
};

beforeEach(() => {
  for (const k of Object.keys(selectByTable)) delete selectByTable[k];
  supabase.from.mockImplementation((table) => makeBuilder(table));
});

describe('egress projection guards', () => {
  it('getAllExamAttempts projects explicit columns and excludes the answers JSONB', async () => {
    await authApi.getAllExamAttempts();
    const cols = selectByTable['exam_attempts'];
    expect(cols).toBeTruthy();
    expect(cols).not.toContain('*');
    expect(cols).not.toMatch(/\banswers\b/);
    // still selects what exam insights aggregate from
    expect(cols).toContain('score');
    expect(cols).toContain('topic_breakdown');
    expect(cols).toContain('mock_exams(');
  });

  it('getNotes (list) projects explicit columns and excludes the content JSONB', async () => {
    await authApi.getNotes();
    const cols = selectByTable['notes'];
    expect(cols).toBeTruthy();
    expect(cols).not.toContain('*');
    expect(cols).not.toMatch(/\bcontent\b/);
    // still selects what the notes list renders
    expect(cols).toContain('title');
    expect(cols).toContain('source_type');
  });
});
