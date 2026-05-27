-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Create groups and group_members tables
-- ───────────────────────────────────────────────────────────────────────────────
-- Run this in the Supabase Dashboard → SQL Editor if groups feature is broken.
-- Incorporates changes from v54 (trigger/RLS) and v56 (company_page_id) so it
-- is safe to run even if those individual migrations were already applied.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1. groups ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.groups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  category    text        NOT NULL,
  access      text        NOT NULL DEFAULT 'aberto'
                          CHECK (access IN ('aberto', 'fechado', 'restrito')),
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups_select" ON public.groups;
CREATE POLICY "groups_select" ON public.groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "groups_insert" ON public.groups;
CREATE POLICY "groups_insert" ON public.groups FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "groups_update" ON public.groups;
CREATE POLICY "groups_update" ON public.groups FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "groups_delete" ON public.groups;
CREATE POLICY "groups_delete" ON public.groups FOR DELETE
  USING (auth.uid() = owner_id);


-- ── 2. group_members (with company_page_id from v56) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.group_members (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text        NOT NULL DEFAULT 'member',
  company_page_id uuid        REFERENCES public.company_pages(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_members_unique UNIQUE NULLS NOT DISTINCT (group_id, user_id, company_page_id)
);

CREATE INDEX IF NOT EXISTS idx_gm_company_page_id ON public.group_members (company_page_id);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gm_select" ON public.group_members;
CREATE POLICY "gm_select" ON public.group_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "gm_insert" ON public.group_members;
CREATE POLICY "gm_insert" ON public.group_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "gm_delete" ON public.group_members;
CREATE POLICY "gm_delete" ON public.group_members FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "gm_update" ON public.group_members;
CREATE POLICY "gm_update" ON public.group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_members.group_id
        AND gm2.user_id  = auth.uid()
        AND gm2.role     = 'owner'
    )
  );


-- ── 3. conversation_participants: add company_page_id if missing (v56) ─────────

ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS company_page_id uuid
    REFERENCES public.company_pages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cp_company_page_id
  ON public.conversation_participants (company_page_id);

-- Replace the old (conversation_id, user_id) unique/PK constraint with the
-- tri-column version that allows one personal + one company membership per user.
ALTER TABLE public.conversation_participants
  DROP CONSTRAINT IF EXISTS conversation_participants_conversation_id_user_id_key;
ALTER TABLE public.conversation_participants
  DROP CONSTRAINT IF EXISTS conversation_participants_unique;
-- Note: if the original primary key blocks this, drop and re-add it:
-- ALTER TABLE public.conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_pkey;
-- ALTER TABLE public.conversation_participants ADD PRIMARY KEY (id);  -- add surrogate pk first

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversation_participants_unique'
      AND conrelid = 'public.conversation_participants'::regclass
  ) THEN
    ALTER TABLE public.conversation_participants
      ADD CONSTRAINT conversation_participants_unique
      UNIQUE NULLS NOT DISTINCT (conversation_id, user_id, company_page_id);
  END IF;
END$$;


-- ── 4. Auto-add owner trigger (v54/v56 combined) ──────────────────────────────
-- Creates the trigger that fires AFTER INSERT on groups.
-- The API server now creates the conversation BEFORE the group, so the FK
-- on conversation_participants is always satisfied when this trigger runs.

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

  -- Add owner to conversation_participants only when the conversation already exists
  -- (guards against FK violation if called in an unexpected order)
  INSERT INTO public.conversation_participants (conversation_id, user_id, company_page_id)
  SELECT NEW.id, NEW.owner_id, null
  WHERE EXISTS (SELECT 1 FROM public.conversations WHERE id = NEW.id)
  ON CONFLICT (conversation_id, user_id, company_page_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_add_group_owner ON public.groups;
CREATE TRIGGER trg_auto_add_group_owner
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_group_owner();


-- ── 5. Verify ─────────────────────────────────────────────────────────────────
SELECT 'groups table OK' AS status, count(*) AS rows FROM public.groups
UNION ALL
SELECT 'group_members table OK', count(*) FROM public.group_members;
