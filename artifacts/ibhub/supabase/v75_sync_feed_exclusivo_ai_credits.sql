-- v75: Sync mercado:feed_exclusivo feature flag and ai_search_credits to existing plans
--
-- Background: the Plan Builder UI now exposes Feed Exclusivo and AI search credits
-- inside the Mercado section.  Existing rows in the `plans` table pre-date these
-- fields and need to be brought up to date without removing any access they
-- already have.
--
-- Strategy:
--   • Use array_append only when the flag is not already present (idempotent).
--   • Overwrite ai_search_credits only when the stored value differs from the
--     canonical tier value, so manually-tuned plans are left alone.

-- ── 1. Add mercado:feed_exclusivo to paid plans ─────────────────────────────
-- Profissional tier
update plans
set features = array_append(features, 'mercado:feed_exclusivo')
where id in ('profissional', 'premium')
  and not (features @> array['mercado:feed_exclusivo']);

-- Executivo / Exclusive tier
update plans
set features = array_append(features, 'mercado:feed_exclusivo')
where id in ('executivo', 'exclusive', 'exclusivo')
  and not (features @> array['mercado:feed_exclusivo']);

-- Empresa / Business tier
update plans
set features = array_append(features, 'mercado:feed_exclusivo')
where id in ('empresas', 'empresa', 'business')
  and not (features @> array['mercado:feed_exclusivo']);

-- ── 2. Ensure ai_search_credits match canonical tier values ─────────────────
-- Free tier → 0
update plans
set ai_search_credits = 0
where id in ('gratuito', 'free')
  and (ai_search_credits is null or ai_search_credits <> 0);

-- Profissional tier → 3
update plans
set ai_search_credits = 3
where id in ('profissional', 'premium')
  and (ai_search_credits is null or ai_search_credits <> 3);

-- Empresa / Business tier → 10
update plans
set ai_search_credits = 10
where id in ('empresas', 'empresa', 'business')
  and (ai_search_credits is null or ai_search_credits <> 10);

-- Executivo / Exclusive tier → 25
update plans
set ai_search_credits = 25
where id in ('executivo', 'exclusive', 'exclusivo')
  and (ai_search_credits is null or ai_search_credits <> 25);
