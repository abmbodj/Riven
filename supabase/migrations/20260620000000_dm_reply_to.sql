-- Add reply_to_id to messages table for real quote-reply support.
-- ON DELETE SET NULL: deleting the original message removes the reference
-- but keeps the reply itself. No RLS policy changes needed — existing
-- sender/receiver policies already gate all inserts.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reply_to_id bigint REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON messages (reply_to_id);
