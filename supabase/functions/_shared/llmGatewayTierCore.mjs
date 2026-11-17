/**
 * Pushes a user's subscription tier to the LLM gateway, which budgets LLM spend per tier.
 *
 * Contract: PUT {LLM_GATEWAY_BASE_URL}/end-users/{userId}/tier with
 * { tier: 'free' | 'supporter', version }. The gateway keeps the push with the highest
 * version per user, so a replayed or out-of-order push answers 200 with applied=false.
 *
 * Runtime-agnostic: no Node-only or Deno-only APIs.
 */

const GATEWAY_TIER_BY_STORED_TIER = new Map([
  ['supporter', 'supporter'],
  ['lifetime', 'supporter'],
]);

/** The gateway knows only 'free' and 'supporter'; lifetime buys the supporter budget. */
export const gatewayTierFor = (storedTier) => GATEWAY_TIER_BY_STORED_TIER.get(storedTier) ?? 'free';

const DEFAULT_PUSH_TIMEOUT_MS = 3000;

/**
 * @typedef {{ outcome: 'disabled' }
 *   | { outcome: 'applied' | 'superseded', tier: string, version: number }
 *   | { outcome: 'failed', error: string, status?: number }} TierPushResult
 */

/**
 * Never throws. 'disabled' means either env var is unset; 'superseded' means the gateway
 * already holds a push with this or a newer version.
 *
 * @param {{ userId: number, tier: 'free' | 'supporter', version: number }} push
 * @param {{ fetch: typeof globalThis.fetch, env: Record<string, string | undefined>, logger?: Pick<Console, 'info' | 'warn'>, timeoutMs?: number }} deps
 * @returns {Promise<TierPushResult>}
 */
export const pushTierToGateway = async (
  { userId, tier, version },
  { fetch, env, logger = console, timeoutMs = DEFAULT_PUSH_TIMEOUT_MS },
) => {
  const baseUrl = env?.LLM_GATEWAY_BASE_URL;
  const appKey = env?.LLM_GATEWAY_APP_KEY;
  if (!baseUrl || !appKey) return { outcome: 'disabled' };

  const fail = (error, status) => {
    logger.warn(`[llm-gateway] tier push failed user=${userId} tier=${tier} version=${version}: ${error}`);
    return { outcome: 'failed', error, status };
  };

  if (!Number.isSafeInteger(userId) || userId < 1) return fail('invalid user id');
  if (tier !== 'free' && tier !== 'supporter') return fail('invalid tier');
  if (!Number.isSafeInteger(version) || version < 1) return fail('invalid version');

  const url = `${baseUrl.replace(/\/+$/, '')}/end-users/${userId}/tier`;
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${appKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, version }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 200);
      return fail(`HTTP ${response.status}${detail ? ` ${detail}` : ''}`, response.status);
    }
    const body = await response.json();
    const outcome = body?.applied ? 'applied' : 'superseded';
    logger.info(`[llm-gateway] tier push user=${userId} tier=${tier} version=${version} ${outcome}`);
    return { outcome, tier: body?.tier, version: body?.version };
  } catch (error) {
    return fail(error?.name === 'TimeoutError' ? `timed out after ${timeoutMs}ms` : (error?.message || String(error)));
  }
};
