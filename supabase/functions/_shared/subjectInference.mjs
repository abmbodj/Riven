/**
 * Subject inference from class names and a canonical list of subject values.
 * Used server-side (edge functions) and mirrored client-side.
 */

export const SUBJECT_VALUES = [
  'Mathematics',
  'Computer Science',
  'Biology',
  'Chemistry',
  'Physics',
  'History',
  'Literature',
  'Languages',
  'Economics',
  'Psychology',
  'Music',
  'Art',
  'Engineering',
  'General',
];

const PREFIX_MAP = [
  [/^(math|mth|calc|alg|stat|precalc|trig|geom)/i, 'Mathematics'],
  [/^(cs|csc|cis|comp|cpsc|swe|csci)\b/i, 'Computer Science'],
  [/^(bio|biol)\b/i, 'Biology'],
  [/^(chem|chm)\b/i, 'Chemistry'],
  [/^(phys|phy)\b/i, 'Physics'],
  [/^(hist|his)\b/i, 'History'],
  [/^(eng|lit|engl)\b(?!r)/i, 'Literature'],
  [/^(span|fren|germ|chin|jpns|arab|lang|ital|port|kor|russ)\b/i, 'Languages'],
  [/^(econ|ecn)\b/i, 'Economics'],
  [/^(psych|psy)\b/i, 'Psychology'],
  [/^(mus|musc)\b/i, 'Music'],
  [/^(art|arts)\b/i, 'Art'],
  [/^(engr|ece|me|ce|ee|mae|bme)\b/i, 'Engineering'],
];

// First-match-wins: entries are ordered by specificity. Keywords shared across subjects
// (e.g. "thermodynamics") belong only to the most specific match — Physics owns it.
const KEYWORD_MAP = [
  [/calculus|algebra|trigonometry|geometry|precalculus|pre-calc|differential|integral|linear algebra|statistics|probability/i, 'Mathematics'],
  [/computer science|programming|data structures|algorithms|software|machine learning|artificial intelligence|operating systems|databases|web dev/i, 'Computer Science'],
  [/biology|anatomy|physiology|genetics|microbiology|ecology|zoology|botany|molecular|cellular/i, 'Biology'],
  [/chemistry|organic chem|inorganic|biochem|analytical chem/i, 'Chemistry'],
  [/physics|mechanics|electromagnetism|quantum|optics|thermodynamics|relativity/i, 'Physics'],
  [/history|civilization|ancient|medieval|modern history|world war|american history|european/i, 'History'],
  [/literature|english comp|creative writing|poetry|fiction|shakespeare|rhetoric|composition/i, 'Literature'],
  [/spanish|french|german|chinese|japanese|arabic|italian|portuguese|korean|russian|language/i, 'Languages'],
  [/economics|macroeconomics|microeconomics|finance|accounting|business/i, 'Economics'],
  [/psychology|cognitive|behavioral|neuroscience|social psych|developmental/i, 'Psychology'],
  [/music theory|composition|orchestra|band|choir|musicology|ear training/i, 'Music'],
  [/art history|studio art|painting|sculpture|drawing|design|photography|ceramics/i, 'Art'],
  [/engineering|circuits|statics|dynamics|materials science|fluid mechanics/i, 'Engineering'],
];

/**
 * Infer a subject from a class name string.
 * Returns a SUBJECT_VALUES entry or null if no match.
 */
export const inferSubject = (className) => {
  if (!className || typeof className !== 'string') return null;

  const normalized = className.trim().replace(/[^a-zA-Z0-9\s-]/g, '');
  if (!normalized) return null;

  // 1. Try prefix match (e.g. "CS 101", "MATH 251")
  for (const [pattern, subject] of PREFIX_MAP) {
    if (pattern.test(normalized)) return subject;
  }

  // 2. Try keyword match in full name (e.g. "Intro to Data Structures")
  for (const [pattern, subject] of KEYWORD_MAP) {
    if (pattern.test(normalized)) return subject;
  }

  return null;
};
