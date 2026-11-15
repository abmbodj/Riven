// Deterministic OpenAI fake for the local verification stack.
//
// Rules match on distinctive phrases of the real prompts in
// supabase/functions/_shared/{aiCore,notePrompts,noteKnowledge,youtubeTranscriptPrep}.*
// and the inline prompts in grade-answer / grade-tutor-answer / tutor-chat. If a prompt
// changes so no rule matches, the call is answered with an error and logged as
// `openai.chat:unrouted` (with a prompt excerpt) in the fake log: add or fix a rule.
// All fixtures stay on one topic (cell energy) so output is recognisable in screenshots.

type ChatBody = { messages?: Array<{ role: string; content: unknown }>; stream?: boolean; model?: string };

const tiptapNote = (title: string) => ({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: title }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Mitochondria convert the energy in glucose into ATP through cellular respiration.' }] },
    {
      type: 'bulletList',
      content: [
        'Glycolysis splits glucose into two pyruvate in the cytoplasm.',
        'The Krebs cycle runs in the mitochondrial matrix and yields NADH and FADH2.',
        'The electron transport chain pumps protons; ATP synthase uses the gradient to make ATP.',
      ].map((text) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })),
    },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Why it matters' }] },
    { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'What to remember: ' }, { type: 'text', text: 'about 30-32 ATP are made per glucose molecule.' }] },
  ],
});

const flashcards = [
  { front: 'What organelle produces most of the cell\'s ATP?', back: 'The mitochondrion.' },
  { front: 'Where does glycolysis occur?', back: 'In the cytoplasm.' },
  { front: 'What does the Krebs cycle produce for the electron transport chain?', back: 'NADH and FADH2.' },
  { front: 'What enzyme uses the proton gradient to make ATP?', back: 'ATP synthase.' },
  { front: 'Roughly how many ATP come from one glucose molecule?', back: 'About 30-32 ATP.' },
];

const examQuestions = [
  { type: 'mcq', question: 'Which organelle is the main site of ATP production?', options: ['Nucleus', 'Mitochondrion', 'Ribosome', 'Golgi apparatus'], correct_answer: 'Mitochondrion', topic: 'Mitochondria', difficulty: 'easy', explanation: 'Oxidative phosphorylation happens in the mitochondria.', marks: 1 },
  { type: 'mcq', question: 'Where does glycolysis take place?', options: ['Cytoplasm', 'Matrix', 'Inner membrane', 'Nucleus'], correct_answer: 'Cytoplasm', topic: 'Glycolysis', difficulty: 'easy', explanation: 'Glycolysis is cytosolic.', marks: 1 },
  { type: 'true_false', question: 'The Krebs cycle produces NADH.', correct_answer: 'true', topic: 'Krebs cycle', difficulty: 'easy', explanation: 'Each turn yields 3 NADH.', marks: 1 },
  { type: 'multi_select', question: 'Select all products of the Krebs cycle.', options: ['NADH', 'FADH2', 'Glucose', 'CO2'], correct_answers: ['NADH', 'FADH2', 'CO2'], topic: 'Krebs cycle', difficulty: 'medium', explanation: 'Glucose is an input to glycolysis, not a Krebs product.', marks: 2 },
  { type: 'numeric', question: 'About how many ATP does one glucose yield in aerobic respiration?', correct_answer: '30', tolerance: 2, unit: 'ATP', topic: 'ATP yield', difficulty: 'medium', explanation: 'Modern estimates are 30-32.', marks: 2 },
  { type: 'short_answer', question: 'Explain how ATP synthase makes ATP.', correct_answer: 'Protons flow down their gradient through ATP synthase, turning its rotor, which drives phosphorylation of ADP to ATP.', grading_rubric: ['proton gradient', 'flow through ATP synthase', 'ADP to ATP'], topic: 'ATP synthase', difficulty: 'hard', explanation: 'Chemiosmosis couples the gradient to ATP synthesis.', marks: 4 },
];

