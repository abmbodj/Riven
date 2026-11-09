-- These app RPCs require an app user and are not referenced by RLS policies.
-- Preserve service and signed-in access while removing default public access.
DO $migration$
DECLARE
  fn record;
  function_names text[] := ARRAY[
    'accept_friend_request', 'activate_theme', 'block_user', 'cancel_group_meetup',
    'create_group_meetup', 'deactivate_user_push_device', 'get_group_details',
    'get_group_schedule_calendar', 'get_group_session_results', 'join_group_meetup',
    'leave_group_meetup', 'list_blocked_users', 'list_dm_conversations', 'list_friends',
    'list_group_decks', 'list_group_files', 'list_group_folders', 'list_group_members',
    'list_group_messages', 'list_group_sessions', 'list_joined_group_meetups',
    'list_user_groups', 'mark_messages_delivered', 'mark_messages_read',
    'remove_friendship', 'send_friend_request', 'set_group_availability', 'submit_report',
    'toggle_simulate_free_tier', 'unblock_user', 'upsert_user_push_device'
  ];
  matched integer;
  unique_names integer;
BEGIN
  SELECT count(*), count(DISTINCT p.proname) INTO matched, unique_names
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = ANY(function_names);
  IF matched <> cardinality(function_names) OR unique_names <> cardinality(function_names) THEN
    RAISE EXCEPTION 'App RPC list changed; review permission migration';
  END IF;
  FOR fn IN
    SELECT p.oid, p.oid::regprocedure AS signature
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(function_names)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_depend d WHERE d.refobjid = fn.oid AND d.classid = 'pg_policy'::regclass) THEN
      RAISE EXCEPTION 'RPC % is referenced by a policy', fn.signature;
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn.signature);
  END LOOP;
END;
$migration$;
