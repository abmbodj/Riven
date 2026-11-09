-- Each helper uses schema-qualified application objects. An empty search path
-- retains PostgreSQL built-ins and prevents caller-controlled name resolution.
ALTER FUNCTION public.get_app_user_id() SET search_path = '';
ALTER FUNCTION public.user_internal_id() SET search_path = '';
ALTER FUNCTION public.owns_deck(integer) SET search_path = '';
ALTER FUNCTION public.can_read_deck(integer) SET search_path = '';
ALTER FUNCTION public.owns_guide(uuid) SET search_path = '';
ALTER FUNCTION public.can_read_guide(uuid) SET search_path = '';
ALTER FUNCTION public.is_group_member(uuid) SET search_path = '';
ALTER FUNCTION public.is_group_admin(uuid) SET search_path = '';
ALTER FUNCTION public.is_group_creator(uuid) SET search_path = '';
ALTER FUNCTION public.is_group_member_for_storage(text) SET search_path = '';
ALTER FUNCTION public.dm_partner_allowed(integer) SET search_path = '';