const guideCard = (id: string, concept: string, prompt: string, answer: string, tag: string) => ({
  id, concept_id: concept, phase: 'diagnostic', difficulty: 'medium', card_type: 'short_answer',
  prompt, target_answer: answer, required_idea_tags: [tag], optional_idea_tags: [], misconception_tags: [],
  hints: [{ level: 1, text: `Think about where ${concept.replace(/-/g, ' ')} happens.`, cue: { expression: 'ear_tilt_curious', animation: 'paw_point_hint' } }],
  feedback: { correct: ['Exactly right.'], partial: ['Close, add one more idea.'], incorrect: ['Not quite, try the hint.'], empty: ['Give it a go.'], misconception: [] },
  river: { intro: 'Let us look at this one.', success: 'Nicely done.', struggle: 'We will get there together.' },
  presentation: { pose: 'teach', emphasis_target: tag, reaction_cue: { expression: 'focus_lean_in', animation: 'ear_tilt_curious' } },
  transitions: { on_correct: null, on_partial: 'retry', on_incorrect: 'hint', on_struggle: 'retry' },
  mastery_weight: 1,
});

const guideSkeleton = {
  session_meta: { subject: 'Biology', student_goal: 'Explain how cells make ATP', student_level: 'intermediate', exam_context: { label: 'Midterm', date: '' }, source_mode: 'source', estimated_minutes: 20, lecture_style: 'storybook seminar', preferred_tutor_tone: 'calm, precise, encouraging', river_role: 'friendly lecture cat' },
  lecture: { opening: 'Today we follow a glucose molecule until it becomes ATP.', agenda: ['Glycolysis', 'ATP synthase'], closing: 'You can now trace energy from food to ATP.' },
  river: { name: 'River', species: 'grey cat', style: 'storybook lecture mascot', tone: 'friendly, witty, encouraging teacher', default_expression: 'blink_soft', default_animation: 'tail_sway_idle', cue_map: {}, dialogue_variants: { opening: ['Ready?'], encouragement: ['Keep going.'], recovery: ['Let us retry.'], mastery: ['Brilliant.'] } },
  knowledge_map: { concepts: [
    { id: 'glycolysis', title: 'Glycolysis', summary: 'Glucose is split into pyruvate in the cytoplasm.', depends_on: [], weak_points: ['location'], misconception_tags: [] },
    { id: 'atp-synthase', title: 'ATP synthase', summary: 'A proton gradient drives ATP synthase.', depends_on: ['glycolysis'], weak_points: ['chemiosmosis'], misconception_tags: [] },
  ] },
  cards: [
    guideCard('card-glycolysis', 'glycolysis', 'Where in the cell does glycolysis happen?', 'In the cytoplasm.', 'cytoplasm'),
    guideCard('card-atp-synthase', 'atp-synthase', 'What powers ATP synthase?', 'The flow of protons down their gradient.', 'proton-gradient'),
  ],
  evaluation_rules: { score_bands: { correct: 0.85, partial: 0.4 }, pass_threshold: 0.5, partial_advances: true, empty_patterns: ['idk'], tag_synonyms: { cytoplasm: ['cytosol'], 'proton-gradient': ['protons', 'h+ gradient'] }, misconception_rules: [] },
  adaptation_rules: { max_attempts_before_recovery: 2, max_hints_per_card: 2, performance_bands: {} },
  completion: { title: 'Session complete', mastery_message: 'You can trace glucose to ATP.', confidence_close: 'Great work today.', next_review_message: 'Review again in two days.', river_cue: { expression: 'whisker_pride', animation: 'sparkle_mastery' } },
};

