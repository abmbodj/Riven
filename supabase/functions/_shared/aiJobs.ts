import { createHttpError, normalizeYoutubeUrl } from './aiCore.mjs';

export const AI_JOB_KINDS = [
  'deck_generation',
  'class_generation',
  'guide_generation',
  'exam_generation',
  'note_enhancement',
  'youtube_source',
  'youtube_deck',
  'youtube_guide',
  'youtube_exam',
  'youtube_notes',
] as const;

export const AI_JOB_ACTIVE_STATUSES = ['queued', 'running', 'streaming', 'saving'] as const;
export const AI_JOB_PHASES = [
  'accepted',
  'uploading_audio',
  'fetching_audio',
  'processing_media',
  'drafting',
  'enriching',
  'saving',
  'done',
  'error',
] as const;

export const YOUTUBE_DERIVED_JOB_KINDS = [
  'youtube_deck',
  'youtube_guide',
  'youtube_exam',
  'youtube_notes',
] as const;

type JsonRecord = Record<string, unknown>;

type AiJobRow = {
  id: string;
  user_id: number;
  kind: string;
  status: string;
  phase: string;
  progress_percent?: number | null;
  progress_message?: string | null;
  input_payload?: JsonRecord | null;
  result_payload?: JsonRecord | null;
  error_payload?: JsonRecord | null;
  source_key?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

const toRecord = (value: unknown): JsonRecord => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
);

const compactRecord = (value: unknown): JsonRecord => Object.fromEntries(
  Object.entries(toRecord(value)).filter(([, entry]) => entry !== undefined),
);

const getStringField = (value: unknown): string | undefined => (
  typeof value === 'string' && value.trim() ? value : undefined
);

const getNumberField = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const getStringArrayField = (value: unknown): string[] | undefined => (
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : undefined
);

export const normalizeAiJobError = (error: unknown): JsonRecord => {
  if (error instanceof Error) {
    const record = error as Error & {
      status?: unknown;
      statusCode?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
      provider_status?: unknown;
      providerStatus?: unknown;
      strategy_errors?: unknown;
      strategyErrors?: unknown;
    };

    return compactRecord({
      message: error.message || 'Unknown AI job error',
      status: getNumberField(record.status) ?? getNumberField(record.statusCode) ?? 500,
      code: getStringField(record.code),
      details: getStringField(record.details),
      hint: getStringField(record.hint),
      provider_status: getNumberField(record.provider_status) ?? getNumberField(record.providerStatus),
      strategy_errors: getStringArrayField(record.strategy_errors) ?? getStringArrayField(record.strategyErrors),
    });
  }

  if (typeof error === 'string' && error.trim()) {
    return { message: error, status: 500 };
  }

  const record = toRecord(error);
  return compactRecord({
    message: getStringField(record.message) ?? 'Unknown AI job error',
    status: getNumberField(record.status) ?? getNumberField(record.statusCode) ?? 500,
    code: getStringField(record.code),
    details: getStringField(record.details),
    hint: getStringField(record.hint),
    provider_status: getNumberField(record.provider_status) ?? getNumberField(record.providerStatus),
    strategy_errors: getStringArrayField(record.strategy_errors) ?? getStringArrayField(record.strategyErrors),
  });
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isAiJobKind = (value: unknown): value is typeof AI_JOB_KINDS[number] =>
  AI_JOB_KINDS.includes(value as typeof AI_JOB_KINDS[number]);

export const getAiModelMap = () => ({
  // Fast model streams the first usable draft; a stronger model handles the quality pass
  // (enrich, merge, fidelity correction, and knowledge-layer extraction). Both stay
  // env-overridable so cost can be dialed back to Scout via AI_FINAL_MODEL.
  draft: Deno.env.get('AI_DRAFT_MODEL') || 'meta-llama/llama-4-scout-17b-16e-instruct',
  final: Deno.env.get('AI_FINAL_MODEL') || 'llama-3.3-70b-versatile',
  // Conceptual answer grading runs LLM-first on every free-response, so it uses the stronger
  // 70B model for humanlike judgement (not the fast Scout draft model). Env-overridable so the
  // model id can be rotated without a code change if Groq deprecates it.
  grading: Deno.env.get('AI_GRADING_MODEL') || 'llama-3.3-70b-versatile',
});

export const getYoutubeSourceKey = (youtubeUrl: string) => {
  const normalized = normalizeYoutubeUrl(youtubeUrl);

  try {
    const parsed = new URL(normalized);
    const videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').pop() || normalized;
    return `youtube:${videoId}`;
  } catch {
    return `youtube:${normalized}`;
  }
};

export const createDocFromSections = (sections: unknown[] = []) => ({
  type: 'doc',
  content: Array.isArray(sections) ? sections : [],
});

export const extractTextFromTiptapDoc = (doc: unknown): string => {
  if (!doc || typeof doc !== 'object') return '';

  const texts: string[] = [];
  const walk = (nodes: unknown[]) => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const record = node as JsonRecord;
      if (typeof record.text === 'string') {
        texts.push(record.text);
      }
      if (Array.isArray(record.content)) {
        walk(record.content);
      }
    }
  };

  const content = (doc as JsonRecord).content;
  if (Array.isArray(content)) {
    walk(content);
  }

  return texts.join('\n').trim();
};

