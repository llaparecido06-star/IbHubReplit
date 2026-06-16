-- Web Push subscriptions table
-- Stores browser PushSubscription objects (endpoint + VAPID keys) per user.
-- One user can have multiple subscriptions (different browsers/devices).

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  keys_p256dh text NOT NULL,
  keys_auth   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS web_push_subscriptions_user_id_idx
  ON web_push_subscriptions(user_id);

-- RLS: only the owner can read/delete their own subscriptions.
-- The server uses service role key to insert/upsert (bypasses RLS).
ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "web_push_own_select" ON web_push_subscriptions;
CREATE POLICY "web_push_own_select"
  ON web_push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "web_push_own_delete" ON web_push_subscriptions;
CREATE POLICY "web_push_own_delete"
  ON web_push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);
