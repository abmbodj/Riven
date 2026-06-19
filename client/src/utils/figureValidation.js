/**
 * Tolerant parsers/validators for AI-emitted figure specs (Mermaid, plots, charts).
 *
 * The AI (Llama 4 Scout) occasionally emits malformed specs. These helpers repair
 * common mistakes and reject hopeless input *before* the heavy render libs mount,
 * so a single bad figure degrades to a raw-code fallback instead of blanking the
 * session. Each returns `{ ok, value, raw }`.
 */

const SMART_QUOTES = /[‘’‚‛]/g; // ' ' ‚ ‛
const SMART_DQUOTES = /[“”„‟]/g; // " " „ ‟

const stripFences = (raw) => String(raw ?? '')
  .replace(/^```[\w-]*\n?/, '')
  .replace(/\n?```$/, '')
  .trim();

/**
 * Cleans up a Mermaid source string. We don't fully parse here (that needs the
 * mermaid lib, which the block does async); we just repair common Scout errors so
 * `mermaid.parse` is more likely to succeed.
 */
export const validateMermaid = (raw) => {
  const cleaned = stripFences(raw)
    .replace(SMART_QUOTES, "'")
    .replace(SMART_DQUOTES, '"');

  if (!cleaned) return { ok: false, value: '', raw };

  // Must start with a recognized diagram header to be worth mounting mermaid.
  const header = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart)\b/;
  if (!header.test(cleaned)) {
    return { ok: false, value: cleaned, raw };
  }
  return { ok: true, value: cleaned, raw };
};

const toFiniteNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Parses a plot spec for function-plot. Accepts JSON
 * (`{"fn":"x^2","domain":[-5,5]}` or `{"data":[{"fn":"x^2"}]}`) or a tiny DSL
 * (`fn=x^2; domain=-5,5`). Returns a normalized `{ data, domain }`.
 */
export const parsePlotSpec = (raw) => {
  const text = stripFences(raw);
  if (!text) return { ok: false, value: null, raw };

  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Fall back to DSL: key=value pairs separated by ; or newlines.
    const dsl = {};
    for (const part of text.split(/[;\n]+/)) {
      const [k, ...rest] = part.split('=');
      if (k && rest.length) dsl[k.trim()] = rest.join('=').trim();
    }
    if (dsl.fn) {
      parsed = { fn: dsl.fn };
      if (dsl.domain) parsed.domain = dsl.domain.split(',').map((v) => v.trim());
    }
  }

  if (!parsed || typeof parsed !== 'object') return { ok: false, value: null, raw };

  // Normalize to function-plot's `data` array shape.
  let data = [];
  if (Array.isArray(parsed.data)) {
    data = parsed.data;
  } else if (parsed.fn || parsed.points) {
    data = [parsed];
  }
  data = data
    .map((d) => {
      if (!d || typeof d !== 'object') return null;
      if (typeof d.fn === 'string' && d.fn.trim()) return { ...d, fn: d.fn.trim() };
      if (Array.isArray(d.points) && d.points.length) return d;
      return null;
    })
    .filter(Boolean);

  if (!data.length) return { ok: false, value: null, raw };

  let domain;
  const rawDomain = parsed.domain || parsed.xDomain;
  if (Array.isArray(rawDomain) && rawDomain.length === 2) {
    const lo = toFiniteNumber(rawDomain[0], -10);
    const hi = toFiniteNumber(rawDomain[1], 10);
    if (lo < hi) domain = [Math.max(lo, -1e4), Math.min(hi, 1e4)];
  }

  return { ok: true, value: { data, domain, title: typeof parsed.title === 'string' ? parsed.title : undefined }, raw };
};

const CHART_TYPES = new Set(['line', 'bar', 'area', 'scatter']);

/**
 * Parses a data-chart spec for recharts:
 * `{"type":"bar","data":[...],"xKey":"year","series":["gdp"]}`.
 */
export const parseChartSpec = (raw) => {
  const text = stripFences(raw);
  if (!text) return { ok: false, value: null, raw };

  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, value: null, raw };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, value: null, raw };

  const type = CHART_TYPES.has(parsed.type) ? parsed.type : 'line';
  const data = Array.isArray(parsed.data) ? parsed.data.filter((d) => d && typeof d === 'object') : [];
  const xKey = typeof parsed.xKey === 'string' ? parsed.xKey : null;
  let series = Array.isArray(parsed.series) ? parsed.series.filter((s) => typeof s === 'string') : [];

  if (!data.length || !xKey) return { ok: false, value: null, raw };

  // Infer series from the first row when not provided.
  if (!series.length) {
    series = Object.keys(data[0]).filter((k) => k !== xKey && typeof data[0][k] === 'number');
  }
  if (!series.length) return { ok: false, value: null, raw };

  return { ok: true, value: { type, data, xKey, series, title: typeof parsed.title === 'string' ? parsed.title : undefined }, raw };
};
