-- v68_group_mutes.sql
-- Per-user notification mute preference for group chats.
-- A row = muted (no push for new group messages).
-- No row = notifications on (default).
--
-- Run in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS group_mutes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  group_id    text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id)
);

ALTER TABLE group_mutes ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own mute settings
CREATE POLICY "group_mutes: select own"
  ON group_mutes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "group_mutes: insert own"
  ON group_mutes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "group_mutes: delete own"
  ON group_mutes FOR DELETE
  USING (auth.uid() = user_id);

-- Service role (API server) can read all mutes to filter push recipients
-- (supabaseAdmin bypasses RLS automatically, so no extra policy needed).