const paragraph = 'Cellular respiration is a chain of reactions that moves energy from glucose into ATP. Each stage hands its products to the next, so the cell can capture energy in small, usable steps instead of one wasteful burst. ';
const teaching = {
  learning_objective: 'Trace how energy from glucose ends up stored in ATP',
  explain: [paragraph.repeat(2), 'Glycolysis starts in the cytoplasm and splits glucose into two pyruvate molecules, netting two ATP and two NADH. It needs no oxygen, which is why it is ancient and universal across living cells. '.repeat(2), 'In the mitochondria, the Krebs cycle strips electrons from pyruvate and loads them onto NADH and FADH2. The electron transport chain uses those electrons to pump protons, and ATP synthase lets them flow back to make ATP. '.repeat(2)].join('\n\n'),
  intuition: 'Think of it like a hydroelectric dam: protons pile up behind the membrane and ATP synthase is the turbine they spin as they flow back through.',
  predicts: [],
  worked_examples: [1, 2].map((n) => ({
    title: `Example ${n}: counting ATP from glucose`,
    problem: `Estimate the ATP made from ${n} glucose molecule${n > 1 ? 's' : ''}.`,
    steps: [
      { step: 'Count ATP from glycolysis and Krebs', detail: 'Each glucose gives about four ATP directly from these stages.' },
      { step: 'Add oxidative phosphorylation', detail: 'NADH and FADH2 drive roughly 26-28 more ATP through ATP synthase.' },
    ],
    result: `About ${30 * n} ATP`,
    takeaway: 'Most ATP comes from the electron transport chain, not glycolysis.',
  })),
  common_mistakes: [
    'Mistake: saying glycolysis happens in the mitochondria; it happens in the cytoplasm.',
    'Mistake: thinking ATP synthase uses electrons directly; it uses the proton gradient.',
  ],
  example: 'A sprinting muscle leans on glycolysis because it is fast, even though it yields little ATP.',
  steps: ['Glycolysis', 'Krebs cycle', 'Electron transport chain'],
  why_it_matters: 'Energy metabolism explains fatigue, diabetes and how many drugs and poisons work.',
  assist_options: [
    { id: 'explain-simply', label: 'Explain simply', text: 'Food is burned slowly so the cell can catch the energy in ATP.', pose: 'encourage' },
    { id: 'show-example', label: 'Show another example', text: 'Cyanide blocks the electron transport chain, so ATP production stops.', pose: 'point' },
  ],
};

const knowledgeLayer = {
  version: 1, content_type: 'conceptual', subject: 'Biology', summary: 'How cells convert glucose into ATP.',
  concepts: [
    { id: 'glycolysis', title: 'Glycolysis', learning_objective: 'Explain where and how glycolysis splits glucose', summary: 'Glycolysis splits glucose into pyruvate in the cytoplasm.', prerequisites: [], related: ['atp-synthase'], difficulty: 'intro', emphasis: 'normal' },
    { id: 'atp-synthase', title: 'ATP synthase', learning_objective: 'Explain how a proton gradient makes ATP', summary: 'Protons flowing through ATP synthase drive ATP production.', prerequisites: ['glycolysis'], related: [], difficulty: 'core', emphasis: 'high', emphasis_reason: 'speaker said it will be on the exam' },
  ],
  key_terms: [{ term: 'ATP', definition: 'The cell\'s energy currency.', concept_id: 'atp-synthase' }],
  formulas: [], action_items: [], emphasis_signals: [],
};

const syllabus = {
  name: 'BIO 101 Cell Biology',
  professor: 'Dr. Ada Lovelace',
  room: 'Science Hall 204',
  times: [{ day: 1, start_time: '09:00', end_time: '10:15' }, { day: 3, start_time: '09:00', end_time: '10:15' }],
  assignments: [
    { title: 'Lab report 1: Microscopy', description: 'Submit on Canvas', due_date: '2026-12-04T23:59:00.000Z', type: 'homework' },
    { title: 'Midterm exam', description: 'Chapters 1-6', due_date: '2026-12-11T15:00:00.000Z', type: 'exam' },
  ],
};

type Rule = { name: string; match: RegExp; reply: (text: string) => string };

