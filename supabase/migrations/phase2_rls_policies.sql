-- =============================================================
-- Phase 2: RLS Policies + user_id auto-set trigger
-- Tables: classes, assignments, schedule_slots, folders, tags,
--         themes, decks, deck_tags, cards, study_sessions, messages
-- =============================================================
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================

-- ─────────────────────────────────────────────────────
-- 1. Helper function: resolve auth.uid() → integer user_id
-- ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_app_user_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.users WHERE supabase_auth_id = auth.uid()
$$;

-- ─────────────────────────────────────────────────────
-- 2. Trigger function: auto-set user_id on INSERT
--    So the client never has to pass user_id explicitly
-- ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_user_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := public.get_app_user_id();
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────
-- 3. Enable RLS + Create policies + Attach trigger
-- ─────────────────────────────────────────────────────

-- ========== CLASSES ==========

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classes_select ON public.classes;
CREATE POLICY classes_select ON public.classes
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS classes_insert ON public.classes;
CREATE POLICY classes_insert ON public.classes
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS classes_update ON public.classes;
CREATE POLICY classes_update ON public.classes
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS classes_delete ON public.classes;
CREATE POLICY classes_delete ON public.classes
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_classes ON public.classes;
CREATE TRIGGER set_user_id_classes
  BEFORE INSERT ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== ASSIGNMENTS ==========

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignments_select ON public.assignments;
CREATE POLICY assignments_select ON public.assignments
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS assignments_insert ON public.assignments;
CREATE POLICY assignments_insert ON public.assignments
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS assignments_update ON public.assignments;
CREATE POLICY assignments_update ON public.assignments
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS assignments_delete ON public.assignments;
CREATE POLICY assignments_delete ON public.assignments
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_assignments ON public.assignments;
CREATE TRIGGER set_user_id_assignments
  BEFORE INSERT ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== SCHEDULE_SLOTS ==========

ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_slots_select ON public.schedule_slots;
CREATE POLICY schedule_slots_select ON public.schedule_slots
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS schedule_slots_insert ON public.schedule_slots;
CREATE POLICY schedule_slots_insert ON public.schedule_slots
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS schedule_slots_update ON public.schedule_slots;
CREATE POLICY schedule_slots_update ON public.schedule_slots
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS schedule_slots_delete ON public.schedule_slots;
CREATE POLICY schedule_slots_delete ON public.schedule_slots
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_schedule_slots ON public.schedule_slots;
CREATE TRIGGER set_user_id_schedule_slots
  BEFORE INSERT ON public.schedule_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== FOLDERS ==========

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS folders_select ON public.folders;
CREATE POLICY folders_select ON public.folders
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS folders_insert ON public.folders;
CREATE POLICY folders_insert ON public.folders
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS folders_update ON public.folders;
CREATE POLICY folders_update ON public.folders
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS folders_delete ON public.folders;
CREATE POLICY folders_delete ON public.folders
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_folders ON public.folders;
CREATE TRIGGER set_user_id_folders
  BEFORE INSERT ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== TAGS ==========

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tags_select ON public.tags;
CREATE POLICY tags_select ON public.tags
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS tags_insert ON public.tags;
CREATE POLICY tags_insert ON public.tags
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS tags_update ON public.tags;
CREATE POLICY tags_update ON public.tags
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS tags_delete ON public.tags;
CREATE POLICY tags_delete ON public.tags
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_tags ON public.tags;
CREATE TRIGGER set_user_id_tags
  BEFORE INSERT ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== THEMES ==========

ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS themes_select ON public.themes;
CREATE POLICY themes_select ON public.themes
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS themes_insert ON public.themes;
CREATE POLICY themes_insert ON public.themes
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS themes_update ON public.themes;
CREATE POLICY themes_update ON public.themes
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS themes_delete ON public.themes;
CREATE POLICY themes_delete ON public.themes
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_themes ON public.themes;
CREATE TRIGGER set_user_id_themes
  BEFORE INSERT ON public.themes
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== DECK ACCESS HELPERS ==========

