-- Migration v49: Group message policies and per-user history clear
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

-- ─── 4. Per-user group history clear table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS group_message_clears (
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  cleared_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);

ALTER TABLE group_message_clears ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY gmc_select ON group_message_clears
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY gmc_upsert ON group_message_clears
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY gmc_update ON group_message_clears
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
