import { SUBJECT_VALUES, inferSubject } from './subjectInference.mjs';

/**
 * Per-subject prompt strategies for AI generation.
 * Each strategy provides notation, card, exam, guide, and formatting hints
 * that are injected into the relevant generation prompts.
 */

const SUBJECT_STRATEGIES = {
  Mathematics: {
    notation: 'Use LaTeX notation throughout. Inline math: $...$. Block equations: $$...$$. Every variable, formula, expression, and equation MUST be in LaTeX — never write them as plain text.',
    cardStyle: 'Front = problem statement or theorem name (with LaTeX). Back = step-by-step solution method with LaTeX equations on each step. Name the technique used (e.g. "Integration by parts", "Quadratic formula"). For theorem cards: front = theorem statement, back = proof sketch or key implications.',
    examTypes: 'Include calculation problems that require worked solutions with LaTeX. MCQ distractors should be common computational errors (sign mistakes, forgotten constants, wrong factoring). All mathematical expressions in questions, options, correct_answer, and explanation MUST use LaTeX ($...$ inline, $$...$$ block).',
    guideStyle: 'Include worked examples with step-by-step LaTeX solutions. Show common mistakes and why they fail. Use theorem→proof→example structure. In hints, guide toward the method without revealing the answer. REQUIRED: every worked example MUST include a "figure" with type "plot" and a function-plot JSON spec (e.g. {"fn":"x^2","domain":[-5,5],"title":"f(x) = x²"}) showing the relevant curve, graph, or geometric relationship. Embed $$...$$ block LaTeX for key equations inside teaching.explain.',
    formatting: 'Bold theorem/definition names. Use $$...$$ for standalone equations. Ordered lists for multi-step procedures.',
  },
  'Computer Science': {
    notation: 'Use fenced code blocks (```language) for all code snippets. Use `inline code` for variable names, function names, class names, types, and CLI commands. Use LaTeX $...$ for complexity expressions like $O(n \\log n)$.',
    cardStyle: 'Front = concept question or "What does this code output?" with a fenced code block. Back = explanation with code example where relevant. For algorithm cards, always include time and space complexity in LaTeX.',
    examTypes: 'Include code analysis questions — show a code snippet in a fenced code block and ask about its output, error, or complexity. For MCQ with code, each option should be a plausible output or behavior. For short_answer, ask for pseudocode, algorithm descriptions, or complexity justification.',
    guideStyle: 'Include code examples for every concept using fenced code blocks (```language). Walk through code line-by-line in teaching steps. Use `inline code` for all technical terms. REQUIRED: every worked example MUST include a "figure": either a fenced code listing (type "code", spec = the code string with language header) OR a Mermaid diagram (type "mermaid", spec = valid mermaid diagram starting with flowchart/sequenceDiagram/classDiagram etc.) for control flow, data structures, or system architecture. Include $O(n)$ complexity in LaTeX.',
    formatting: 'Use `code marks` for technical terms. Fenced code blocks for examples. Bold key concepts. Include complexity analysis where relevant.',
  },
  Biology: {
    notation: 'Use bold for organism names and technical terms. Italicize genus/species names. Use arrows (→) for process flows.',
    cardStyle: 'Structure around processes and systems. Front = "Describe the process of..." or "What is the function of...". Back = step-by-step process description or functional explanation with cause-effect relationships.',
    examTypes: 'Include process-ordering questions, diagram-interpretation questions (describe a process from a description), and comparison questions (compare two systems/structures). Focus on understanding mechanisms, not just memorizing terms.',
    guideStyle: 'Organize around biological systems and processes. Use step-by-step process descriptions. Include classification hierarchies where relevant. Emphasize cause-effect relationships and feedback loops. REQUIRED: every worked example should include a "figure" with type "mermaid" showing the biological process, cycle, or pathway as a Mermaid flowchart or sequence diagram.',
    formatting: 'Bold key terms and organism names. Use ordered lists for sequential processes. Group related concepts by system.',
  },
  Chemistry: {
    notation: 'Use LaTeX for chemical formulas and equations: $H_2O$, $CH_3COOH$. Use $\\rightarrow$ for reactions, $\\rightleftharpoons$ for equilibrium. Subscripts and superscripts must use LaTeX. Use LaTeX for mathematical expressions in calculations.',
    cardStyle: 'Front = reaction or concept question with LaTeX notation. Back = balanced equation with LaTeX, mechanism steps, or property explanation. For reaction cards, include conditions above the arrow.',
    examTypes: 'Include balancing equations, stoichiometry calculations, and mechanism questions. All chemical formulas and equations must use LaTeX. MCQ distractors should be common balancing or calculation errors.',
    guideStyle: 'Include reaction equations in LaTeX. Show electron movement in mechanisms. Use step-by-step for multi-step reactions. Include unit conversions and dimensional analysis for calculations. REQUIRED: every worked example should include a "figure" with type "mermaid" showing the reaction pathway, mechanism, or molecular process as a Mermaid flowchart.',
    formatting: 'Use LaTeX for all chemical formulas and equations. Bold element names on first use. Ordered lists for reaction mechanisms.',
  },
  Physics: {
    notation: 'Use LaTeX for all equations, variables, and units: $F = ma$, $v = \\frac{\\Delta x}{\\Delta t}$. Units should be in LaTeX: $\\text{m/s}^2$. Use $\\vec{F}$ for vectors.',
    cardStyle: 'Front = physical scenario or "derive/calculate" prompt with LaTeX. Back = solution with equations, substitution steps, and final answer with units in LaTeX. Name the principle applied.',
    examTypes: 'Include calculation problems with physical scenarios requiring equation selection and solving. All physics expressions must use LaTeX. MCQ distractors should be common unit errors or wrong equation applications.',
    guideStyle: 'Include derivations with step-by-step LaTeX. Start from fundamental principles and build up. Show dimensional analysis. Include real-world applications of each concept. REQUIRED: every worked example MUST include a "figure" with type "plot" and a function-plot JSON spec showing the relevant physical relationship (e.g. velocity-time graph, force-displacement, wave function). Embed $$...$$ block equations in teaching.explain.',
    formatting: 'Use LaTeX for all equations and units. Bold law/principle names. Ordered lists for derivation steps.',
  },
  History: {
    notation: 'Use bold for dates, names, and event titles. Use chronological ordering by default.',
    cardStyle: 'Front = "What caused/resulted from [event]?" or "What is the significance of [event/figure]?". Back = causal explanation with dates, key figures, and consequences. Emphasize cause→effect→significance, not just facts.',
    examTypes: 'Include source analysis questions, causality chains ("why did X lead to Y?"), comparison across periods, and significance evaluation. Avoid pure recall — test historical thinking and argumentation.',
    guideStyle: 'Organize chronologically with clear periodization. Emphasize causality chains: cause→event→consequence→significance. Include primary source references where relevant. Compare across time periods.',
    formatting: 'Bold dates and proper nouns. Use chronological ordering. Blockquotes for primary source excerpts.',
  },
  Literature: {
    notation: 'Use blockquotes for textual excerpts. Italicize work titles. Bold character names and literary terms on first use.',
    cardStyle: 'Front = analysis question about theme, character, or literary device. Back = supported argument with textual evidence in blockquotes. Avoid simple plot recall.',
    examTypes: 'Include passage analysis, theme comparison, and literary device identification. Provide text excerpts in blockquotes for analysis questions. Test interpretation and argumentation, not plot summary.',
    guideStyle: 'Organize by themes or literary elements, not just plot order. Include textual evidence in blockquotes. Analyze author craft and technique. Compare works when relevant.',
    formatting: 'Blockquotes for text excerpts. Italicize titles. Bold literary terms and character names on first use.',
  },
  Languages: {
    notation: 'Bold new vocabulary. Italicize target-language text. Use parenthetical translations.',
    cardStyle: 'Front = target-language word/phrase. Back = translation + example sentence in target language with translation. For grammar cards: front = rule name, back = rule explanation + examples with correct/incorrect usage.',
    examTypes: 'Include translation exercises, fill-in-the-blank conjugations, sentence construction, and reading comprehension in the target language. Mix vocabulary recall with grammar application.',
    guideStyle: 'Organize by grammatical concept or thematic vocabulary group. Include example sentences with translations. Show conjugation patterns in tables. Practice dialogues where appropriate.',
    formatting: 'Bold vocabulary on first use. Italicize target-language text. Use tables for conjugation patterns.',
  },
  Economics: {
    notation: 'Use LaTeX for supply/demand equations, elasticity formulas, and economic models: $P = MC$, $\\epsilon = \\frac{\\%\\Delta Q}{\\%\\Delta P}$. Use arrows for causal relationships.',
    cardStyle: 'Front = scenario or concept question. Back = economic reasoning with model reference and LaTeX for any formulas. Include real-world examples.',
    examTypes: 'Include graph interpretation, calculation problems with LaTeX, and policy analysis questions. MCQ should test economic reasoning, not just definitions.',
    guideStyle: 'Include economic models with LaTeX equations. Use cause→effect chains for policy analysis. Include real-world case studies. Show graphical reasoning in text descriptions. REQUIRED: every worked example should include a "figure" — use type "chart" with a recharts JSON spec for supply/demand data, growth curves, or statistical relationships, OR type "mermaid" for causal chain diagrams.',
    formatting: 'Use LaTeX for economic formulas. Bold key terms. Ordered lists for causal chains.',
  },
  Psychology: {
    notation: 'Bold researcher names and technical terms. Use parenthetical citations format (Author, Year) for key studies.',
    cardStyle: 'Front = concept or "What did [study] demonstrate?". Back = explanation with study details, methodology, and findings. Connect to broader psychological theories.',
    examTypes: 'Include study analysis, theory comparison, and application-to-scenario questions. Test understanding of methodology and conclusions, not just researcher names.',
    guideStyle: 'Organize by psychological perspective or phenomenon. Include key study summaries. Connect theories to empirical evidence. Include applications and criticisms.',
    formatting: 'Bold researcher names and terms. Parenthetical study references. Group by theoretical perspective.',
  },
  Music: {
    notation: 'Use standard music terminology. Bold technical terms. Reference specific measures/passages by number.',
    cardStyle: 'Front = concept question about theory, notation, or form. Back = explanation with examples referencing specific musical elements (intervals, chords, rhythmic patterns).',
    examTypes: 'Include interval identification, chord analysis, form analysis, and listening/score analysis questions. Test application of theory concepts, not just definitions.',
    guideStyle: 'Organize by musical concept (rhythm, harmony, form, etc.). Include specific musical examples. Build from simple to complex concepts. Include ear training connections.',
    formatting: 'Bold musical terms. Use standard notation abbreviations (e.g., I-IV-V-I for chord progressions).',
  },
  Art: {
    notation: 'Italicize artwork titles. Bold artist names and art movement terms. Include dates for works and periods.',
    cardStyle: 'Front = analysis question about technique, movement, or comparison. Back = supported analysis with specific visual element references. Avoid simple identification.',
    examTypes: 'Include visual analysis, movement comparison, technique identification, and contextual analysis questions. Focus on formal analysis skills and historical context.',
    guideStyle: 'Organize by movement, period, or theme. Include formal analysis of specific works. Connect artistic developments to historical context. Compare across artists and periods.',
    formatting: 'Italicize artwork titles. Bold artist names and movements. Include dates in parentheses.',
  },
  Engineering: {
    notation: 'Use LaTeX for all equations, units, and engineering notation: $\\sigma = \\frac{F}{A}$, $V = IR$. Use proper unit formatting in LaTeX.',
    cardStyle: 'Front = engineering problem or design question with LaTeX. Back = solution with equations, assumptions stated, and final answer with units. Reference relevant standards or principles.',
    examTypes: 'Include design problems, calculation problems with LaTeX, and analysis questions. Focus on applying engineering principles to realistic scenarios. Include unit checking.',
    guideStyle: 'Include worked problems with step-by-step solutions in LaTeX. State assumptions explicitly. Include design considerations and trade-offs. Reference engineering standards.',
    formatting: 'Use LaTeX for all equations and units. Bold principle names. Ordered lists for design procedures.',
  },
  General: {
    notation: '',
    cardStyle: '',
    examTypes: '',
    guideStyle: '',
    formatting: 'Bold key terms first use. Blockquotes for definitions/theorems. Ordered lists for processes. Zero filler.',
  },
};