// Order matters: the first matching rule wins. More specific phrases first.
const RULES: Rule[] = [
  { name: 'guide.teaching', match: /writing a deep teaching section for ONE card/, reply: () => JSON.stringify(teaching) },
  { name: 'guide.repair', match: /Return ONLY the updated JSON for those cards as an array/, reply: () => JSON.stringify(guideSkeleton.cards) },
  { name: 'guide.skeleton', match: /building the structural skeleton of a River-led AI tutor session/, reply: () => JSON.stringify(guideSkeleton) },
  { name: 'guide.single-pass', match: /creating a River-led AI tutor session/, reply: () => JSON.stringify({ ...guideSkeleton, cards: guideSkeleton.cards.map((c) => ({ ...c, teaching })) }) },
  { name: 'exam.blueprint', match: /capture its STYLE so future practice exams/, reply: () => JSON.stringify({ questionCount: 6, typeMix: { mcq: 2, true_false: 1, multi_select: 1, numeric: 1, short_answer: 1 }, difficultyMix: { easy: 40, medium: 40, hard: 20 }, topics: ['Mitochondria'], tone: 'direct', markScheme: '1 mark per MCQ', durationMinutes: 50, notes: '' }) },
  { name: 'exam.questions', match: /creating a practice exam that mirrors real university exams/, reply: () => JSON.stringify(examQuestions) },
  { name: 'deck.flashcards', match: /creating (spaced-repetition flashcards|a short, welcoming set of spaced-repe)/, reply: () => JSON.stringify(flashcards) },
  { name: 'class.syllabus', match: /extract class information from a syllabus/, reply: () => JSON.stringify(syllabus) },
  { name: 'grade.tutor', match: /You are River, a warm, encouraging tutor grading/, reply: () => JSON.stringify({ outcome: 'correct', score: 0.9, matchedIdeas: ['cytoplasm'], missingIdeas: [], misconceptionId: null, feedback: 'Spot on, glycolysis runs in the cytoplasm.', nudge: null }) },
  { name: 'grade.exam', match: /You are an expert exam grader/, reply: () => JSON.stringify({ score: 80, feedback: 'Good grasp of chemiosmosis.', keyPointsHit: ['proton gradient'], keyPointsMissed: ['ADP to ATP'] }) },
  { name: 'tutor.chat', match: /You are River, a warm, slightly playful study tutor/, reply: () => 'Great question! Glycolysis happens in the cytoplasm, so it does not need mitochondria at all. [Lecture notes]' },
  { name: 'notes.knowledge', match: /"content_type": "one of:/, reply: () => JSON.stringify(knowledgeLayer) },
  { name: 'youtube.chunk-brief', match: /compressing one segment of an educational YouTube transcript|combining condensed transcript briefs|tightening a reusable study brief/, reply: () => 'Cell energy\n- Glycolysis in cytoplasm\n- Krebs cycle in matrix\n- ATP synthase uses proton gradient' },
  { name: 'notes.tiptap', match: /Tiptap JSON/, reply: () => JSON.stringify(tiptapNote('Cellular respiration')) },
];

const textOf = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p) => (p && typeof p === 'object' && 'text' in p ? String((p as { text: unknown }).text) : '')).join('\n');
  return '';
};

const sse = (text: string, model: string) => {
  const enc = new TextEncoder();
  const chunks = text.match(/[\s\S]{1,400}/g) ?? [''];
  const body = new ReadableStream({
    start(controller) {
      for (const piece of chunks) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ id: 'fake', object: 'chat.completion.chunk', model, choices: [{ index: 0, delta: { content: piece }, finish_reason: null }] })}\n\n`));
      }
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ id: 'fake', object: 'chat.completion.chunk', model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: Math.ceil(text.length / 4) } })}\n\n`));
      controller.enqueue(enc.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
};

export function aiChatResponse(body: ChatBody): { response: Response; rule: string } {
  const text = (body.messages ?? []).map((m) => textOf(m.content)).join('\n');
  const rule = RULES.find((r) => r.match.test(text));
  const model = body.model ?? 'fake-model';
  if (!rule) {
    return { rule: 'unrouted', response: new Response(JSON.stringify({ error: { message: 'riven-verify: no AI fixture matches this prompt', type: 'invalid_request_error' } }), { status: 400, headers: { 'content-type': 'application/json' } }) };
  }
  const content = rule.reply(text);
  if (body.stream) return { rule: rule.name, response: sse(content, model) };
  return {
    rule: rule.name,
    response: new Response(JSON.stringify({
      id: 'fake', object: 'chat.completion', model,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 100, completion_tokens: Math.ceil(content.length / 4), total_tokens: 100 + Math.ceil(content.length / 4) },
    }), { headers: { 'content-type': 'application/json' } }),
  };
}

export const FAKE_TRANSCRIPT = 'Today we follow glucose into the cell. Glycolysis happens in the cytoplasm and makes pyruvate. In the mitochondria the Krebs cycle makes NADH and FADH2. The electron transport chain pumps protons and ATP synthase uses that gradient to make ATP. This will be on the exam.';

export function aiTranscription() {
  const words = FAKE_TRANSCRIPT.split(' ');
  return { text: FAKE_TRANSCRIPT, language: 'en', duration: words.length * 0.4, segments: [{ id: 0, start: 0, end: words.length * 0.4, text: FAKE_TRANSCRIPT }] };
}
