// The one place embeddings are produced. Swap providers here, nowhere else.
//
// Provider (EMBED_PROVIDER, default: vertex when GCP_SA_JSON is set, else gemini):
//   vertex  – Vertex AI, service-account JSON in GCP_SA_JSON, project GCP_PROJECT, location GCP_LOCATION (default "us").
//   gemini  – Gemini Developer API with GEMINI_API_KEY (same model, API-key auth).
// Model gemini-embedding-2 at 1536 dims (already L2-normalized by the model at reduced dims).
// The model has no task_type; query/document asymmetry is expressed with its documented prefixes.
import { estimateTokens } from './ragCore.mjs';
import { recordLlmCall, type LlmTelemetry } from './llmTelemetry.ts';

export const EMBED_MODEL = 'gemini-embedding-2';
export const EMBED_DIMS = 1536;
const GEMINI_BATCH = 50;
const VERTEX_CONCURRENCY = 8;
const MAX_ATTEMPTS = 5;

export type EmbedKind = 'document' | 'query';

export const formatForEmbedding = (text: string, kind: EmbedKind, title?: string) =>
  kind === 'query'
    ? `task: search result | query: ${text}`
    : `title: ${title?.trim() || 'none'} | text: ${text}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class EmbedHttpError extends Error {
  constructor(public status: number, body: string) {
    super(`embedding request failed (${status}): ${body.slice(0, 1500)}`);
  }
}

// Google's 429s carry a RetryInfo detail ("retryDelay": "37s") sized to the per-minute quota
// window. Plain exponential backoff (≈31 s total) gave up before that window reset.
const MAX_RETRY_DELAY_MS = 65_000;
export const retryDelayMs = (body: string): number | null => {
  const m = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return m ? Math.min(Number(m[1]) * 1000, MAX_RETRY_DELAY_MS) : null;
};

/** POST JSON with backoff on 429/5xx/network errors, honouring the server's retryDelay. */
const postJson = async (url: string, headers: Record<string, string>, body: unknown) => {
  for (let attempt = 1; ; attempt++) {
    let serverDelay: number | null = null;
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
      if (res.ok) return await res.json();
      const text = await res.text();
      if (!(res.status === 429 || res.status >= 500) || attempt >= MAX_ATTEMPTS) throw new EmbedHttpError(res.status, text);
      serverDelay = retryDelayMs(text);
    } catch (error) {
      if (error instanceof EmbedHttpError || attempt >= MAX_ATTEMPTS) throw error;
    }
    await sleep((serverDelay ?? Math.min(500 * 2 ** attempt, 16_000)) + Math.random() * 250);
  }
};

// ── Gemini Developer API ─────────────────────────────────────────────────────
const geminiEmbed = async (inputs: string[]) => {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const vectors: number[][] = [];
  let tokens = 0;
  for (let i = 0; i < inputs.length; i += GEMINI_BATCH) {
    const batch = inputs.slice(i, i + GEMINI_BATCH);
    const json = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents`,
      { 'x-goog-api-key': key },
      {
        requests: batch.map((text) => ({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text }] },
          output_dimensionality: EMBED_DIMS,
        })),
      },
    );
    for (const e of json.embeddings ?? []) vectors.push(e.values);
    tokens += Number(json.usageMetadata?.promptTokenCount) || batch.reduce((n, t) => n + estimateTokens(t), 0);
  }
  return { vectors, tokens };
};

// ── Vertex AI ────────────────────────────────────────────────────────────────
// ponytail: untested here (no GCP project on the dev machine). Uses a self-signed service-account
// JWT → OAuth access token, cached until shortly before expiry.
let vertexToken: { value: string; expiresAt: number } | null = null;

const b64url = (data: Uint8Array | string) =>
  btoa(typeof data === 'string' ? data : String.fromCharCode(...data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const vertexAccessToken = async (): Promise<string> => {
  if (vertexToken && vertexToken.expiresAt > Date.now() + 60_000) return vertexToken.value;
  const sa = JSON.parse(Deno.env.get('GCP_SA_JSON') ?? '{}');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))}`;
  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`Vertex auth failed (${res.status})`);
  const json = await res.json();
  vertexToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return vertexToken.value;
};

const vertexEmbed = async (inputs: string[]) => {
  const project = Deno.env.get('GCP_PROJECT');
  const location = Deno.env.get('GCP_LOCATION') ?? 'us';
  if (!project) throw new Error('GCP_PROJECT is not set');
  const url = `https://aiplatform.${location}.rep.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${EMBED_MODEL}:embedContent`;
  const vectors: number[][] = new Array(inputs.length);
  let tokens = 0;
  // embedContent aggregates multiple parts into one vector, so it's one request per input.
  for (let i = 0; i < inputs.length; i += VERTEX_CONCURRENCY) {
    await Promise.all(inputs.slice(i, i + VERTEX_CONCURRENCY).map(async (text, j) => {
      const token = await vertexAccessToken();
      const json = await postJson(url, { Authorization: `Bearer ${token}` }, {
        content: { role: 'user', parts: [{ text }] },
        outputDimensionality: EMBED_DIMS,
      });
      vectors[i + j] = json.embedding?.values ?? json.embeddings?.[0]?.values;
      tokens += Number(json.usageMetadata?.promptTokenCount) || estimateTokens(text);
    }));
  }
  return { vectors, tokens };
};

export const embedProvider = () =>
  Deno.env.get('EMBED_PROVIDER') ?? (Deno.env.get('GCP_SA_JSON') ? 'vertex' : 'gemini');

/**
 * Embed texts. `titles` (documents only) feed the model's `title:` prefix.
 * Records one llm_calls row per call (feature "embedding", same trace id as the request).
 */
export const embed = async (
  texts: string[],
  { kind, titles, telemetry }: { kind: EmbedKind; titles?: string[]; telemetry?: Partial<LlmTelemetry> },
): Promise<number[][]> => {
  if (!texts.length) return [];
  const provider = embedProvider();
  const inputs = texts.map((t, i) => formatForEmbedding(t, kind, titles?.[i]));
  const started = performance.now();
  const ctx: LlmTelemetry = { ...telemetry, feature: 'embedding' };
  try {
    const { vectors, tokens } = provider === 'vertex' ? await vertexEmbed(inputs) : await geminiEmbed(inputs);
    if (vectors.length !== texts.length || vectors.some((v) => v?.length !== EMBED_DIMS)) {
      throw new Error(`embedding provider returned ${vectors.length} vectors for ${texts.length} inputs`);
    }
    await recordLlmCall(ctx, {
      provider: provider === 'vertex' ? 'vertex' : 'gemini',
      model: EMBED_MODEL,
      inputTokens: tokens,
      outputTokens: 0,
      latencyMs: performance.now() - started,
      success: true,
    });
    return vectors;
  } catch (error) {
    await recordLlmCall(ctx, {
      provider, model: EMBED_MODEL, latencyMs: performance.now() - started, success: false, error,
    });
    throw error;
  }
};