/**
 * Returns the subject strategy for the given subject.
 * Falls back to General if the subject is unknown.
 */
export const getSubjectStrategy = (subject) =>
  SUBJECT_STRATEGIES[subject] || SUBJECT_STRATEGIES.General;

const SUBJECT_VALUE_SET = new Set(SUBJECT_VALUES);

const normalizeSubject = (subject) => {
  if (!subject || typeof subject !== 'string') return null;
  const trimmed = subject.trim();
  if (!trimmed) return null;
  if (SUBJECT_VALUE_SET.has(trimmed)) return trimmed;
  return SUBJECT_VALUES.find((value) => value.toLowerCase() === trimmed.toLowerCase()) || null;
};

const NOTE_METHODS = {
  worked_examples: {
    label: 'Worked-example notes',
    allowsSummary: false,
    instructions: [
      'Note method: Worked-example notes.',
      '- Use a theorem/formula -> meaning -> when to use -> worked example structure.',
      '- For each major formula, theorem, law, or calculation pattern, include one short worked example with numbered steps.',
      '- Explain every variable, unit, assumption, and final answer in plain language.',
      '- Include a short common mistake or check step when the source material supports it.',
    ],
  },
  process_diagram: {
    label: 'Process and diagram notes',
    allowsSummary: false,
    instructions: [
      'Note method: Process and diagram notes.',
      '- Organize around systems, cycles, mechanisms, and cause-effect chains.',
      '- Include text-first visual sections such as "Process map", "Diagram labels", or "Cycle flow" using arrows like A -> B -> C.',
      '- Use ordered lists for phases, mechanisms, lab steps, and biological or chemical sequences.',
      '- Pair each visual/process structure with a plain-language explanation of why each step matters.',
    ],
  },
  cornell: {
    label: 'Cornell notes',
    allowsSummary: true,
    instructions: [
      'Note method: Cornell notes.',
      '- Use H2 headings for major topics, then include "Cue questions" near each topic with review questions a student can cover and answer later.',
      '- Put the main notes below the cue questions using short paragraphs, definitions, and examples.',
      '- When producing a complete note, end with exactly one H2 heading named "Review Summary" containing 1-2 sentences.',
      '- Keep cue questions specific to the material, not generic prompts.',
    ],
  },
  outline: {
    label: 'Structured outline notes',
    allowsSummary: false,
    instructions: [
      'Note method: Structured outline notes.',
      '- Use a hierarchy of H2 topics, H3 subtopics, and nested bullets only when they show real relationships.',
      '- Keep parent bullets broad and child bullets concrete: definitions, examples, causes, evidence, or steps.',
      '- Convert dense bullet runs into short explanatory paragraphs when a concept needs context.',
    ],
  },
  chronological_causal: {
    label: 'Chronological and causal notes',
    allowsSummary: false,
    instructions: [
      'Note method: Chronological and causal notes.',
      '- Organize by time period, event sequence, or development of ideas.',
      '- For each major event or shift, show cause -> event -> consequence -> significance.',
      '- Bold dates, people, places, and event names on first use, then explain why they matter.',
    ],
  },
  evidence_analysis: {
    label: 'Evidence and analysis notes',
    allowsSummary: false,
    instructions: [
      'Note method: Evidence and analysis notes.',
      '- Organize by theme, argument, work, author, method, or movement rather than simple summary.',
      '- Use blockquotes only for short source excerpts or definitions, followed by interpretation.',
      '- Connect each claim to evidence, technique, context, or visual/detail analysis.',
    ],
  },
  concept_map: {
    label: 'Text-first concept map notes',
    allowsSummary: false,
    instructions: [
      'Note method: Text-first concept map notes.',
      '- Start major sections with a central idea, then branch into related concepts using short labeled bullets.',
      '- Show relationships explicitly with labels such as "causes", "depends on", "contrasts with", or "leads to".',
      '- Add cross-links between branches when two concepts explain each other.',
      '- Keep the concept map readable as normal Tiptap headings, paragraphs, and lists.',
    ],
  },
  procedural_skills: {
    label: 'Procedural / how-to notes',
    allowsSummary: false,
    instructions: [
      'Note method: Procedural / how-to notes.',
      '- Organize around the task being performed: goal, prerequisites/tools, then the steps to do it.',
      '- Use ordered lists for the actual procedure; keep each step a concrete action, not a description.',
      '- Call out best practices and "gotchas"/common mistakes with short cues like "Watch for:" or "Best practice:".',
      '- When a step has a reason or a failure mode, add a one-line plain-language note explaining why.',
    ],
  },
  meeting_discussion: {
    label: 'Meeting / discussion notes',
    allowsSummary: false,
    instructions: [
      'Note method: Meeting / discussion notes.',
      '- Organize by decision or topic, not by chronology. Lead with what was decided.',
      '- Capture decisions, the owner/person responsible, and any open questions or unresolved points.',
      '- Keep discussion context short: the decision and its rationale matter more than the back-and-forth.',
      '- Surface concrete next steps; time-sensitive items belong in the Action items section.',
    ],
  },
  language_learning: {
    label: 'Language-learning notes',
    allowsSummary: false,
    instructions: [
      'Note method: Language-learning notes.',
      '- Group by vocabulary theme or grammar concept rather than transcript order.',
      '- Present vocabulary with the target-language term, its translation, and a short example sentence with translation.',
      '- State each grammar rule plainly, then show a correct example (and a common incorrect form when useful).',
      '- Use tables for conjugation or declension patterns; bold new vocabulary on first use.',
    ],
  },
};

