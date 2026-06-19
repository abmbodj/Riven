-- Grant authenticated users execute permission on list_group_messages.
-- The function was created in 20260601 and rewritten in 20260602, but neither
-- migration included an explicit GRANT EXECUTE. Without it the supabase.rpc()
-- call from the client returns a permission-denied error, which GroupChatPanel
-- surfaces as "Failed to load messages".
GRANT EXECUTE ON FUNCTION public.list_group_messages(uuid, uuid, int) TO authenticated;
