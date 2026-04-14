-- Migration v45: Groups and Group Members
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ─── 1. Create groups table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  category    text NOT NULL DEFAULT 'Outros',
  access      text NOT NULL DEFAULT 'aberto' CHECK (access IN ('aberto', 'fechado', 'restrito')),
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── 2. Create group_members table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_members (
  group_id   uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- ─── 3. Enable RLS ────────────────────────────────────────────────────────────
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- ─── 4. RLS Policies for groups ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY groups_select ON groups FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY groups_insert ON groups FOR INSERT WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY groups_update ON groups FOR UPDATE USING (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY groups_delete ON groups FOR DELETE USING (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 5. RLS Policies for group_members ───────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY group_members_select ON group_members FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY group_members_insert ON group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY group_members_delete ON group_members FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM groups WHERE id = group_id AND owner_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 6. Auto-join owner as admin when creating a group ───────────────────────
CREATE OR REPLACE FUNCTION add_group_owner_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_owner_auto_member ON groups;
CREATE TRIGGER group_owner_auto_member
  AFTER INSERT ON groups
  FOR EACH ROW EXECUTE FUNCTION add_group_owner_as_member();

-- ─── 7. Helper: member count per group ────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_group_member_count(p_group_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COUNT(*) FROM group_members WHERE group_id = p_group_id;
$$;
