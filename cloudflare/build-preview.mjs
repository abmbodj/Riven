import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const client = path.resolve(directory, '../client');
const output = path.join(directory, 'dist');
const build = spawnSync('npm', ['run', 'build'], {
  cwd: client,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_API_URL: '',
    VITE_SKIP_TURNSTILE: 'false',
    VITE_E2E_FIXTURES: 'false',
    VITE_STRIPE_PRICE_ANNUAL: process.env.VITE_STRIPE_PRICE_ANNUAL || 'price_1TC5KWLYlsIF3kiq2Sdk7pHl',
  },
});
if (build.status !== 0) process.exit(build.status ?? 1);
// Preserve immutable assets used by clients still running the previous release.
await cp(path.join(directory, 'legacy-assets', 'assets'), path.join(client, 'dist', 'assets'), { recursive: true, force: false, errorOnExist: false });
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(client, 'dist'), output, { recursive: true });
await writeFile(path.join(output, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n');
