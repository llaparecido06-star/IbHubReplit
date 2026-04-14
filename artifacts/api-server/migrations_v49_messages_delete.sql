-- Migration v49: Message delete policies for group chats
-- Run this in your Supabase SQL Editor AFTER migrations_v45_groups.sql

-- ─── 1. Allow message senders to delete their own messages ────────────────────
DO $$ BEGIN
  CREATE POLICY messages_delete_own ON messages
    FOR DELETE
    USING (auth.uid() = sender_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. Allow group owners to delete all messages in their group conversation ──
DO $$ BEGIN
  CREATE POLICY messages_delete_group_owner ON messages
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM groups
        WHERE groups.id = messages.conversation_id
          AND groups.owner_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. Verify RLS is enabled on messages ─────────────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