const SUBJECT_NOTE_METHODS = {
  Mathematics: 'worked_examples',
  'Computer Science': 'outline',
  Biology: 'process_diagram',
  Chemistry: 'worked_examples',
  Physics: 'worked_examples',
  History: 'chronological_causal',
  Literature: 'evidence_analysis',
  Languages: 'language_learning',
  Economics: 'worked_examples',
  Psychology: 'concept_map',
  Music: 'outline',
  Art: 'evidence_analysis',
  Engineering: 'worked_examples',
  // Notes are pure study reference; the tutor session owns retrieval/quizzing.
  // Default General notes to a clean outline rather than Cornell cue-question notes.
  General: 'outline',
};

// Structural content types that describe the *shape* of the session regardless of
// academic subject — a recorded meeting or a how-to walkthrough is the same kind of
// material whether it happens in a Biology class or a workplace training. When the
// transcript strongly signals one of these, it overrides the subject-mapped method.
const countMatches = (text, pattern) => (text.match(pattern) || []).length;

const inferStructuralContentMethod = (sourceText) => {
  if (!sourceText || typeof sourceText !== 'string') return null;
  const text = sourceText.slice(0, 6000);

  const meetingSignals = countMatches(
    text,
    /\b(action items?|we decided|we agreed|decision|owner|assigned to|follow[- ]?up|next steps?|deadline|due (by|date)|stakeholders?|agenda|sync|standup|attendees?)\b/gi,
  );
  const proceduralSignals = countMatches(
    text,
    /\b(step \d|first,? you|next,? you|make sure to|best practice|common mistake|gotcha|how to|in order to|click|run the|navigate to|configure|install|set up|workflow|procedure)\b/gi,
  );

  // Require a couple of independent hits so a single stray phrase doesn't reshape the note.
  if (meetingSignals >= 2 && meetingSignals >= proceduralSignals) return 'meeting_discussion';
  if (proceduralSignals >= 2) return 'procedural_skills';
  return null;
};

