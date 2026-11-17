// Deterministic third-party fixtures (non-AI) for the local verification stack.
import { FAKE_TRANSCRIPT } from './ai.ts';

export function deepgramBatch() {
  const sentences = FAKE_TRANSCRIPT.split(/(?<=\.)\s+/);
  return {
    metadata: { request_id: 'fake-deepgram-request' },
    results: { utterances: sentences.map((transcript, i) => ({ start: i * 4, end: i * 4 + 3.5, transcript, confidence: 0.98, speaker: 0 })) },
  };
}

export function youtubeTranscript(videoId: string) {
  return {
    video_id: videoId,
    transcript: FAKE_TRANSCRIPT.split(/(?<=\.)\s+/).map((text, i) => ({ text, start: i * 5, duration: 5 })),
  };
}

// A Canvas calendar feed with one class event and two assignments, dated relative to
// "now" so they always render as upcoming.
export function canvasIcs(now = new Date()) {
  const day = (offset: number) => {
    const d = new Date(now.getTime() + offset * 86_400_000);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  };
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Instructure//Canvas//EN',
    'BEGIN:VEVENT', `UID:event-assignment-9001`, `DTSTART:${day(3)}T235900Z`, `DTEND:${day(3)}T235900Z`,
    'SUMMARY:Problem Set 4 [BIO 101 Cell Biology]', 'URL:https://riven-test.instructure.com/courses/42/assignments/9001',
    'DESCRIPTION:Glycolysis worksheet', 'END:VEVENT',
    'BEGIN:VEVENT', `UID:event-assignment-9002`, `DTSTART:${day(8)}T235900Z`, `DTEND:${day(8)}T235900Z`,
    'SUMMARY:Lab Report 2 [BIO 101 Cell Biology]', 'URL:https://riven-test.instructure.com/courses/42/assignments/9002',
    'DESCRIPTION:Mitochondria staining lab', 'END:VEVENT',
    'END:VCALENDAR', '',
  ].join('\r\n');
}

// 1536-dim deterministic unit vector from text (matches gemini-embedding-2 output size).
export function embedVector(text: string, dims = 1536) {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i++) seed = Math.imul(seed ^ text.charCodeAt(i), 16777619);
  const out = new Array(dims);
  let norm = 0;
  for (let i = 0; i < dims; i++) {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507) ^ i;
    const v = ((seed >>> 0) / 4294967296) - 0.5;
    out[i] = v; norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  return out.map((v) => v / norm);
}

// Minimal Stripe objects for checkout / portal. The caller's params are echoed into
// metadata so a journey can assert what the app asked Stripe for.
export function stripeObject(method: string, path: string, params: URLSearchParams) {
  const p = Object.fromEntries(params);
  if (path === '/v1/customers' && method === 'POST') return { id: 'cus_fake_local', object: 'customer', email: p.email ?? null, metadata: {} };
  if (path.startsWith('/v1/customers/')) return { id: path.split('/').pop(), object: 'customer', deleted: false, metadata: {} };
  if (path.startsWith('/v1/customers') && method === 'GET') return { object: 'list', data: [], has_more: false };
  // Webhook re-verification reads the session and subscription back from Stripe.
  if (path.startsWith('/v1/checkout/sessions/') && method === 'GET') {
    const id = path.split('/').pop() ?? 'cs_fake';
    const lifetime = id.includes('lifetime');
    return { id, object: 'checkout.session', payment_status: id.includes('unpaid') ? 'unpaid' : 'paid', mode: lifetime ? 'payment' : 'subscription', subscription: lifetime ? null : 'sub_fake_local', customer: 'cus_fake_local', line_items: { object: 'list', data: [] } };
  }
  if (/^\/v1\/subscriptions\/[^/]+$/.test(path) && method === 'GET') {
    return { id: path.split('/').pop(), object: 'subscription', status: 'active', customer: 'cus_fake_local', current_period_end: Math.floor(Date.now() / 1000) + 30 * 86_400 };
  }
  if (path === '/v1/checkout/sessions') return { id: 'cs_fake_local', object: 'checkout.session', url: 'https://checkout.stripe.com/c/pay/cs_fake_local', mode: p.mode ?? 'subscription', metadata: {} };
  if (path === '/v1/billing_portal/sessions') return { id: 'bps_fake_local', object: 'billing_portal.session', url: 'https://billing.stripe.com/p/session/fake_local' };
  if (path.startsWith('/v1/prices')) return { id: path.split('/').pop() ?? 'price_fake', object: 'price', active: true, unit_amount: 799, currency: 'usd', recurring: { interval: 'month' } };
  if (path.startsWith('/v1/coupons') || path.startsWith('/v1/promotion_codes')) return { object: 'list', data: [], has_more: false };
  if (path.startsWith('/v1/subscriptions')) return { object: 'list', data: [], has_more: false };
  return { object: 'unknown', id: 'fake' };
}
