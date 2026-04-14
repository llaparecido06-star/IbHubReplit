-- Migration: Plan Builder Defaults + Apresentações permission
-- Adds mercado:apresentacoes permission and unlocks all mercado features for paid plans

-- 1. Insert mercado:apresentacoes if not exists
INSERT INTO market_permissions (id, title, description, icon, sort_order, is_active)
VALUES (
  'apresentacoes',
  'Apresentações de Mercado',
  'Acesso a apresentações exclusivas para o plano',
  'monitor',
  6,
  true
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active;

-- 2. Update all paid plans to include all mercado permissions + general features
-- Helper: these plans should unlock all market features

-- PROFISSIONAL plan
UPDATE plans
SET features = (
  SELECT COALESCE(
    jsonb_agg(DISTINCT feat ORDER BY feat),
    '[]'::jsonb
  )
  FROM (
    SELECT unnest(ARRAY[
      'mercado:kpis',
      'mercado:graficos',
      'mercado:tendencias',
      'mercado:regioes',
      'mercado:variedades',
      'mercado:apresentacoes',
      'mercado:idealbi',
      'Chat ilimitado',
      'Ver Visitantes do Perfil',
      'Upload Certificados',
      'Masterclasses'
    ]) AS feat
    UNION
    SELECT unnest(
      CASE WHEN features IS NOT NULL THEN
        ARRAY(SELECT jsonb_array_elements_text(features))
      ELSE ARRAY[]::text[] END
    ) AS feat FROM plans WHERE id = 'profissional'
  ) sub
)
WHERE id = 'profissional';

-- BASICO plan
UPDATE plans
SET features = (
  SELECT COALESCE(
    jsonb_agg(DISTINCT feat ORDER BY feat),
    '[]'::jsonb
  )
  FROM (
    SELECT unnest(ARRAY[
      'mercado:kpis',
      'mercado:graficos',
      'mercado:tendencias',
      'mercado:regioes',
      'mercado:variedades',
      'mercado:apresentacoes',
      'mercado:idealbi',
      'Chat ilimitado',
      'Criar Grupos',
      'Ver Visitantes do Perfil',
      'Smart Match B2B',
      'Upload Certificados',
      'Masterclasses',
      'Impulsionar Posts'
    ]) AS feat
    UNION
    SELECT unnest(
      CASE WHEN features IS NOT NULL THEN
        ARRAY(SELECT jsonb_array_elements_text(features))
      ELSE ARRAY[]::text[] END
    ) AS feat FROM plans WHERE id = 'basico'
  ) sub
)
WHERE id = 'basico';

-- EMPRESA plan
UPDATE plans
SET features = (
  SELECT COALESCE(
    jsonb_agg(DISTINCT feat ORDER BY feat),
    '[]'::jsonb
  )
  FROM (
    SELECT unnest(ARRAY[
      'mercado:kpis',
      'mercado:graficos',
      'mercado:tendencias',
      'mercado:regioes',
      'mercado:variedades',
      'mercado:apresentacoes',
      'mercado:idealbi',
      'Chat ilimitado',
      'Criar Grupos',
      'Ver Visitantes do Perfil',
      'Smart Match B2B',
      'Relatórios Detalhados',
      'Exportar CSV',
      'Criar Página Empresa',
      'Publicar Vagas',
      'Marketplace B2B',
      'Impulsionar Posts',
      'Upload Certificados',
      'Masterclasses'
    ]) AS feat
    UNION
    SELECT unnest(
      CASE WHEN features IS NOT NULL THEN
        ARRAY(SELECT jsonb_array_elements_text(features))
      ELSE ARRAY[]::text[] END
    ) AS feat FROM plans WHERE id = 'empresa'
  ) sub
)
WHERE id = 'empresa';

-- EXECUTIVO plan — all features
UPDATE plans
SET features = (
  SELECT jsonb_agg(DISTINCT feat ORDER BY feat)
  FROM (
    SELECT unnest(ARRAY[
      'mercado:kpis',
      'mercado:graficos',
      'mercado:tendencias',
      'mercado:regioes',
      'mercado:variedades',
      'mercado:apresentacoes',
      'mercado:idealbi',
      'Chat ilimitado',
      'Criar Grupos',
      'Ver Visitantes do Perfil',
      'Smart Match B2B',
      'Relatórios Detalhados',
      'Exportar CSV',
      'Criar Página Empresa',
      'Publicar Vagas',
      'Marketplace B2B',
      'Impulsionar Posts',
      'Upload Certificados',
      'Masterclasses'
    ]) AS feat
  ) sub
)
WHERE id = 'executivo';

