import { describe, expect, it } from 'vitest';

import { collectExpiredRecordingPaths } from '../../supabase/functions/_shared/audioRetentionCore.mjs';

describe('audio retention cleanup', () => {
  it('deletes only chunk paths belonging to the expired session', () => {
    expect(collectExpiredRecordingPaths({
      sessionId: 'session-1',
      userId: 42,
      chunks: [
        { session_id: 'session-1', storage_path: '42/session-1/0.webm', upload_state: 'verified' },
        { session_id: 'session-2', storage_path: '42/session-2/0.webm', upload_state: 'verified' },
        { session_id: 'session-1', storage_path: '', upload_state: 'failed' },
      ],
    })).toEqual(['42/session-1/0.webm']);
  });
});
