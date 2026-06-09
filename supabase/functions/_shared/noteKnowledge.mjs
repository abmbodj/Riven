// ─────────────────────────────────────────────────────────────────────────────
// Structured knowledge layer.
//
// Generated once, eagerly, alongside the human-readable Tiptap note. It is the
// single hand-off every downstream generator consumes (flashcards, mock exams,
// study guides, and a future tutor) so none of them have to re-parse prose.
//
// It captures: testable concepts paired with learning objectives, key
// term/definition pairs, concept relationships + prerequisites, formulas, and
// difficulty/emphasis signals (what the speaker stressed = likely tested).
// ─────────────────────────────────────────────────────────────────────────────

export const KNOWLEDGE_LAYER_VERSION = 1;

const CONTENT_TYPES = [
  'conceptual_technical',
  'narrative_argumentative',
  'procedural_skills',
  'meeting_discussion',
  'language_learning',
];
const DIFFICULTIES = ['intro', 'core', 'advanced'];
const EMPHASES = ['high', 'normal', 'low'];
const ACTION_TYPES = ['deadline', 'assignment', 'follow_up', 'next_step'];

const TRANSCRIPT_CHAR_CAP = 120000;

// ── Tiptap → plain text (self-contained; mirrors the walker used elsewhere) ──
const docToPlainText = (node) => {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) {
    const sep = node.type === 'heading' || node.type === 'paragraph' ? '\n' : '';
    return node.content.map(docToPlainText).join('') + sep;
  }
  return '';
};

export const buildKnowledgeExtractionPrompt = (finalDoc, transcript, className, subject, contentType) => {
  const noteText = docToPlainText(finalDoc).replace(/\n{3,}/g, '\n\n').trim();
  const safeTranscript = typeof transcript === 'string' ? transcript.slice(0, TRANSCRIPT_CHAR_CAP) : '';
  const classLine = className ? `Class/context: ${className}.` : '';
  const subjectLine = subject ? `Subject: ${subject}.` : '';
  const typeLine = contentType ? `Detected content type: ${contentType}.` : '';

  return `You build a structured knowledge layer from a finished set of study notes and the transcript they came from. This layer feeds flashcards, mock exams, study guides, and a tutor — so it must be precise, atomic, and grounded ONLY in the material.

${[classLine, subjectLine, typeLine].filter(Boolean).join(' ')}

Output ONLY a valid JSON object. No markdown, backticks, or text outside the object. Use this exact shape:
{
  "version": ${KNOWLEDGE_LAYER_VERSION},
  "content_type": "one of: ${CONTENT_TYPES.join(' | ')}",
  "subject": "best-fit subject label",
  "summary": "1-2 sentence overview of what this session covered",
  "concepts": [
    {
      "id": "kebab-case-slug",
      "title": "concept name",
      "learning_objective": "what a learner should be able to do, starting with a verb (Explain/Calculate/Compare/Apply...)",
      "summary": "one-sentence testable statement of the concept",
      "prerequisites": ["id of a concept that must be understood first"],
      "related": ["id of a connected concept"],
      "difficulty": "${DIFFICULTIES.join(' | ')}",
      "emphasis": "${EMPHASES.join(' | ')}",
      "emphasis_reason": "why it is high emphasis, e.g. \\"speaker said it will be on the exam\\" (omit if normal)"
    }
  ],
  "key_terms": [
    { "term": "term as written", "definition": "one-sentence plain-language definition", "concept_id": "owning concept id (or null)" }
  ],
  "formulas": [
    { "name": "what it computes", "expression_latex": "LaTeX without surrounding $", "concept_id": "owning concept id (or null)" }
  ],
  "action_items": [
    { "text": "the time-sensitive item verbatim-ish", "type": "${ACTION_TYPES.join(' | ')}", "due": "due date/time as stated, or null" }
  ],
  "emphasis_signals": [
    { "text": "what the speaker stressed", "concept_id": "related concept id (or null)" }
  ]
}

Rules:
- Ground everything in the notes + transcript. Do NOT invent concepts, terms, dates, or numbers that are not supported.
- "concepts" are the testable units. Prefer 4-15 atomic concepts; split compound ideas.
- "prerequisites"/"related" must reference ids that exist in "concepts". Drop dangling references.
- Set "emphasis" to "high" when the speaker repeated a point or flagged it ("important", "on the exam", "you must"). Most concepts are "normal".
- "formulas" only for genuine formulas/equations; otherwise return [].
- "action_items" only for genuinely time-sensitive items (deadlines, assignments, follow-ups, next steps); otherwise return [].
- Every array must be present (use [] when empty). Never return null for an array.

Finished notes (plain text):
${noteText || '(empty)'}

Transcript (ground truth for emphasis and fidelity):
${safeTranscript || '(no transcript provided)'}`;
};

// ── Normalizer: never let a malformed LLM response break storage ─────────────
const slugify = (value, fallback) => {
  const slug = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || fallback;
};

const clampEnum = (value, allowed, fallback) =>
  (typeof value === 'string' && allowed.includes(value)) ? value : fallback;

const asString = (value) => (typeof value === 'string' ? value.trim() : '');

const asStringArray = (value) =>
  Array.isArray(value) ? value.map(asString).filter(Boolean) : [];

const asArray = (value) => (Array.isArray(value) ? value : []);

