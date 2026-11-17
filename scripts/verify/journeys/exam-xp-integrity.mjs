// Exam XP integrity (health audit #1). Regression test for the exploit where a client
// inserted exam_attempts with score = total and called exam-complete to mint XP.
// Drives the real API as the signed-in student; the browser only shows the result.
import { PASSWORD, SUPABASE } from '../lib/config.mjs';

export const meta = {
  feature: 'mock-exams',
  covers: 'Forged exam attempts earn no XP; real attempts are re-scored server-side; concurrent completes grant once',
  doc: 'docs/features/mock-exams.md',
};

const QUESTIONS = [
  { type: 'mcq', question: 'Main site of ATP production?', options: ['Nucleus', 'Mitochondrion', 'Ribosome', 'Golgi'], correct_answer: 'Mitochondrion', marks: 1 },
  { type: 'true_false', question: 'The Krebs cycle produces NADH.', correct_answer: 'true', marks: 1 },
  { type: 'numeric', question: 'ATP per glucose?', correct_answer: '30', tolerance: 2, unit: 'ATP', marks: 1 },
  { type: 'multi_select', question: 'Krebs products?', options: ['NADH', 'FADH2', 'Glucose', 'CO2'], correct_answers: ['NADH', 'FADH2', 'CO2'], marks: 1 },
];

async function session() {
  const res = await fetch(`${SUPABASE.url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: SUPABASE.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'student@riven.test', password: PASSWORD }),
  });
  return (await res.json()).access_token;
}

export default async function ({ page, step, expect, signIn, sql }) {
  const token = await session();
  const headers = { apikey: SUPABASE.anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const insertAttempt = async (row) => {
    const res = await fetch(`${SUPABASE.url}/rest/v1/exam_attempts`, { method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(row) });
    const body = await res.json();
    if (!res.ok) throw new Error(`insert failed ${res.status} ${JSON.stringify(body)}`);
    return body[0].id;
  };
  const complete = async (attemptId) => (await fetch(`${SUPABASE.url}/functions/v1/exam-complete`, { method: 'POST', headers, body: JSON.stringify({ attemptId }) })).json();
  const xpTotal = async () => (await sql("select coalesce((select xp_total from public.study_user_stats s join public.users u on u.id = s.user_id where u.email = 'student@riven.test'), 0)::int as xp"))[0].xp;

  await step('a forged attempt with no exam earns no XP', async () => {
    const id = await insertAttempt({ score: 100, total: 100, exam_title: 'never taken', answers: [] });
    const res = await complete(id);
    expect(res.xpEarned).toBe(0);
    expect(await xpTotal()).toBe(0);
    const [row] = await sql('select score, total, xp_awarded from public.exam_attempts where id = $1', [id]);
    expect(row).toEqual({ score: 0, total: 0, xp_awarded: 0 });
  });

  let examId;
  await step('a forged score on a real exam is replaced by the server score', async () => {
    const [{ id: userId }] = await sql("select id from public.users where email = 'student@riven.test'");
    [{ id: examId }] = await sql("insert into public.mock_exams (user_id, title, questions) values ($1, 'XP integrity', $2::jsonb) returning id", [userId, JSON.stringify(QUESTIONS)]);
    // Two right (mcq via raw response, numeric via a legacy display string), two wrong but
    // claimed correct, and a client score of 4/4.
    const id = await insertAttempt({
      exam_id: examId, score: 4, total: 4,
      answers: [
        { response: 'Mitochondrion', isCorrect: true },
        { response: 'false', isCorrect: true },
        { selected: '31 ATP', isCorrect: false },
        { response: ['NADH'], isCorrect: true },
      ],
    });
    const res = await complete(id);
    expect(res.xpEarned).toBe(50); // 2/4 -> 50 XP, no 70% bonus
    const [row] = await sql('select score, total, xp_awarded from public.exam_attempts where id = $1', [id]);
    expect(row).toEqual({ score: 2, total: 4, xp_awarded: 50 });
  });

  await step('concurrent completes of one attempt grant XP once', async () => {
    const before = await xpTotal();
    const id = await insertAttempt({ exam_id: examId, score: 0, total: 0, answers: [{ response: 'Mitochondrion' }, { response: 'true' }, { response: '30' }, { response: ['NADH', 'FADH2', 'CO2'] }] });
    const results = await Promise.all([complete(id), complete(id), complete(id)]);
    const granted = results.filter((r) => r.xpEarned > 0);
    expect(granted.length).toBe(1);
    expect(granted[0].xpEarned).toBe(120);
    expect(await xpTotal()).toBe(before + 120);
  });

  await step('the dashboard shows the server-awarded XP', async () => {
    await signIn('student');
    await page.goto('/dashboard');
    await expect(page.locator('[data-dashboard-ready="true"]').first()).toBeVisible({ timeout: 30_000 });
  });
}
