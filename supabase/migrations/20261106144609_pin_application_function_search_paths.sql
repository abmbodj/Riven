-- Preserve access to existing application and extension objects while ensuring
-- pg_catalog is searched first and the session's temporary schema last.
-- The signup trigger is intentionally excluded until it can be verified.
DO $migration$
DECLARE
  fn record;
  function_names text[] := ARRAY[
    'accept_friend_request', 'block_user', 'count_questions_of_type',
    'get_group_details', 'get_group_session_results', 'get_public_user_profile',
    'join_group_meetup', 'leave_group_meetup', 'list_blocked_users', 'list_friends',
    'list_group_decks', 'list_group_files', 'list_group_folders', 'list_group_members',
    'list_group_messages', 'list_group_sessions', 'list_joined_group_meetups',
    'list_user_groups', 'remove_friendship', 'search_public_users', 'send_friend_request',
    'set_group_meetup_attendee_defaults', 'set_updated_at', 'set_user_id_on_insert',
    'submit_report', 'toggle_simulate_free_tier', 'unblock_user', 'user_self_update_allowed'
  ];
  matched integer;
  unique_names integer;
BEGIN
  SELECT count(*), count(DISTINCT p.proname) INTO matched, unique_names
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = ANY(function_names);
  IF matched <> cardinality(function_names) OR unique_names <> cardinality(function_names) THEN
    RAISE EXCEPTION 'Application function list changed; review search path migration';
  END IF;
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(function_names)
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public, extensions, pg_temp', fn.signature);
  END LOOP;
END;
$migration$;