export const normalizeKnowledgeLayer = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const concepts = asArray(raw.concepts)
    .map((c, i) => {
      if (!c || typeof c !== 'object') return null;
      const title = asString(c.title);
      const id = slugify(c.id || title, `concept-${i + 1}`);
      if (!title && !asString(c.summary)) return null;
      return {
        id,
        title: title || id,
        learning_objective: asString(c.learning_objective),
        summary: asString(c.summary),
        prerequisites: asStringArray(c.prerequisites).map((p) => slugify(p, p)),
        related: asStringArray(c.related).map((p) => slugify(p, p)),
        difficulty: clampEnum(c.difficulty, DIFFICULTIES, 'core'),
        emphasis: clampEnum(c.emphasis, EMPHASES, 'normal'),
        emphasis_reason: asString(c.emphasis_reason) || undefined,
      };
    })
    .filter(Boolean);

  const conceptIds = new Set(concepts.map((c) => c.id));
  // Drop dangling prerequisite/related references so the graph stays consistent.
  for (const concept of concepts) {
    concept.prerequisites = concept.prerequisites.filter((p) => conceptIds.has(p) && p !== concept.id);
    concept.related = concept.related.filter((p) => conceptIds.has(p) && p !== concept.id);
  }

  const resolveConceptId = (value) => {
    const slug = slugify(value, '');
    return slug && conceptIds.has(slug) ? slug : null;
  };

  const key_terms = asArray(raw.key_terms)
    .map((t) => {
      if (!t || typeof t !== 'object') return null;
      const term = asString(t.term);
      const definition = asString(t.definition);
      if (!term) return null;
      return { term, definition, concept_id: resolveConceptId(t.concept_id) };
    })
    .filter(Boolean);

  const formulas = asArray(raw.formulas)
    .map((f) => {
      if (!f || typeof f !== 'object') return null;
      const expression = asString(f.expression_latex);
      if (!expression) return null;
      return { name: asString(f.name), expression_latex: expression, concept_id: resolveConceptId(f.concept_id) };
    })
    .filter(Boolean);

  const action_items = asArray(raw.action_items)
    .map((a) => {
      if (!a || typeof a !== 'object') return null;
      const text = asString(a.text);
      if (!text) return null;
      return { text, type: clampEnum(a.type, ACTION_TYPES, 'follow_up'), due: asString(a.due) || null };
    })
    .filter(Boolean);

  const emphasis_signals = asArray(raw.emphasis_signals)
    .map((e) => {
      if (!e || typeof e !== 'object') return null;
      const text = asString(e.text);
      if (!text) return null;
      return { text, concept_id: resolveConceptId(e.concept_id) };
    })
    .filter(Boolean);

  return {
    version: KNOWLEDGE_LAYER_VERSION,
    content_type: clampEnum(raw.content_type, CONTENT_TYPES, 'conceptual_technical'),
    subject: asString(raw.subject),
    summary: asString(raw.summary),
    concepts,
    key_terms,
    formulas,
    action_items,
    emphasis_signals,
  };
};

// ── Downstream context: compact text block injected into generator prompts ───
export const buildKnowledgeContext = (layer) => {
  if (!layer || typeof layer !== 'object' || !Array.isArray(layer.concepts) || layer.concepts.length === 0) {
    return '';
  }

  const lines = ['Structured knowledge layer (authoritative — build from this; do not re-derive from prose):'];
  if (layer.summary) lines.push(`Overview: ${layer.summary}`);
  if (layer.content_type) lines.push(`Content type: ${layer.content_type}`);

  lines.push('', 'Concepts (id — title [difficulty/emphasis]: objective):');
  for (const c of layer.concepts) {
    const flags = [c.difficulty, c.emphasis === 'high' ? 'HIGH-EMPHASIS' : null].filter(Boolean).join('/');
    const deps = c.prerequisites?.length ? ` (needs: ${c.prerequisites.join(', ')})` : '';
    lines.push(`- ${c.id} — ${c.title} [${flags}]: ${c.learning_objective || c.summary || ''}${deps}`);
  }

  if (layer.key_terms?.length) {
    lines.push('', 'Key terms:');
    for (const t of layer.key_terms) lines.push(`- ${t.term}: ${t.definition}`);
  }

  if (layer.formulas?.length) {
    lines.push('', 'Formulas (LaTeX):');
    for (const f of layer.formulas) lines.push(`- ${f.name ? `${f.name}: ` : ''}$${f.expression_latex}$`);
  }

  const highEmphasis = layer.emphasis_signals?.length
    ? layer.emphasis_signals
    : (layer.concepts || []).filter((c) => c.emphasis === 'high').map((c) => ({ text: c.title }));
  if (highEmphasis.length) {
    lines.push('', 'Prioritize (speaker emphasized — most likely to be tested):');
    for (const e of highEmphasis) lines.push(`- ${e.text}`);
  }

  return lines.join('\n');
};

// Fetches a note's stored knowledge layer and renders it as downstream prompt context.
// Returns '' when there is no note id, no stored layer, or on any error — so callers
// transparently fall back to the plain-text source path. Scoped to the owning user when a
// userId is supplied so one user's generation never pulls another user's knowledge layer.
export const fetchKnowledgeContext = async (admin, noteId, userId = null) => {
  if (!admin || !noteId) return '';
  try {
    let query = admin.from('notes').select('knowledge_layer').eq('id', noteId);
    if (userId != null) query = query.eq('user_id', userId);
    const { data, error } = await query.maybeSingle();
    if (error || !data?.knowledge_layer) return '';
    return buildKnowledgeContext(data.knowledge_layer);
  } catch {
    return '';
  }
};
