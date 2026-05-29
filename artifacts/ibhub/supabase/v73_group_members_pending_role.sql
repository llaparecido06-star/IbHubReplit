-- v73: Add "pending" to group_members role check constraint
-- The constraint "group_members_role_check" was blocking insert of pending
-- join requests. Drop and recreate it to include the "pending" value.

ALTER TABLE public.group_members
  DROP CONSTRAINT IF EXISTS group_members_role_check;

ALTER TABLE public.group_members
  ADD CONSTRAINT group_members_role_check
  CHECK (role IN ('owner', 'member', 'moderator', 'pending'));
