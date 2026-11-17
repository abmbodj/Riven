import { pushTierToGateway } from './llmGatewayTierCore.mjs';
import { reportEdgeException } from './sentry.ts';

export type GatewayTierPush = { userId: number; tier: 'free' | 'supporter'; version: number };

const gatewayEnv = () => ({
  LLM_GATEWAY_BASE_URL: Deno.env.get('LLM_GATEWAY_BASE_URL'),
  LLM_GATEWAY_APP_KEY: Deno.env.get('LLM_GATEWAY_APP_KEY'),
});

/** Best effort: the stored tier is already committed, so a failed push is logged and reported, never thrown. */
export const pushTierFromEdge = async (
  push: GatewayTierPush | null | undefined,
  context: { request?: Request; functionName: string },
) => {
  if (!push) return;
  const result = await pushTierToGateway(push, { fetch, env: gatewayEnv(), logger: console });
  if (result.outcome !== 'failed') return;
  await reportEdgeException(new Error(`LLM gateway tier push failed: ${result.error}`), {
    ...context,
    tags: { llm_gateway_status: result.status ?? 'no-response' },
    extras: { userId: push.userId, tier: push.tier, version: push.version },
  }).catch(() => {});
};
