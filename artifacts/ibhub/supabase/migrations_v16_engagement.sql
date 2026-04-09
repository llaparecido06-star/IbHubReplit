-- ─────────────────────────────────────────────────────────────────────────────
-- v16 · Engagement features: profile views, referral codes
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Profile views (one row per viewer+profile+day → unique)
CREATE TABLE IF NOT EXISTS profile_views (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  viewer_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at  date NOT NULL DEFAULT CURRENT_DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS profile_views_unique_daily
  ON profile_views(viewer_id, profile_id, viewed_at);

CREATE INDEX IF NOT EXISTS profile_views_profile_week_idx
  ON profile_views(profile_id, viewed_at);

ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert views" ON profile_views;
CREATE POLICY "Anyone can insert views" ON profile_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "Profile owners can see their views" ON profile_views;
CREATE POLICY "Profile owners can see their views" ON profile_views
  FOR SELECT USING (auth.uid() = profile_id);

-- 2. Referral code on profiles (unique, nullable)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_unique
  ON profiles(referral_code) WHERE referral_code IS NOT NULL;