export const createDocStreamTracker = (onNode?: (node: JsonRecord, nodeIndex: number) => void) => {
  let buffer = '';
  let contentArrayStarted = false;
  let objectStart = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let nodeIndex = 0;
  const sections: JsonRecord[] = [];

  const processChar = (i: number) => {
    const ch = buffer[i];

    if (escaped) {
      escaped = false;
      return;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      return;
    }
    if (ch === '"') {
      inString = !inString;
      return;
    }
    if (inString) return;

    if (ch === '{') {
      if (depth === 0) objectStart = i;
      depth += 1;
    }

    if (ch === '}') {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        try {
          const node = JSON.parse(buffer.slice(objectStart, i + 1));
          sections.push(node);
          onNode?.(node, nodeIndex++);
        } catch {
          // Ignore partial JSON fragments.
        }
        objectStart = -1;
      }
    }
  };

  return {
    feed(text: string) {
      const previousLength = buffer.length;
      buffer += text;

      if (!contentArrayStarted) {
        const contentIndex = buffer.indexOf('"content"');
        if (contentIndex === -1) return;

        const bracketIndex = buffer.indexOf('[', contentIndex + 9);
        if (bracketIndex === -1) return;

        contentArrayStarted = true;
        inString = false;
        escaped = false;
        depth = 0;
        objectStart = -1;

        for (let i = bracketIndex + 1; i < previousLength; i += 1) {
          processChar(i);
        }
      }

      for (let i = Math.max(previousLength, 0); i < buffer.length; i += 1) {
        if (!contentArrayStarted) continue;
        processChar(i);
      }
    },
    getSections() {
      return sections.slice();
    },
    getPreviewDoc() {
      return createDocFromSections(sections);
    },
    getNodeCount() {
      return nodeIndex;
    },
  };
};

export const createArrayStreamTracker = (onItem?: (item: JsonRecord, itemIndex: number) => void) => {
  let buffer = '';
  let objectStart = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let arrayStarted = false;
  let itemIndex = 0;
  const items: JsonRecord[] = [];

  return {
    feed(text: string) {
      const previousLength = buffer.length;
      buffer += text;

      for (let i = previousLength; i < buffer.length; i += 1) {
        const ch = buffer[i];

        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\' && inString) {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;

        if (ch === '[' && !arrayStarted) {
          arrayStarted = true;
          continue;
        }

        if (ch === '{') {
          if (depth === 0) objectStart = i;
          depth += 1;
        }

        if (ch === '}') {
          depth -= 1;
          if (depth === 0 && objectStart >= 0) {
            try {
              const item = JSON.parse(buffer.slice(objectStart, i + 1));
              items.push(item);
              onItem?.(item, itemIndex++);
            } catch {
              // Ignore partial JSON fragments.
            }
            objectStart = -1;
          }
        }
      }
    },
    getItems() {
      return items.slice();
    },
    getItemCount() {
      return itemIndex;
    },
  };
};

