// One row in public.llm_calls per LLM / embedding / transcription call.
import pricing from './llmPricing.json' with { type: 'json' };
import { computeCostUsd } from './ragCore.mjs';

export type LlmFeature =
  | 'tutor' | 'flashcards' | 'exam' | 'guide' | 'notes' | 'transcription'
  | 'embedding' | 'grading' | 'eval' | 'other';

export type LlmCallRow = {
  user_id: number | null;
  feature: LlmFeature;
  provider: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number;
  time_to_first_token_ms: number | null;
  tokens_per_sec: number | null;
  cost_usd: number | null;
  retrieval_ms: number | null;
  chunks_used: number | null;
  success: boolean;
  error_code: string | null;
  trace_id: string | null;
};

export type LlmRecorder = (row: LlmCallRow) => Promise<void>;

/** Request-scoped context threaded through ingest → retrieve → generate. */
export type LlmTelemetry = {
  feature: LlmFeature;
  userId?: number | null;
  traceId?: string | null;
  retrievalMs?: number | null;
  chunksUsed?: number | null;
  recorder?: LlmRecorder;
};

export const newTraceId = () => crypto.randomUUID();

const supabaseRecorder: LlmRecorder = async (row) => {
  if (!Deno.env.get('SUPABASE_URL')) return; // unit tests / local scripts without a project
  // Lazy: keeps this module importable from Node unit tests (jsr: specifiers are Deno-only).
  const { getSupabaseAdmin } = await import('./supabaseAdmin.ts');
  const { error } = await getSupabaseAdmin().from('llm_calls').insert(row);
  if (error) throw error;
};

let defaultRecorder: LlmRecorder = supabaseRecorder;
/** Scripts (eval, backfill) point recording at their own DB connection. */
export const setDefaultLlmRecorder = (recorder: LlmRecorder) => { defaultRecorder = recorder; };

export const errorCode = (error: unknown): string => {
  const e = error as { code?: unknown; status?: unknown; name?: unknown } | null;
  return String(e?.code ?? e?.status ?? e?.name ?? 'error').slice(0, 64);
};

export const recordLlmCall = async (
  telemetry: LlmTelemetry | undefined,
  call: {
    provider: string;
    model: string;
    inputTokens?: number | null;
    outputTokens?: number | null;
    latencyMs: number;
    ttftMs?: number | null;
    audioSeconds?: number;
    success: boolean;
    error?: unknown;
  },
) => {
  const out = call.outputTokens ?? null;
  const genMs = call.latencyMs - (call.ttftMs ?? 0);
  const row: LlmCallRow = {
    user_id: telemetry?.userId ?? null,
    feature: telemetry?.feature ?? 'other',
    provider: call.provider,
    model: call.model,
    input_tokens: call.inputTokens ?? null,
    output_tokens: out,
    latency_ms: Math.round(call.latencyMs),
    time_to_first_token_ms: call.ttftMs == null ? null : Math.round(call.ttftMs),
    tokens_per_sec: out && genMs > 0 ? Math.round((out / (genMs / 1000)) * 100) / 100 : null,
    cost_usd: call.success || call.inputTokens
      ? computeCostUsd(pricing, {
        model: call.model,
        inputTokens: call.inputTokens ?? 0,
        outputTokens: out ?? 0,
        audioSeconds: call.audioSeconds ?? 0,
      })
      : null,
    retrieval_ms: telemetry?.retrievalMs ?? null,
    chunks_used: telemetry?.chunksUsed ?? null,
    success: call.success,
    error_code: call.success ? null : errorCode(call.error),
    trace_id: telemetry?.traceId ?? null,
  };
  try {
    await (telemetry?.recorder ?? defaultRecorder)(row);
  } catch (err) {
    // Observability must never break the user's request.
    console.warn('[llm_calls] failed to record call', err);
  }
};
