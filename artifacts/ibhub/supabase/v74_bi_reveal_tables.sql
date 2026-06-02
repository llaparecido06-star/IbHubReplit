-- v74: create bi_reveal_credits and bi_reveal_log tables for the retail-price reveal system
-- Also ensures wine_price_list has all required columns (safe add if not exists)

-- ── wine_price_list: guarantee all columns expected by the reveal endpoint ───
ALTER TABLE public.wine_price_list
  ADD COLUMN IF NOT EXISTS distribuidor    text,
  ADD COLUMN IF NOT EXISTS pais_de_origem  text,
  ADD COLUMN IF NOT EXISTS preco_medio     text,
  ADD COLUMN IF NOT EXISTS fonte           text;

-- ── bi_reveal_credits ────────────────────────────────────────────────────────
-- Tracks how many "reveal" credits each user has for the current billing period.
CREATE TABLE IF NOT EXISTS public.bi_reveal_credits (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_remaining  integer     NOT NULL DEFAULT 0,
  credits_total      integer     NOT NULL DEFAULT 0,
  period_start       date        NOT NULL,
  updated_at         timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.bi_reveal_credits ENABLE ROW LEVEL SECURITY;

-- Users can only read their own row; writes are always service-role only.
CREATE POLICY "bi_reveal_credits_read_own" ON public.bi_reveal_credits
  FOR SELECT USING (auth.uid() = user_id);

-- ── bi_reveal_log ─────────────────────────────────────────────────────────────
-- Records which records each user has already revealed (so repeat reveals are free).
CREATE TABLE IF NOT EXISTS public.bi_reveal_log (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_type  text        NOT NULL, -- e.g. 'retail_price', 'exportador', 'importador'
  record_key   text        NOT NULL, -- UUID or name depending on record_type
  revealed_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bi_reveal_log_user_type_key_idx
  ON public.bi_reveal_log (user_id, record_type, record_key);

ALTER TABLE public.bi_reveal_log ENABLE ROW LEVEL SECURITY;

-- Users can only read their own log entries.
CREATE POLICY "bi_reveal_log_read_own" ON public.bi_reveal_log
  FOR SELECT USING (auth.uid() = user_id);
