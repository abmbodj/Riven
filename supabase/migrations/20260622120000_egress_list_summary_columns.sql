-- Egress remediation — Phase B (list summary columns)
--
-- Context: PostgREST reads were ~99% of a free-tier egress overage. Phase A (client)
-- caches reads and projects away heavy JSONB. This migration lets the GUIDES and EXAMS
-- *list* reads stop selecting the heavy blobs (study_guides.guide_data/content,
-- mock_exams.questions) while keeping today's list badges, by denormalizing the small
-- derived values the lists render:
--   • mock_exams.question_count / short_answer_count  (exam list badges)
--   • study_guides.list_meta                          (guide list progress/mastery/effort)
--
-- DEPLOY: ship WITH the matching client changes (the getMockExams / getStudyGuides
-- projection in authApi.js, and the writers that populate study_guides.list_meta).
-- It is safe to `db push` this before that client deploy: the new columns are additive
-- and default sensibly. Do NOT deploy the client projection BEFORE this migration is
-- applied, or the lists would read columns that don't exist yet.
-- NOTE: while the project is egress-restricted, `db push` may be blocked until the
-- billing-period reset; this file is prepared so it can be applied the moment it isn't.

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

-- ========== STUDY GUIDES: compact list summary ==========

-- Holds exactly what GuidesLibrary renders per card (progress {totalSections,
-- completedCount, completionPercent, nextSectionId}, plus mastery/effort snapshot
-- inputs) so the guides list never has to fetch guide_data/content. Populated by the
-- generate-guide path and updateStudyGuide whenever guide_data/study_state change; a
-- one-time backfill recomputes it for existing guides. Inherits the table's RLS.
ALTER TABLE public.study_guides
  ADD COLUMN IF NOT EXISTS list_meta jsonb NOT NULL DEFAULT '{}'::jsonb;
