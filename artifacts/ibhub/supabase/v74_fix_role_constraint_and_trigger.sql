-- v74: Fix group_members_role_check and update auto_add_group_owner trigger
--
-- Problem: the production DB has an older version of auto_add_group_owner that
-- inserts with role='admin' (the legacy name for moderator) and a non-null
-- company_page_id. The recent v73 migration re-created the role check constraint
-- WITHOUT 'admin', causing every group creation to fail with:
--   "new row for relation group_members violates check constraint group_members_role_check"
--
-- Fix:
--   1. Add 'admin' back to the constraint (it is used in the codebase as the
--      legacy moderator role and existing rows may have that value).
--   2. Replace the trigger function with the current correct version so the
--      old insert-with-admin path can never fire again.

-- ── 1. Update role check constraint ───────────────────────────────────────────
ALTER TABLE public.group_members
  DROP CONSTRAINT IF EXISTS group_members_role_check;

ALTER TABLE public.group_members
  ADD CONSTRAINT group_members_role_check
  CHECK (role IN ('owner', 'member', 'moderator', 'admin', 'pending'));


-- ── 2. Replace trigger with the correct current version ───────────────────────
-- Owner always joins with role='owner' and company_page_id=NULL (personal
-- identity). Company membership must be added explicitly by the user.
CREATE OR REPLACE FUNCTION public.auto_add_group_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add owner to group_members (personal identity, company_page_id = null)
  INSERT INTO public.group_members (group_id, user_id, role, company_page_id)
  VALUES (NEW.id, NEW.owner_id, 'owner', null)
  ON CONFLICT (group_id, user_id, company_page_id) DO NOTHING;

  -- Add owner to conversation_participants only when the conversation already
  -- exists (guards against FK violation if called in an unexpected order).
  INSERT INTO public.conversation_participants (conversation_id, user_id, company_page_id)
  SELECT NEW.id, NEW.owner_id, null
  WHERE EXISTS (SELECT 1 FROM public.conversations WHERE id = NEW.id)
  ON CONFLICT (conversation_id, user_id, company_page_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Recreate the trigger (DROP IF EXISTS first so it is idempotent)
DROP TRIGGER IF EXISTS trg_auto_add_group_owner ON public.groups;
CREATE TRIGGER trg_auto_add_group_owner
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_group_owner();


-- ── 3. Verify ─────────────────────────────────────────────────────────────────
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.group_members'::regclass
  AND conname = 'group_members_role_check';
