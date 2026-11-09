-- These helpers are invoked by SECURITY DEFINER meetup functions or triggers.
-- Direct API calls could otherwise send unauthorized notifications.
REVOKE ALL ON FUNCTION public.enqueue_group_meetup_push_dispatch(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_group_meetup_event(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_message_push_dispatch() FROM PUBLIC, anon, authenticated;