export const ensureInternalJobAuth = (request: Request) => {
  const expectedServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const expectedSecret = Deno.env.get('AI_JOB_RUNNER_SECRET');
  const authorization = request.headers.get('authorization')?.trim();
  const internalSecret = request.headers.get('x-ai-job-secret')?.trim();

  const matchesServiceRole = Boolean(
    expectedServiceRoleKey && authorization === `Bearer ${expectedServiceRoleKey}`,
  );
  const matchesSecret = Boolean(expectedSecret && internalSecret === expectedSecret);

  if (!matchesServiceRole && !matchesSecret) {
    throw createHttpError('Unauthorized', 401);
  }
};

export const createJobReporter = (admin: any, initialRow: AiJobRow) => {
  let currentRow: AiJobRow = {
    ...initialRow,
    input_payload: toRecord(initialRow.input_payload),
    result_payload: toRecord(initialRow.result_payload),
    error_payload: toRecord(initialRow.error_payload),
  };

  const persist = async ({
    resultPatch,
    errorPatch,
    ...patch
  }: {
    status?: string;
    phase?: string;
    progress_percent?: number | null;
    progress_message?: string | null;
    source_key?: string | null;
    target_type?: string | null;
    target_id?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    resultPatch?: JsonRecord;
    errorPatch?: JsonRecord;
  }) => {
    currentRow = {
      ...currentRow,
      ...patch,
      result_payload: {
        ...toRecord(currentRow.result_payload),
        ...toRecord(resultPatch),
      },
      error_payload: {
        ...toRecord(currentRow.error_payload),
        ...toRecord(errorPatch),
      },
    };

    const { error } = await admin
      .from('ai_jobs')
      .update({
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.phase !== undefined ? { phase: patch.phase } : {}),
        ...(patch.progress_percent !== undefined ? { progress_percent: patch.progress_percent } : {}),
        ...(patch.progress_message !== undefined ? { progress_message: patch.progress_message } : {}),
        ...(patch.source_key !== undefined ? { source_key: patch.source_key } : {}),
        ...(patch.target_type !== undefined ? { target_type: patch.target_type } : {}),
        ...(patch.target_id !== undefined ? { target_id: patch.target_id } : {}),
        ...(patch.started_at !== undefined ? { started_at: patch.started_at } : {}),
        ...(patch.completed_at !== undefined ? { completed_at: patch.completed_at } : {}),
        result_payload: currentRow.result_payload,
        error_payload: currentRow.error_payload,
      })
      .eq('id', currentRow.id);

    if (error) throw error;
    return currentRow;
  };

  return {
    getRow: () => currentRow,
    markRunning: (phase: string, progressPercent: number | null, message: string, resultPatch?: JsonRecord) =>
      persist({
        status: 'running',
        phase,
        progress_percent: progressPercent,
        progress_message: message,
        started_at: currentRow.started_at || new Date().toISOString(),
        resultPatch,
      }),
    markStreaming: (phase: string, progressPercent: number | null, message: string, resultPatch?: JsonRecord) =>
      persist({
        status: 'streaming',
        phase,
        progress_percent: progressPercent,
        progress_message: message,
        started_at: currentRow.started_at || new Date().toISOString(),
        resultPatch,
      }),
    markSaving: (message: string, resultPatch?: JsonRecord) =>
      persist({
        status: 'saving',
        phase: 'saving',
        progress_percent: 90,
        progress_message: message,
        started_at: currentRow.started_at || new Date().toISOString(),
        resultPatch,
      }),
    update: (phase: string, progressPercent: number | null, message: string, resultPatch?: JsonRecord) =>
      persist({
        phase,
        progress_percent: progressPercent,
        progress_message: message,
        resultPatch,
      }),
    complete: ({
      message,
      resultPatch,
      targetType,
      targetId,
    }: {
      message: string;
      resultPatch?: JsonRecord;
      targetType?: string | null;
      targetId?: string | number | null;
    }) => persist({
      status: 'completed',
      phase: 'done',
      progress_percent: 100,
      progress_message: message,
      completed_at: new Date().toISOString(),
      target_type: targetType ?? currentRow.target_type ?? null,
      target_id: targetId == null ? currentRow.target_id ?? null : String(targetId),
      resultPatch,
    }),
    fail: (error: unknown, phase = 'error') => {
      const normalized = normalizeAiJobError(error);
      const message = typeof normalized.message === 'string'
        ? normalized.message
        : 'Unknown AI job error';
      return persist({
        status: 'failed',
        phase,
        progress_percent: currentRow.progress_percent ?? 0,
        progress_message: message,
        completed_at: new Date().toISOString(),
        errorPatch: normalized,
      });
    },
  };
};

