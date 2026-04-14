-- Migration v47: RPC to fetch conversation messages bypassing RLS
-- Run this in the Supabase SQL Editor

-- Function: get_conversation_messages
-- Returns all messages for a conversation the calling user participates in.
-- Uses SECURITY DEFINER to bypass row-level security on the messages table.

CREATE OR REPLACE FUNCTION get_conversation_messages(p_conversation_id uuid)
RETURNS TABLE (
  id              uuid,
  conversation_id uuid,
  sender_id       uuid,
  content         text,
  created_at      timestamptz,
  sender_name     text,
  sender_avatar   text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security check: only participants can read the conversation's messages
  IF NOT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.conversation_id,
    m.sender_id,
    m.content,
    m.created_at,
    p.full_name  AS sender_name,
    p.avatar_url AS sender_avatar
  FROM messages m
  LEFT JOIN profiles p ON p.id = m.sender_id
  WHERE m.conversation_id = p_conversation_id
  ORDER BY m.created_at ASC;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_conversation_messages(uuid) TO authenticated;
