-- Egress remediation — Phase B (list summary columns)
--
-- Context: PostgREST reads were ~99% of a free-tier egress overage. Phase A (client)
-- caches reads and projects away heavy JSONB. This migration lets the EXAMS list read
-- stop selecting the heavy mock_exams.questions blob while keeping today's question
-- count badges, via generated columns.
--
-- ponytail: study_guides.guide_data is NOT trimmed here — its list read is already
-- 60s-cached by Phase A, and correctly deriving a lightweight summary would require
-- either re-implementing client/src/utils/studyGuides.js's normalization in SQL, or a
-- JS-computed field that needs backfilling for every existing guide. Not worth it
-- unless the post-deploy egress chart shows study_guides still meaningful.
--
-- DEPLOY: ship WITH the matching client projection (getMockExams in authApi.js). Safe
-- to `db push` before that client deploy — the new columns are additive.

-- ========== MOCK EXAMS: cheap badge counts ==========

-- Pure helper: count array elements of a given question `type`. IMMUTABLE + touches no
-- tables (only pg_catalog built-ins) so it is safe to use in a STORED generated column
-- and needs no search_path hardening (it is not SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.count_questions_of_type(questions jsonb, q_type text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT count(*)::int
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(questions) = 'array' THEN questions ELSE '[]'::jsonb END
  ) AS elem
  WHERE elem->>'type' = q_type;
$$;

-- Generated + STORED: auto-backfills every existing row on creation and stays correct
-- on every write, with no application code. Lets the exams list select counts instead
-- of the full `questions` array.
ALTER TABLE public.mock_exams
  ADD COLUMN IF NOT EXISTS question_count integer
    GENERATED ALWAYS AS (
      CASE WHEN jsonb_typeof(questions) = 'array' THEN jsonb_array_length(questions) ELSE 0 END
    ) STORED;

ALTER TABLE public.mock_exams
  ADD COLUMN IF NOT EXISTS short_answer_count integer
    GENERATED ALWAYS AS (public.count_questions_of_type(questions, 'short_answer')) STORED;
