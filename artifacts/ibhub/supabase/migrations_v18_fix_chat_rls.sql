-- Migration v18: Fix infinite recursion in conversation_participants RLS policy
-- The cp_select policy was querying conversation_participants from within itself,
-- causing infinite recursion. Fix: simplify to direct user_id check.
-- Run this in the Supabase SQL Editor.

-- ── 1. Drop the recursive policy ─────────────────────────────────────────────
DROP POLICY IF EXISTS "cp_select" ON public.conversation_participants;

-- ── 2. Replace with a simple, non-recursive policy ───────────────────────────
-- Each user can only see their own participant rows (direct column check, no subquery)
CREATE POLICY "cp_select" ON public.conversation_participants
  FOR SELECT USING (user_id = auth.uid());

-- ── 3. Ensure conversations and messages policies are also clean ──────────────
-- These query conversation_participants, which is now safe (no recursion)

DROP POLICY IF EXISTS "convos_select" ON public.conversations;
CREATE POLICY "convos_select" ON public.conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  );

-- ── Verify ───────────────────────────────────────────────────────────────────
SELECT policyname, tablename, cmd, qual
FROM pg_policies
WHERE tablename IN ('conversations', 'conversation_participants', 'messages')
ORDER BY tablename, policyname;
