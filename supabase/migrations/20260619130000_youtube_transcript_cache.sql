-- Cross-user cache of fetched YouTube transcripts keyed by (video_id, lang).
-- A popular video imported by many users is fetched once; repeat imports skip
-- all extraction (free strategies and the paid TranscriptAPI fallback).
create table if not exists youtube_transcripts (
  video_id   text not null,
  lang       text not null default 'en',
  transcript text not null,
  source     text,                       -- winning strategy, for telemetry
  fetched_at timestamptz not null default now(),
  primary key (video_id, lang)
);

-- Service-role only: edge functions read/write this shared, non-user-scoped
-- resource. No policies are defined, so RLS denies all direct client access.
alter table youtube_transcripts enable row level security;
