-- v82: ai_credit_usage_log
-- Records every credit consumption event for admin analytics.
-- The credits tables (ai_search_credits, bi_reveal_credits) only track the
-- current balance; this table provides the historical audit trail needed for
-- "credits used per day" dashboards.

CREATE TABLE IF NOT EXISTS public.ai_credit_usage_log (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_type  text        NOT NULL CHECK (credit_type IN ('ai_search', 'bi_reveal')),
  credits_used integer     NOT NULL DEFAULT 1,
  created_at   timestamptz DEFAULT now() NOT NULL
);

-- Fast range queries for daily aggregation
CREATE INDEX IF NOT EXISTS ai_credit_usage_log_created_at_idx
  ON public.ai_credit_usage_log (created_at DESC);

-- Per-user usage lookups
CREATE INDEX IF NOT EXISTS ai_credit_usage_log_user_idx
  ON public.ai_credit_usage_log (user_id, created_at DESC);

ALTER TABLE public.ai_credit_usage_log ENABLE ROW LEVEL SECURITY;

-- Regular users cannot read this table (admin routes use service role).
CREATE POLICY "ai_credit_usage_log_no_access" ON public.ai_credit_usage_log
  FOR ALL USING (false) WITH CHECK (false);
