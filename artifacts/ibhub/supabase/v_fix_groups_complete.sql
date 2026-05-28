-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Fix groups tables (complete, idempotent, PostgreSQL 14-compatible)
-- ───────────────────────────────────────────────────────────────────────────────
-- Run this in Supabase Dashboard → SQL Editor.
-- Safe to run multiple times (all statements use IF NOT EXISTS / CREATE OR REPLACE).
-- Does NOT require PostgreSQL 15+ NULLS NOT DISTINCT syntax.
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
CREATE POLICY "groups_insert" ON public.groups FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "groups_update" ON public.groups;
CREATE POLICY "groups_update" ON public.groups FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "groups_delete" ON public.groups;
CREATE POLICY "groups_delete" ON public.groups FOR DELETE
  USING (auth.uid() = owner_id);


-- ── 2. group_members ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.group_members (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text        NOT NULL DEFAULT 'member',
  company_page_id uuid        REFERENCES public.company_pages(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Simple unique on (group_id, user_id) — one membership per user per group.
-- Works on PostgreSQL 14+.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_members_group_user_unique'
      AND conrelid = 'public.group_members'::regclass
  ) THEN
    ALTER TABLE public.group_members
      ADD CONSTRAINT group_members_group_user_unique UNIQUE (group_id, user_id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_gm_group_id   ON public.group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_gm_user_id    ON public.group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_gm_company_id ON public.group_members (company_page_id);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gm_select" ON public.group_members;
CREATE POLICY "gm_select" ON public.group_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "gm_insert" ON public.group_members;
CREATE POLICY "gm_insert" ON public.group_members FOR INSERT WITH CHECK (true);

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


-- ── 3. conversation_participants: add company_page_id if missing ───────────────

ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS company_page_id uuid
    REFERENCES public.company_pages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cp_company_page_id
  ON public.conversation_participants (company_page_id);


-- ── 4. Auto-add owner trigger (simple, no ON CONFLICT on 3 columns) ───────────
-- Uses WHERE NOT EXISTS instead of ON CONFLICT so it works on all PG versions.

CREATE OR REPLACE FUNCTION public.auto_add_group_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add owner to group_members (skip if already there)
  INSERT INTO public.group_members (group_id, user_id, role)
  SELECT NEW.id, NEW.owner_id, 'owner'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = NEW.id AND user_id = NEW.owner_id
  );

  -- Add owner to conversation_participants (only if conversation exists)
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  SELECT NEW.id, NEW.owner_id
  WHERE EXISTS (SELECT 1 FROM public.conversations WHERE id = NEW.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = NEW.id AND user_id = NEW.owner_id
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_add_group_owner ON public.groups;
CREATE TRIGGER trg_auto_add_group_owner
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_group_owner();


-- ── 5. Verify ─────────────────────────────────────────────────────────────────
SELECT 'groups table OK'         AS status, count(*) AS rows FROM public.groups
UNION ALL
SELECT 'group_members table OK', count(*) FROM public.group_members;