const inferNoteMethodFromSourceText = (sourceText) => {
  if (!sourceText || typeof sourceText !== 'string') return null;
  const text = sourceText.slice(0, 4000);
  const structural = inferStructuralContentMethod(sourceText);
  if (structural) return structural;
  if (/\b(theorem|formula|equation|solve|derivative|integral|calculate|proof)\b/i.test(text)) {
    return 'worked_examples';
  }
  if (/\b(process|cycle|phase|mechanism|pathway|reaction|diagram|label)\b/i.test(text)) {
    return 'process_diagram';
  }
  if (/\b(timeline|chronology|caused|consequence|significance|revolution|war|period)\b/i.test(text)) {
    return 'chronological_causal';
  }
  if (/\b(vocabulary|conjugat|grammar|pronoun|tense|translation|target language)\b/i.test(text)) {
    return 'language_learning';
  }
  if (/\b(theme|quote|passage|character|author|artist|movement|evidence|analysis)\b/i.test(text)) {
    return 'evidence_analysis';
  }
  if (/\b(relationship|connects|branch|central idea|framework|model)\b/i.test(text)) {
    return 'concept_map';
  }
  return null;
};

const buildPromptInstructions = (method) => {
  const definition = NOTE_METHODS[method] || NOTE_METHODS.cornell;
  return definition.instructions.join('\n');
};

export const resolveNoteStrategy = ({ className, subject, sourceText } = {}) => {
  const resolvedSubject = normalizeSubject(subject) || inferSubject(className) || 'General';
  const mappedMethod = SUBJECT_NOTE_METHODS[resolvedSubject] || SUBJECT_NOTE_METHODS.General;
  // A meeting/how-to recording keeps its structural shape even inside a known subject;
  // otherwise fall back to the subject's method, and use full inference for General.
  const structuralOverride = inferStructuralContentMethod(sourceText);
  const noteMethod = structuralOverride
    || (resolvedSubject === 'General'
      ? (inferNoteMethodFromSourceText(sourceText) || mappedMethod)
      : mappedMethod);
  const definition = NOTE_METHODS[noteMethod] || NOTE_METHODS.cornell;

  return {
    subject: resolvedSubject,
    noteMethod,
    label: definition.label,
    allowsSummary: definition.allowsSummary,
    promptInstructions: buildPromptInstructions(noteMethod),
  };
};
