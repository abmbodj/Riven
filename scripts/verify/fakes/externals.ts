// Network-boundary fakes for the local verification host (scripts/verify/edge/host.ts).
//
// Every fetch an edge function makes to a third party (OpenAI, Deepgram, YouTube,
// transcriptapi, Canvas, Stripe, Resend, Gemini embeddings) is answered here from
// deterministic fixtures, so runs are repeatable and need no keys. Requests to the
// local Supabase stack pass through. Anything else is refused with 599 and logged as
// `blocked`, so a new external dependency shows up instead of silently reaching out.
// Every intercepted call is appended to $RIVEN_VERIFY_FAKE_LOG (JSONL).

import { aiChatResponse, aiTranscription } from './ai.ts';
import { canvasIcs, deepgramBatch, embedVector, stripeObject, youtubeTranscript } from './providers.ts';

const LOG = Deno.env.get('RIVEN_VERIFY_FAKE_LOG');
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', 'host.docker.internal']);
const realFetch = globalThis.fetch.bind(globalThis);

export type FakeCall = { host: string; method: string; path: string; route: string; status: number; note?: string; body?: unknown };

function log(entry: FakeCall) {
  if (!LOG) return;
  Deno.writeTextFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n', { append: true });
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function readBody(req: Request): Promise<{ json?: Record<string, unknown>; form?: FormData; text?: string }> {
  const type = req.headers.get('content-type') ?? '';
  if (type.includes('application/json')) return { json: await req.json().catch(() => ({})) };
  if (type.includes('multipart/form-data')) return { form: await req.formData() };
  if (type.includes('application/x-www-form-urlencoded')) return { text: await req.text() };
  return {};
}

async function route(req: Request, url: URL): Promise<{ res: Response; route: string; note?: string; body?: unknown }> {
  const host = url.hostname;
  const path = url.pathname;
  if (host === 'api.openai.com') {
    if (path.endsWith('/chat/completions')) {
      const { json: body = {} } = await readBody(req);
      const { response, rule } = aiChatResponse(body);
      return { res: response, route: `openai.chat:${rule}`, note: rule === 'unrouted' ? summarizePrompt(body) : undefined };
    }
    if (path.endsWith('/audio/transcriptions')) return { res: json(aiTranscription()), route: 'openai.transcription' };
  }
  if (host === 'api.deepgram.com') {
    if (path === '/v1/auth/grant') return { res: json({ access_token: 'fake-deepgram-temp-token', expires_in: 30 }), route: 'deepgram.grant' };
    if (path === '/v1/listen') return { res: json(deepgramBatch()), route: 'deepgram.listen' };
  }
  if (host === 'transcriptapi.com') {
    const id = url.searchParams.get('video_url') ?? url.searchParams.get('video_id') ?? '';
    return { res: json(youtubeTranscript(id)), route: 'transcriptapi.youtube' };
  }
  if (host === 'www.youtube.com' || host === 'youtube.com') {
    // Force the transcriptapi path: the scraped-player path is not faked.
    return { res: new Response('not faked', { status: 404 }), route: 'youtube.direct-404' };
  }
  if (host.endsWith('.instructure.com') && path.includes('/feeds/calendars/')) {
    return { res: new Response(canvasIcs(), { headers: { 'content-type': 'text/calendar' } }), route: 'canvas.ical' };
  }
  if (host === 'api.resend.com') return { res: json({ id: 'fake-email-id' }), route: 'resend.send' };
  if (host === 'generativelanguage.googleapis.com') {
    const { json: body = {} } = await readBody(req);
    const requests = (body.requests as Array<{ content: { parts: Array<{ text: string }> } }>) ?? [body as never];
    const embeddings = requests.map((r) => ({ values: embedVector(r?.content?.parts?.map((p) => p.text).join(' ') ?? '') }));
    return { res: json(path.includes('batchEmbedContents') ? { embeddings } : { embedding: embeddings[0] }), route: 'gemini.embed' };
  }
  if (host === 'api.stripe.com') {
    const { text = '' } = await readBody(req);
    return { res: json(stripeObject(req.method, path, new URLSearchParams(text))), route: `stripe:${req.method} ${path}`, body: Object.fromEntries(new URLSearchParams(text)) };
  }
  return { res: new Response(`riven-verify: external host not faked: ${host}`, { status: 599 }), route: 'blocked' };
}

function summarizePrompt(body: Record<string, unknown>) {
  const messages = (body.messages as Array<{ role: string; content: unknown }>) ?? [];
  const text = (m?: { content: unknown }) => typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '');
  return `system: ${text(messages.find((m) => m.role === 'system')).slice(0, 240)} | user: ${text(messages.findLast((m) => m.role === 'user')).slice(0, 240)}`;
}

export function installFetchFakes() {
  globalThis.fetch = async (input: Request | URL | string, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (LOCAL_HOSTS.has(url.hostname)) return realFetch(req);
    const { res, route: name, note, body } = await route(req, url);
    log({ host: url.hostname, method: req.method, path: url.pathname, route: name, status: res.status, note, body });
    return res;
  };
}
