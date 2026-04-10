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
    guideStyle: 'Include worked examples with step-by-step LaTeX solutions. Show common mistakes and why they fail. Use theorem→proof→example structure. In hints, guide toward the method without revealing the answer.',
    formatting: 'Bold theorem/definition names. Use $$...$$ for standalone equations. Ordered lists for multi-step procedures.',
  },
  'Computer Science': {
    notation: 'Use fenced code blocks (```language) for all code snippets. Use `inline code` for variable names, function names, class names, types, and CLI commands. Use LaTeX $...$ for complexity expressions like $O(n \\log n)$.',
    cardStyle: 'Front = concept question or "What does this code output?" with a fenced code block. Back = explanation with code example where relevant. For algorithm cards, always include time and space complexity in LaTeX.',
    examTypes: 'Include code analysis questions — show a code snippet in a fenced code block and ask about its output, error, or complexity. For MCQ with code, each option should be a plausible output or behavior. For short_answer, ask for pseudocode, algorithm descriptions, or complexity justification.',
    guideStyle: 'Include code examples for every concept using fenced code blocks. Walk through code line-by-line in teaching steps. Use `inline code` for all technical terms.',
    formatting: 'Use `code marks` for technical terms. Fenced code blocks for examples. Bold key concepts. Include complexity analysis where relevant.',
  },
  Biology: {
    notation: 'Use bold for organism names and technical terms. Italicize genus/species names. Use arrows (→) for process flows.',
    cardStyle: 'Structure around processes and systems. Front = "Describe the process of..." or "What is the function of...". Back = step-by-step process description or functional explanation with cause-effect relationships.',
    examTypes: 'Include process-ordering questions, diagram-interpretation questions (describe a process from a description), and comparison questions (compare two systems/structures). Focus on understanding mechanisms, not just memorizing terms.',
    guideStyle: 'Organize around biological systems and processes. Use step-by-step process descriptions. Include classification hierarchies where relevant. Emphasize cause-effect relationships and feedback loops.',
    formatting: 'Bold key terms and organism names. Use ordered lists for sequential processes. Group related concepts by system.',
  },
  Chemistry: {
    notation: 'Use LaTeX for chemical formulas and equations: $H_2O$, $CH_3COOH$. Use $\\rightarrow$ for reactions, $\\rightleftharpoons$ for equilibrium. Subscripts and superscripts must use LaTeX. Use LaTeX for mathematical expressions in calculations.',
    cardStyle: 'Front = reaction or concept question with LaTeX notation. Back = balanced equation with LaTeX, mechanism steps, or property explanation. For reaction cards, include conditions above the arrow.',
    examTypes: 'Include balancing equations, stoichiometry calculations, and mechanism questions. All chemical formulas and equations must use LaTeX. MCQ distractors should be common balancing or calculation errors.',
    guideStyle: 'Include reaction equations in LaTeX. Show electron movement in mechanisms. Use step-by-step for multi-step reactions. Include unit conversions and dimensional analysis for calculations.',
    formatting: 'Use LaTeX for all chemical formulas and equations. Bold element names on first use. Ordered lists for reaction mechanisms.',
  },
  Physics: {
    notation: 'Use LaTeX for all equations, variables, and units: $F = ma$, $v = \\frac{\\Delta x}{\\Delta t}$. Units should be in LaTeX: $\\text{m/s}^2$. Use $\\vec{F}$ for vectors.',
    cardStyle: 'Front = physical scenario or "derive/calculate" prompt with LaTeX. Back = solution with equations, substitution steps, and final answer with units in LaTeX. Name the principle applied.',
    examTypes: 'Include calculation problems with physical scenarios requiring equation selection and solving. All physics expressions must use LaTeX. MCQ distractors should be common unit errors or wrong equation applications.',
    guideStyle: 'Include derivations with step-by-step LaTeX. Start from fundamental principles and build up. Show dimensional analysis. Include real-world applications of each concept.',
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
    guideStyle: 'Include economic models with LaTeX equations. Use cause→effect chains for policy analysis. Include real-world case studies. Show graphical reasoning in text descriptions.',
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