export const createAiHistoryReporter = async ({
  admin,
  userId,
  kind,
  inputPayload,
  sourceKey = null,
  targetType = null,
  targetId = null,
  initialMessage = 'Accepted AI request',
}: {
  admin: any;
  userId: number;
  kind: typeof AI_JOB_KINDS[number];
  inputPayload?: JsonRecord;
  sourceKey?: string | null;
  targetType?: string | null;
  targetId?: string | number | null;
  initialMessage?: string;
}) => {
  const { data, error } = await admin
    .from('ai_jobs')
    .insert({
      user_id: userId,
      kind,
      status: 'queued',
      phase: 'accepted',
      progress_percent: 0,
      progress_message: initialMessage,
      input_payload: compactRecord(inputPayload),
      result_payload: {},
      error_payload: {},
      source_key: sourceKey,
      target_type: targetType,
      target_id: targetId == null ? null : String(targetId),
    })
    .select('*')
    .single();

  if (error) throw error;
  return createJobReporter(admin, data);
};

export const waitForJobCompletion = async ({
  admin,
  jobId,
  userId,
  timeoutMs = 5 * 60 * 1000,
  pollIntervalMs = 1000,
}: {
  admin: any;
  jobId: string;
  userId: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
}) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const { data, error } = await admin
      .from('ai_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw createHttpError('AI dependency job not found.', 404);
    }

    if (data.status === 'completed') return data;
    if (data.status === 'failed' || data.status === 'cancelled') {
      const message = toRecord(data.error_payload).message;
      throw createHttpError(typeof message === 'string' ? message : 'AI dependency job failed.', 500);
    }

    await sleep(pollIntervalMs);
  }

  throw createHttpError('Timed out waiting for AI dependency job.', 504);
};

export const waitForYoutubeSlot = async ({
  admin,
  userId,
  sourceKey,
  jobId,
  maxConcurrent = 2,
  pollIntervalMs = 1000,
}: {
  admin: any;
  userId: number;
  sourceKey: string | null | undefined;
  jobId: string;
  maxConcurrent?: number;
  pollIntervalMs?: number;
}) => {
  if (!sourceKey) return;

  while (true) {
    const { count, error } = await admin
      .from('ai_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('source_key', sourceKey)
      .in('kind', [...YOUTUBE_DERIVED_JOB_KINDS])
      .in('status', ['running', 'streaming', 'saving'])
      .neq('id', jobId);

    if (error) throw error;
    if ((count || 0) < maxConcurrent) return;
    await sleep(pollIntervalMs);
  }
};
