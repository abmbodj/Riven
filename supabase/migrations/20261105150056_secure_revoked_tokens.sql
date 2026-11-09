-- The legacy token denylist is server-only. Public API roles must never read or mutate it.
ALTER TABLE public.revoked_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.revoked_tokens FROM PUBLIC, anon, authenticated;
