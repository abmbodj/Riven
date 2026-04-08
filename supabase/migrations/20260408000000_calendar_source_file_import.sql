ALTER TABLE calendar_sources
  ADD COLUMN IF NOT EXISTS import_mode TEXT NOT NULL DEFAULT 'url'
  CHECK (import_mode IN ('url', 'file'));

ALTER TABLE calendar_sources
  ADD COLUMN IF NOT EXISTS file_name TEXT;

UPDATE calendar_sources
SET import_mode = CASE
  WHEN COALESCE(url, '') = '' THEN 'file'
  ELSE 'url'
END
WHERE import_mode IS NULL OR import_mode NOT IN ('url', 'file');
