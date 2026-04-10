-- Migration v40: Chat media storage RLS + Realtime for messages
-- Run this in your Supabase SQL Editor

-- ─── 1. Allow authenticated users to upload to chat/ prefix in post-images bucket ───

-- Insert policy for authenticated uploads to chat/ folder
INSERT INTO storage.policies (name, bucket_id, operation, definition, check_expression)
VALUES (
  'chat_media_upload',
  'post-images',
  'INSERT',
  'true',
  '(bucket_id = ''post-images''::text) AND (auth.role() = ''authenticated''::text) AND ((storage.foldername(name))[1] = ''chat''::text)'
)
ON CONFLICT (name, bucket_id, operation) DO NOTHING;

-- Select (read) policy for chat media — allow anyone to view chat images
INSERT INTO storage.policies (name, bucket_id, operation, definition, check_expression)
VALUES (
  'chat_media_select',
  'post-images',
  'SELECT',
  '(bucket_id = ''post-images''::text)',
  null
)
ON CONFLICT (name, bucket_id, operation) DO NOTHING;

-- ─── Alternative: use Supabase Dashboard Storage > Policies instead ───
-- If the INSERT above fails (table structure differs by version), go to:
-- Supabase Dashboard → Storage → post-images bucket → Policies
-- Add an INSERT policy with condition:
--   (auth.role() = 'authenticated') AND ((storage.foldername(name))[1] = 'chat')

-- ─── 2. Enable Realtime on messages table ───────────────────────────────────────
-- Realtime must also be enabled in the Supabase Dashboard:
-- Database → Replication → Supabase Realtime → Toggle ON for "messages" table

ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE conversation_participants REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'conversation_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
  END IF;
END $$;
