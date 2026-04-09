-- ═══════════════════════════════════════════════════════════════════════════
-- ibhub — Verificação Completa do Banco
-- Cole e execute no Supabase SQL Editor → "Run All"
-- Resultado: mostra o que existe e o que está faltando
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Tabelas existentes no schema public ────────────────────────────────
select
  tablename as tabela,
  'OK' as status
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles','posts','likes','bookmarks','comments','follows',
    'connections','notifications','stories','story_views',
    'conversations','conversation_participants','messages',
    'certification_requests','reports','plans','comment_likes',
    'wine_cellar','company_pages','company_page_admins',
    'market_overview','opportunities','opportunity_applications',
    'opportunity_saves','events','event_attendees',
    'market_presentations','company_products','company_follows',
    'message_reactions','push_tokens','push_notification_logs',
    'feature_flags','support_messages','bug_reports',
    'story_likes','user_blocks','post_hidden'
  )
order by tablename;

-- ─── 2. Tabelas que NÃO existem (faltando) ────────────────────────────────
select
  unnest(array[
    'profiles','posts','likes','bookmarks','comments','follows',
    'connections','notifications','stories','story_views',
    'conversations','conversation_participants','messages',
    'certification_requests','reports','plans','comment_likes',
    'wine_cellar','company_pages','company_page_admins',
    'market_overview','opportunities','opportunity_applications',
    'opportunity_saves','events','event_attendees',
    'market_presentations','company_products','company_follows',
    'message_reactions','push_tokens','push_notification_logs',
    'feature_flags','support_messages','bug_reports',
    'story_likes','user_blocks','post_hidden'
  ]) as tabela_faltando
except
select tablename from pg_tables where schemaname = 'public';

-- ─── 3. Colunas críticas em profiles ──────────────────────────────────────
select
  column_name as coluna,
  data_type,
  column_default,
  case when is_nullable = 'NO' then 'NOT NULL' else 'nullable' end as nulabilidade
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'profiles'
order by ordinal_position;

-- ─── 4. Coluna likes_count em comments ────────────────────────────────────
select
  case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name   = 'comments'
        and column_name  = 'likes_count'
    )
    then '✓ comments.likes_count existe'
    else '✗ FALTANDO: comments.likes_count — rode migrations_v10.sql'
  end as verificacao_likes_count;

-- ─── 5. Coluna phone em profiles ──────────────────────────────────────────
select
  case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name   = 'profiles'
        and column_name  = 'phone'
    )
    then '✓ profiles.phone existe'
    else '✗ FALTANDO: profiles.phone — rode migrations_v14_register.sql'
  end as verificacao_phone;

-- ─── 6. Triggers existentes ───────────────────────────────────────────────
select
  trigger_name as trigger,
  event_object_table as tabela,
  event_manipulation as evento
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;

-- ─── 7. Storage buckets ───────────────────────────────────────────────────
select
  id as bucket,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
order by id;

-- ─── 8. RLS habilitado por tabela ─────────────────────────────────────────
select
  relname as tabela,
  relrowsecurity as rls_habilitado
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind = 'r'
order by relname;

-- ─── 9. Contagem de políticas RLS por tabela ──────────────────────────────
select
  tablename as tabela,
  count(*) as qtd_politicas
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;

-- ─── 10. Feature flags ────────────────────────────────────────────────────
select key, enabled from public.feature_flags order by key;

-- ─── 11. Planos cadastrados ───────────────────────────────────────────────
select id, name, price_cents, is_active, sort_order
from public.plans
order by sort_order;

-- ─── 12. Dados de market_overview ────────────────────────────────────────
select period, updated_at from public.market_overview order by period;
