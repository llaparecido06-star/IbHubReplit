#!/usr/bin/env node
/**
 * Applies the web_push_subscriptions migration via Supabase service role.
 * Run: node artifacts/api-server/run_web_push_migration.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Check if table already exists
const { error: checkErr } = await supabase
  .from("web_push_subscriptions")
  .select("id")
  .limit(1);

if (!checkErr) {
  console.log("✅ web_push_subscriptions table already exists and is accessible.");
  process.exit(0);
}

console.log("Table not found. Please run this SQL in the Supabase Dashboard SQL Editor:");
console.log("---");
const sql = `
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

ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "web_push_own_select" ON web_push_subscriptions;
CREATE POLICY "web_push_own_select"
  ON web_push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "web_push_own_delete" ON web_push_subscriptions;
CREATE POLICY "web_push_own_delete"
  ON web_push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);
`;
console.log(sql);
console.log("---");
process.exit(1);
