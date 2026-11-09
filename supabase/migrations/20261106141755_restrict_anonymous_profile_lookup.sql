-- Profiles and user search are used by signed-in routes; do not expose them to anonymous RPC callers.
REVOKE EXECUTE ON FUNCTION public.get_public_user_profile(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_public_users(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_user_profile(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_public_users(text) TO authenticated;
