UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'audio/aac')
WHERE id = 'note-audio' AND NOT ('audio/aac' = ANY(allowed_mime_types));

UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'audio/x-m4a')
WHERE id = 'note-audio' AND NOT ('audio/x-m4a' = ANY(allowed_mime_types));

UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'audio/m4a')
WHERE id = 'note-audio' AND NOT ('audio/m4a' = ANY(allowed_mime_types));
