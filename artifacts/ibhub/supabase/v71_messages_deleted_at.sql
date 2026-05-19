-- v71: Soft-delete support for individual chat messages
-- When deleted_at is set, the mobile app renders "Esta mensagem foi apagada"
-- instead of the original content.

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Allow the message sender to soft-delete their own messages (set deleted_at).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages'
    AND policyname = 'msg_sender_can_soft_delete'
  ) THEN
    CREATE POLICY "msg_sender_can_soft_delete"
      ON public.messages
      FOR UPDATE
      USING (auth.uid() = sender_id)
      WITH CHECK (auth.uid() = sender_id);
  END IF;
END $$;
