#!/usr/bin/env node
// New source files under client/src must be TypeScript (.ts/.tsx). Existing .js/.jsx
// files may stay as they are; renaming one to .ts is always allowed.
//
//   node scripts/check-new-ts-files.mjs --staged        (pre-commit: staged additions)
//   node scripts/check-new-ts-files.mjs --base <ref>     (CI: additions since <ref>)
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const baseIndex = args.indexOf('--base');
const diffArgs = args.includes('--staged')
  ? ['diff', '--cached', '--name-only', '--diff-filter=A']
  : ['diff', '--name-only', '--diff-filter=A', `${baseIndex >= 0 ? args[baseIndex + 1] : 'origin/main'}...HEAD`];

const added = execFileSync('git', diffArgs, { encoding: 'utf8' }).split('\n').filter(Boolean);
const offenders = added.filter((file) => /^client\/src\/.*\.(js|jsx)$/.test(file));

if (offenders.length) {
  console.error('New files under client/src must be TypeScript (.ts/.tsx):');
  for (const file of offenders) console.error(`  ${file}`);
  process.exit(1);
}
console.log(`check-new-ts-files: ${added.length} added file(s), none are new JS under client/src.`);
