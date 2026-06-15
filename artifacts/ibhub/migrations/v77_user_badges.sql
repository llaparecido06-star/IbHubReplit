-- v77: admin-assigned user badges
CREATE TABLE IF NOT EXISTS user_badges (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_key   text NOT NULL,
  granted_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes       text,
  granted_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, badge_key)
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_badges" ON user_badges
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admins_read_all_badges" ON user_badges
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "admins_insert_badges" ON user_badges
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "admins_delete_badges" ON user_badges
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