CREATE OR REPLACE FUNCTION public.owns_deck(target_deck_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.decks d
    WHERE d.id = target_deck_id
      AND d.user_id = public.get_app_user_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.can_read_deck(target_deck_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.decks d
    WHERE d.id = target_deck_id
      AND (
        d.user_id = public.get_app_user_id()
        OR EXISTS (
          SELECT 1
          FROM public.group_decks gd
          JOIN public.group_members gm ON gm.group_id = gd.group_id
          WHERE gd.deck_id = d.id
            AND gm.user_id = public.get_app_user_id()
        )
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.owns_deck(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_deck(integer) TO authenticated;


-- ========== DECKS ==========

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS decks_select ON public.decks;
CREATE POLICY decks_select ON public.decks
  FOR SELECT USING (
    user_id = public.get_app_user_id()
    OR EXISTS (
      SELECT 1
      FROM public.group_decks gd
      JOIN public.group_members gm ON gm.group_id = gd.group_id
      WHERE gd.deck_id = public.decks.id
        AND gm.user_id = public.get_app_user_id()
    )
  );

DROP POLICY IF EXISTS decks_insert ON public.decks;
CREATE POLICY decks_insert ON public.decks
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS decks_update ON public.decks;
CREATE POLICY decks_update ON public.decks
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS decks_delete ON public.decks;
CREATE POLICY decks_delete ON public.decks
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_decks ON public.decks;
CREATE TRIGGER set_user_id_decks
  BEFORE INSERT ON public.decks
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== DECK_TAGS ==========

ALTER TABLE public.deck_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deck_tags_select ON public.deck_tags;
CREATE POLICY deck_tags_select ON public.deck_tags
  FOR SELECT USING (public.can_read_deck(deck_id));

DROP POLICY IF EXISTS deck_tags_insert ON public.deck_tags;
CREATE POLICY deck_tags_insert ON public.deck_tags
  FOR INSERT WITH CHECK (public.owns_deck(deck_id));

DROP POLICY IF EXISTS deck_tags_delete ON public.deck_tags;
CREATE POLICY deck_tags_delete ON public.deck_tags
  FOR DELETE USING (public.owns_deck(deck_id));


-- ========== CARDS ==========

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cards_select ON public.cards;
CREATE POLICY cards_select ON public.cards
  FOR SELECT USING (public.can_read_deck(deck_id));

DROP POLICY IF EXISTS cards_insert ON public.cards;
CREATE POLICY cards_insert ON public.cards
  FOR INSERT WITH CHECK (public.owns_deck(deck_id));

DROP POLICY IF EXISTS cards_update ON public.cards;
CREATE POLICY cards_update ON public.cards
  FOR UPDATE USING (public.owns_deck(deck_id));

DROP POLICY IF EXISTS cards_delete ON public.cards;
CREATE POLICY cards_delete ON public.cards
  FOR DELETE USING (public.owns_deck(deck_id));


-- ========== STUDY_SESSIONS ==========

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_sessions_select ON public.study_sessions;
CREATE POLICY study_sessions_select ON public.study_sessions
  FOR SELECT USING (public.can_read_deck(deck_id));

DROP POLICY IF EXISTS study_sessions_insert ON public.study_sessions;
CREATE POLICY study_sessions_insert ON public.study_sessions
  FOR INSERT WITH CHECK (public.owns_deck(deck_id));

DROP POLICY IF EXISTS study_sessions_update ON public.study_sessions;
CREATE POLICY study_sessions_update ON public.study_sessions
  FOR UPDATE USING (public.owns_deck(deck_id));

DROP POLICY IF EXISTS study_sessions_delete ON public.study_sessions;
CREATE POLICY study_sessions_delete ON public.study_sessions
  FOR DELETE USING (public.owns_deck(deck_id));


-- ========== MESSAGE HELPERS ==========

CREATE OR REPLACE FUNCTION public.dm_partner_allowed(partner_user_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.get_app_user_id()
      AND COALESCE(u.is_banned, FALSE) = FALSE
  )
  AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = partner_user_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_blocks ub
    WHERE (ub.blocker_id = public.get_app_user_id() AND ub.blocked_id = partner_user_id)
       OR (ub.blocker_id = partner_user_id AND ub.blocked_id = public.get_app_user_id())
  )
$$;

CREATE OR REPLACE FUNCTION public.mark_messages_read(other_user_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.messages
  SET is_read = 1
  WHERE sender_id = other_user_id
    AND receiver_id = public.get_app_user_id()
    AND is_read = 0
    AND public.dm_partner_allowed(other_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dm_partner_allowed(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(integer) TO authenticated;


-- ========== MESSAGES ==========

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages
  FOR SELECT USING (
    (sender_id = public.get_app_user_id() OR receiver_id = public.get_app_user_id())
    AND public.dm_partner_allowed(
      CASE
        WHEN sender_id = public.get_app_user_id() THEN receiver_id
        ELSE sender_id
      END
    )
  );

DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = public.get_app_user_id()
    AND public.dm_partner_allowed(receiver_id)
  );

DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update ON public.messages
  FOR UPDATE USING (sender_id = public.get_app_user_id());

DROP POLICY IF EXISTS messages_delete ON public.messages;
CREATE POLICY messages_delete ON public.messages
  FOR DELETE USING (sender_id = public.get_app_user_id());

ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END;
$$;
