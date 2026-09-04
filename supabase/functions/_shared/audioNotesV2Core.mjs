const formatTimestamp = (milliseconds) => {
  const total = Math.max(0, Math.round(Number(milliseconds || 0)));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
};

const segmentId = (segment, index) => String(
  segment?.provider_segment_id || segment?.id || `segment-${index + 1}`,
);

const segmentText = (segment) => String(
  segment?.corrected_text || segment?.correctedText || segment?.original_text || segment?.text || '',
).trim();

const sortSegments = (segments) => [...(segments || [])].sort((left, right) => (
  Number(left?.started_at_ms ?? left?.startMs ?? 0) - Number(right?.started_at_ms ?? right?.startMs ?? 0)
  || segmentId(left, 0).localeCompare(segmentId(right, 0))
));

export function buildEvidenceTranscript(segments = []) {
  return sortSegments(segments).map((segment, index) => {
    const id = segmentId(segment, index);
    const start = segment.started_at_ms ?? segment.startMs ?? 0;
    const end = segment.ended_at_ms ?? segment.endMs ?? start;
    const speakerValue = segment.speaker_role ?? segment.speakerRole ?? segment.speaker_key ?? segment.speaker;
    const speaker = speakerValue != null ? `Speaker ${speakerValue}` : 'Unattributed';
    return `[${id} | ${formatTimestamp(start)}–${formatTimestamp(end)} | ${speaker}] ${segmentText(segment)}`;
  }).filter((line) => !line.endsWith('] ')).join('\n');
}

