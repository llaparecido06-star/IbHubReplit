-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration v53 — Fix infinite recursion in conversation_participants RLS
-- ───────────────────────────────────────────────────────────────────────────────
-- Root cause: PostgreSQL 42P17 "infinite recursion detected in policy for
-- relation conversation_participants".
-- This happens when an RLS policy on `messages` or `conversations` queries
-- `conversation_participants`, whose own RLS policies reference back to
-- `conversations` or `messages` — creating an infinite loop.
--
-- Fix: Create a SECURITY DEFINER helper function that bypasses RLS entirely
-- when checking participation. All policies that need to verify membership
-- use this function instead of querying the table directly.
--
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── Step 1: SECURITY DEFINER participation checker ───────────────────────────
-- This function runs as the table owner (bypasses RLS), breaking the recursion.
CREATE OR REPLACE FUNCTION public.is_conversation_participant(
  p_conversation_id uuid,
  p_user_id         uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id
      AND user_id         = p_user_id
  );
$$;


-- ── Step 2: conversation_participants — simple direct-column policies ─────────
-- SELECT: each user sees only their own rows (direct column, zero recursion)
DROP POLICY IF EXISTS "cp_select"         ON public.conversation_participants;
DROP POLICY IF EXISTS "cp_select_own"     ON public.conversation_participants;
DROP POLICY IF EXISTS "cp_insert"         ON public.conversation_participants;
DROP POLICY IF EXISTS "cp_insert_self"    ON public.conversation_participants;
DROP POLICY IF EXISTS "cp_delete"         ON public.conversation_participants;
DROP POLICY IF EXISTS "cp_update"         ON public.conversation_participants;

CREATE POLICY "cp_select" ON public.conversation_participants
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "cp_insert" ON public.conversation_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "cp_delete" ON public.conversation_participants
  FOR DELETE USING (user_id = auth.uid());


-- ── Step 3: conversations — use the security definer function ─────────────────
DROP POLICY IF EXISTS "convos_select"     ON public.conversations;
DROP POLICY IF EXISTS "convos_insert"     ON public.conversations;
DROP POLICY IF EXISTS "convos_update"     ON public.conversations;

CREATE POLICY "convos_select" ON public.conversations
  FOR SELECT USING (public.is_conversation_participant(id, auth.uid()));

CREATE POLICY "convos_insert" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ── Step 4: messages — use the security definer function ─────────────────────
DROP POLICY IF EXISTS "messages_select"       ON public.messages;
DROP POLICY IF EXISTS "messages_insert"       ON public.messages;
DROP POLICY IF EXISTS "messages_update"       ON public.messages;
DROP POLICY IF EXISTS "messages_delete"       ON public.messages;

CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (
    public.is_conversation_participant(conversation_id, auth.uid())
  );

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

-- Sender can soft-edit their own messages (e.g. reactions/metadata)
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE USING (sender_id = auth.uid());

-- Only the sender can delete their own messages
CREATE POLICY "messages_delete" ON public.messages
  FOR DELETE USING (sender_id = auth.uid());


-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('conversations', 'conversation_participants', 'messages')
ORDER BY tablename, policyname;
