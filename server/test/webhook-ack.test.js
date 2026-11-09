import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import Stripe from 'stripe';
import registerWebhooks from '../routes/webhooks.js';

describe('Stripe webhook acknowledgement', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('returns an error so Stripe can retry when event processing fails', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_local_only');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_local_only');
    const app = express();
    app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
    registerWebhooks({ app, db: {
      query: async () => [],
      execute: async () => { throw new Error('database unavailable'); },
    } });
    const payload = JSON.stringify({ id: 'evt_local_only', type: 'customer.subscription.deleted', data: { object: { customer: 'cus_local_only' } } });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_local_only' });
    const response = await request(app).post('/api/webhooks/stripe').set('Content-Type', 'application/json').set('Stripe-Signature', signature).send(payload);
    expect(response.status).toBe(500);
  });

  it('acknowledges a signed event after recording it', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_local_only');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_local_only');
    const app = express();
    app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
    const execute = vi.fn(async () => ({}));
    registerWebhooks({ app, db: { query: async () => [], execute } });
    const payload = JSON.stringify({ id: 'evt_success', type: 'local.unhandled', data: { object: {} } });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_local_only' });
    const response = await request(app).post('/api/webhooks/stripe').set('Content-Type', 'application/json').set('Stripe-Signature', signature).send(payload);
    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO stripe_processed_events'), ['evt_success']);
  });

  it('does not acknowledge an event if persistent deduplication fails in Worker mode', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_local_only');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_local_only');
    vi.stubEnv('RIVEN_WORKER_MODE', 'true');
    const app = express();
    app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
    registerWebhooks({ app, db: {
      query: async () => [],
      execute: async () => { throw new Error('database unavailable'); },
    } });
    const payload = JSON.stringify({ id: 'evt_record_failure', type: 'local.unhandled', data: { object: {} } });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_local_only' });
    const response = await request(app).post('/api/webhooks/stripe').set('Content-Type', 'application/json').set('Stripe-Signature', signature).send(payload);
    expect(response.status).toBe(500);
  });
});
