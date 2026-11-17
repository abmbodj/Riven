// Push every user's current subscription tier to the LLM gateway. Dry run unless --apply.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… LLM_GATEWAY_BASE_URL=… LLM_GATEWAY_APP_KEY=… \
//     deno run -A scripts/llm-gateway-tier-backfill.ts [--apply] [--batch 500] [--concurrency 8] \
//       [--cursor .llm-gateway-tier-backfill-cursor]
//
// users has no updated_at, so each push is versioned by the time its page was read, like
// reconcile-subscriptions. A webhook for a later provider change carries a newer version and wins.
// A tier written between the read and the push is caught by re-running, which reads again.
//
// Walks users in id order. --apply saves the last id of each fully pushed page to the cursor file,
// so a crash or Ctrl-C resumes at that page. A page with any failed push stops the run before its
// cursor is saved: fix the cause (a 503 means the gateway's Redis is down) and re-run.
// Delete the cursor file to push everyone again.
import { parseArgs } from 'jsr:@std/cli@1.0.6/parse-args';

import type { GatewayTierPush } from '../supabase/functions/_shared/llmGatewayTier.ts';
import { gatewayTierFor, pushTierToGateway } from '../supabase/functions/_shared/llmGatewayTierCore.mjs';
import { getSupabaseAdmin } from '../supabase/functions/_shared/supabaseAdmin.ts';

const args = parseArgs(Deno.args, {
  string: ['batch', 'concurrency', 'cursor'],
  boolean: ['apply'],
  default: { batch: '500', concurrency: '8', cursor: '.llm-gateway-tier-backfill-cursor' },
});
const apply = Boolean(args.apply);
const batch = Math.max(1, Number(args.batch));
const concurrency = Math.max(1, Number(args.concurrency));
const cursorPath = String(args.cursor);
const env = {
  LLM_GATEWAY_BASE_URL: Deno.env.get('LLM_GATEWAY_BASE_URL'),
  LLM_GATEWAY_APP_KEY: Deno.env.get('LLM_GATEWAY_APP_KEY'),
};
if (apply && (!env.LLM_GATEWAY_BASE_URL || !env.LLM_GATEWAY_APP_KEY)) {
  console.error('tier-backfill: --apply needs LLM_GATEWAY_BASE_URL and LLM_GATEWAY_APP_KEY');
  Deno.exit(1);
}

const readCursor = async () => {
  try {
    const id = Number((await Deno.readTextFile(cursorPath)).trim());
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
};

const admin = getSupabaseAdmin();
const logger = { info: () => {}, warn: console.warn };
const tiers = { free: 0, supporter: 0 };
const outcomes: Record<string, number> = {};
let cursor = await readCursor();
console.log(`tier-backfill: ${apply ? 'APPLY' : 'dry run'}, starting after user ${cursor ?? '(start)'}`);

while (true) {
  const version = Date.now();
  let query = admin.from('users').select('id, subscription_tier').order('id').limit(batch);
  if (cursor !== null) query = query.gt('id', cursor);
  const { data: users, error } = await query;
  if (error) throw error;
  if (!users?.length) break;

  const pushes: GatewayTierPush[] = users.map((user: { id: number; subscription_tier: string | null }) => ({
    userId: Number(user.id),
    tier: gatewayTierFor(user.subscription_tier),
    version,
  }));
  for (const push of pushes) tiers[push.tier]++;

  if (apply) {
    const failed: number[] = [];
    let next = 0;
    const worker = async () => {
      while (next < pushes.length) {
        const push = pushes[next++];
        const result = await pushTierToGateway(push, { fetch, env, logger });
        outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1;
        if (result.outcome === 'failed') failed.push(push.userId);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));

    if (failed.length) {
      console.error(`tier-backfill: ${failed.length} pushes failed (users ${failed.join(', ')}). Cursor stays at ${cursor ?? '(start)'}; re-run to retry this page.`);
      Deno.exit(1);
    }
    await Deno.writeTextFile(cursorPath, String(pushes.at(-1)!.userId));
  }

  cursor = pushes.at(-1)!.userId;
  console.log(`tier-backfill: through user ${cursor}: free=${tiers.free} supporter=${tiers.supporter}${apply ? ` ${JSON.stringify(outcomes)}` : ''}`);
}

console.log(`tier-backfill: ${apply ? 'complete' : 'dry run complete, nothing pushed; add --apply to push'}. free=${tiers.free} supporter=${tiers.supporter}${apply ? ` ${JSON.stringify(outcomes)}` : ''}`);
