import { beforeEach, describe, expect, it, vi } from 'vitest';

import { gatewayTierFor, pushTierToGateway } from '../../supabase/functions/_shared/llmGatewayTierCore.mjs';

const env = { LLM_GATEWAY_BASE_URL: 'https://gateway.test/v1', LLM_GATEWAY_APP_KEY: 'app-key' };
const push = { userId: 42, tier: 'supporter', version: 1_760_000_000_000 };

const jsonResponse = (status, body) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
});

describe('pushTierToGateway', () => {
    let logger;

    beforeEach(() => {
        logger = { info: vi.fn(), warn: vi.fn() };
    });

    it.each([
        ['base URL', { LLM_GATEWAY_APP_KEY: 'app-key' }],
        ['app key', { LLM_GATEWAY_BASE_URL: 'https://gateway.test/v1' }],
    ])('does nothing when the %s is unset', async (_name, partialEnv) => {
        const fetch = vi.fn();
        const result = await pushTierToGateway(push, { fetch, env: partialEnv, logger });

        expect(result).toEqual({ outcome: 'disabled' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('PUTs the tier and version to the end user with the app key', async () => {
        const fetch = vi.fn().mockResolvedValue(jsonResponse(200, { tier: 'supporter', version: push.version, applied: true }));
        const result = await pushTierToGateway(push, { fetch, env: { ...env, LLM_GATEWAY_BASE_URL: 'https://gateway.test/v1/' }, logger });

        expect(result).toEqual({ outcome: 'applied', tier: 'supporter', version: push.version });
        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, init] = fetch.mock.calls[0];
        expect(url).toBe('https://gateway.test/v1/end-users/42/tier');
        expect(init.method).toBe('PUT');
        expect(init.headers).toEqual({ Authorization: 'Bearer app-key', 'Content-Type': 'application/json' });
        expect(JSON.parse(init.body)).toEqual({ tier: 'supporter', version: 1_760_000_000_000 });
    });

    it('reports a replayed or older push as superseded, not a failure', async () => {
        const fetch = vi.fn().mockResolvedValue(jsonResponse(200, { tier: 'free', version: push.version + 1, applied: false }));
        const result = await pushTierToGateway(push, { fetch, env, logger });

        expect(result).toEqual({ outcome: 'superseded', tier: 'free', version: push.version + 1 });
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it.each([400, 401, 503])('swallows and logs HTTP %i', async (status) => {
        const fetch = vi.fn().mockResolvedValue(jsonResponse(status, { error: 'nope' }));
        const result = await pushTierToGateway(push, { fetch, env, logger });

        expect(result).toMatchObject({ outcome: 'failed', status });
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`HTTP ${status}`));
    });

    it('gives up after the timeout instead of holding the caller', async () => {
        const fetch = vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason));
        }));
        const started = Date.now();
        const result = await pushTierToGateway(push, { fetch, env, logger, timeoutMs: 50 });

        expect(Date.now() - started).toBeLessThan(1000);
        expect(result).toEqual({ outcome: 'failed', error: 'timed out after 50ms' });
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('timed out'));
    });

    it('swallows and logs network errors', async () => {
        const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
        const result = await pushTierToGateway(push, { fetch, env, logger });

        expect(result).toEqual({ outcome: 'failed', error: 'fetch failed' });
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('fetch failed'));
    });

    it.each([
        ['a missing version', { ...push, version: undefined }],
        ['a fractional version', { ...push, version: 1.5 }],
        ['a version past 2^53', { ...push, version: 2 ** 53 }],
        ['an unknown tier', { ...push, tier: 'lifetime' }],
        ['a non-numeric user id', { ...push, userId: 'abc' }],
    ])('refuses %s without calling the gateway', async (_name, badPush) => {
        const fetch = vi.fn();
        const result = await pushTierToGateway(badPush, { fetch, env, logger });

        expect(result.outcome).toBe('failed');
        expect(fetch).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
    });
});

describe('gatewayTierFor', () => {
    it('gives paid tiers the supporter budget and everything else the free one', () => {
        expect(gatewayTierFor('supporter')).toBe('supporter');
        expect(gatewayTierFor('lifetime')).toBe('supporter');
        expect(gatewayTierFor('free')).toBe('free');
        expect(gatewayTierFor(null)).toBe('free');
        expect(gatewayTierFor(undefined)).toBe('free');
    });
});
