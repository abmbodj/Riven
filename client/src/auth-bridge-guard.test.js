import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = path.dirname(fileURLToPath(import.meta.url));

describe('client auth bridge guard', () => {
  it('limits auth route bridge usage in authApi to the approved compatibility surface', async () => {
    const authApiSource = await readFile(path.resolve(srcDir, 'api/authApi.js'), 'utf8');

    const bridgedRoutes = [
      ...authApiSource.matchAll(/authFetch\('\/auth\/([^']+)'/g),
    ].map((match) => match[1]);

    expect([...new Set(bridgedRoutes)].sort()).toEqual([
      '2fa/disable',
      '2fa/login',
      '2fa/setup',
      '2fa/verify',
      'account',
      'complete-registration',
      'forgot-password',
      'login',
      'logout',
      'me',
      'migrate-guest-data',
      'oauth/apple',
      'oauth/google',
      'password',
      'register',
      'reset-password',
      'send-verification',
      'simulate-free',
      'verify-email',
    ]);
  });
});
