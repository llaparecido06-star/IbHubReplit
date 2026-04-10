-- Migration v38: Add status column to event_attendees
-- The event_attendees table was created without a status column.
-- All existing attendance records default to 'confirmed' since cancellation
-- removes the row rather than updating the status.
-- Run in the Supabase SQL Editor.

ALTER TABLE public.event_attendees
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed'
  CHECK (status IN ('confirmed', 'waitlist', 'cancelled'));

-- Backfill any existing rows (all should be confirmed already)
UPDATE public.event_attendees SET status = 'confirmed' WHERE status IS NULL OR status = '';

-- Add unique constraint if not present (needed for upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_attendees'::regclass
      AND contype = 'u'
      AND conname = 'event_attendees_event_id_user_id_key'
  ) THEN
    ALTER TABLE public.event_attendees
      ADD CONSTRAINT event_attendees_event_id_user_id_key
      UNIQUE (event_id, user_id);
  END IF;
END $$;

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'event_attendees'
ORDER BY ordinal_position;