export function buildRecordingAssetEvidence(assets = []) {
  return [...assets]
    .sort((left, right) => Number(left?.captured_at_ms ?? left?.capturedAtMs ?? 0)
      - Number(right?.captured_at_ms ?? right?.capturedAtMs ?? 0))
    .map((asset) => {
      const text = String(asset?.extracted_text || asset?.extractedText || asset?.analysis?.visible_text || '').trim();
      if (!text) return '';
      const id = String(asset?.id || 'unknown');
      const kind = String(asset?.asset_kind || asset?.assetKind || 'source');
      const timestamp = formatTimestamp(asset?.captured_at_ms ?? asset?.capturedAtMs ?? 0);
      const label = String(asset?.accessible_label || asset?.accessibleLabel || kind).trim();
      return `[asset:${id} | ${timestamp} | ${kind} | ${label}]\n${text}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

export function buildMissingAudioGapSignals({ manifestChunkCount = 0, chunks = [], chunkDurationMs = 5000 } = {}) {
  const present = new Set((chunks || []).map((chunk) => Number(chunk?.sequence)).filter(Number.isInteger));
  const missing = [];
  for (let sequence = 0; sequence < Math.max(0, Number(manifestChunkCount) || 0); sequence += 1) {
    if (!present.has(sequence)) missing.push(sequence);
  }
  const groups = [];
  for (const sequence of missing) {
    const last = groups.at(-1);
    if (last && last.lastSequence + 1 === sequence) last.lastSequence = sequence;
    else groups.push({ firstSequence: sequence, lastSequence: sequence });
  }
  return groups.map((gap) => ({
    signalKind: 'audio_gap',
    title: 'Audio gap needs review',
    body: `Audio was unavailable from ${formatTimestamp(gap.firstSequence * chunkDurationMs)} to ${formatTimestamp((gap.lastSequence + 1) * chunkDurationMs)}. Notes do not fill this gap with invented content.`,
    severity: 'warning',
    evidenceRefs: [],
    payload: {
      ...gap,
      startedAtMs: gap.firstSequence * chunkDurationMs,
      endedAtMs: (gap.lastSequence + 1) * chunkDurationMs,
    },
  }));
}

const canonicalSnapshot = ({ segments = [], jots = '', marks = [], assets = [] } = {}) => ({
  segments: sortSegments(segments).map((segment, index) => ({
    id: segmentId(segment, index),
    startMs: Number(segment.started_at_ms ?? segment.startMs ?? 0),
    endMs: Number(segment.ended_at_ms ?? segment.endMs ?? 0),
    speaker: segment.speaker_role ?? segment.speakerRole ?? segment.speaker_key ?? segment.speaker ?? null,
    text: segmentText(segment),
    revision: Number(segment.revision || 1),
  })),
  jots: String(jots || ''),
  marks: [...marks].map((mark) => ({
    id: String(mark.id || ''),
    atMs: Number(mark.marked_at_ms ?? mark.markedAtMs ?? 0),
    label: String(mark.label || ''),
  })).sort((left, right) => left.atMs - right.atMs || left.id.localeCompare(right.id)),
  assets: [...assets].map((asset) => ({
    id: String(asset.id || ''),
    kind: String(asset.asset_kind || asset.assetKind || ''),
    atMs: Number(asset.captured_at_ms ?? asset.capturedAtMs ?? 0),
    path: String(asset.storage_path || asset.storagePath || ''),
    text: String(asset.extracted_text || asset.extractedText || ''),
    analysis: asset.analysis || {},
  })).sort((left, right) => left.atMs - right.atMs || left.id.localeCompare(right.id)),
});

export async function buildSourceSnapshotHash(source) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalSnapshot(source)));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const SIGNAL_PATTERNS = [
  {
    signalKind: 'exam_cue',
    title: 'Explicit exam cue',
    severity: 'review',
    pattern: /\b(on (?:the )?(?:exam|test|quiz)|will be tested|test question|exam question|know this for)\b/i,
  },
  {
    signalKind: 'deadline_candidate',
    title: 'Assignment or deadline mentioned',
    severity: 'review',
    pattern: /\b(homework|assignment|problem set|paper|project)\b.{0,80}\b(due|submit|by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
  },
];

export function extractExplicitStudySignals(segments = []) {
  const signals = [];
  for (const [index, segment] of sortSegments(segments).entries()) {
    const text = segmentText(segment);
    if (!text) continue;
    for (const definition of SIGNAL_PATTERNS) {
      if (!definition.pattern.test(text)) continue;
      signals.push({
        signalKind: definition.signalKind,
        title: definition.title,
        body: text,
        severity: definition.severity,
        evidenceRefs: [segmentId(segment, index)],
        payload: {
          startedAtMs: Number(segment.started_at_ms ?? segment.startMs ?? 0),
          explicit: true,
        },
      });
    }
    const confidence = Number(segment?.confidence);
    if (Number.isFinite(confidence) && confidence < 0.65) {
      signals.push({
        signalKind: 'uncertainty',
        title: 'Low-confidence transcript',
        body: text,
        severity: 'review',
        evidenceRefs: [segmentId(segment, index)],
        payload: { confidence, startedAtMs: Number(segment.started_at_ms ?? segment.startMs ?? 0) },
      });
    }
  }
  return signals;
}

export function resolveClassroomNoteMethod({ subject = '', sessionKind = 'lecture' } = {}) {
  const normalized = String(subject || '').toLowerCase();
  if (sessionKind === 'lab' || /chem|biology|physics|engineering|nursing/.test(normalized) && /lab/.test(normalized)) {
    return 'procedural';
  }
  if (sessionKind === 'problem_solving' || /math|calculus|algebra|statistics|physics|accounting|econom/.test(normalized)) {
    return 'worked_examples';
  }
  if (sessionKind === 'seminar' || sessionKind === 'critique' || /literature|history|philosophy|politic|sociology|art/.test(normalized)) {
    return 'discussion';
  }
  if (/spanish|french|german|italian|mandarin|japanese|arabic|language/.test(normalized)) {
    return 'language';
  }
  return 'outline';
}

export function buildGroundedClassroomInstruction({
  method = 'outline',
  evidenceTranscript = '',
  assetEvidence = '',
  userJots = '',
} = {}) {
  return `Classroom note method: ${method}.
Use only the evidence transcript, readable class assets, and the student's jots. Do not add outside facts, inferred definitions, or invented examples.
Preserve every student jot. If a jot conflicts with the transcript, keep it and add the transcript-supported alternative with a clearly labeled source-conflict review cue.
Keep a stable frame (title, topic sections, review cues) while adapting the body to the subject. Cite evidence ids internally while drafting; do not print raw evidence ids in the finished prose unless needed for a study signal.

Student jots:
${userJots || 'None'}

Timestamped evidence transcript:
${evidenceTranscript}

Timestamped readable class assets:
${assetEvidence || 'None'}`;
}
