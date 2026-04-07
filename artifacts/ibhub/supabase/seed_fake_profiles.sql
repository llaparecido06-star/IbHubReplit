-- =============================================================
-- Perfis fake para testes de sugestões de conexão
-- Execute no SQL Editor do painel do Supabase:
-- https://supabase.com/dashboard → SQL Editor → New query
-- =============================================================

INSERT INTO profiles (id, user_id, full_name, username, position, company, plan, areas, is_public, created_at, updated_at)
VALUES
  ('fb000001-0000-0000-0000-000000000001', 'fb000001-0000-0000-0000-000000000001',
   'Mariana Torres',    'marianatorres',    'Sommelier WSET Level 4',      'Consultora Independente',      'business',  ARRAY['Sommelier','Harmonização','Espumantes'],  true, NOW(), NOW()),

  ('fb000002-0000-0000-0000-000000000002', 'fb000002-0000-0000-0000-000000000002',
   'Rafael Duarte',     'rafaelduarte',     'Enólogo',                     'Vinícola Miolo',               'gratuito',  ARRAY['Enólogo','Vinificação','Tintos'],          true, NOW(), NOW()),

  ('fb000003-0000-0000-0000-000000000003', 'fb000003-0000-0000-0000-000000000003',
   'Claudia Mendes',    'claudiamendes',    'Fundadora',                   'WineRoute BR',                 'exclusive', ARRAY['Importador','Exportação','Europa','Mercado'], true, NOW(), NOW()),

  ('fb000004-0000-0000-0000-000000000004', 'fb000004-0000-0000-0000-000000000004',
   'Bruno Carvalho',    'brunocarvalho',    'CEO',                         'WineBR Distribuidora',         'premium',   ARRAY['Distribuidor','Logística','Mercado','Vendas'], true, NOW(), NOW()),

  ('fb000005-0000-0000-0000-000000000005', 'fb000005-0000-0000-0000-000000000005',
   'Isabela Fonseca',   'isabelafonseca',   'Professora & Sommelier',      'Escola do Vinho SP',           'business',  ARRAY['Sommelier','Educação','Harmonização','Espumantes'], true, NOW(), NOW()),

  ('fb000006-0000-0000-0000-000000000006', 'fb000006-0000-0000-0000-000000000006',
   'Thiago Nascimento', 'thiagonascimento', 'Produtor & Enoturismo',       'Quinta Santa Clara',           'gratuito',  ARRAY['Produtor','Enoturismo','Tintos','Orgânico'], true, NOW(), NOW()),

  ('fb000007-0000-0000-0000-000000000007', 'fb000007-0000-0000-0000-000000000007',
   'Letícia Ribeiro',   'leticiaribeiro',   'Jornalista de Vinhos',        'Revista Decanter Brasil',      'business',  ARRAY['Jornalismo','Crítica','Degustação','Espumantes'], true, NOW(), NOW()),

  ('fb000008-0000-0000-0000-000000000008', 'fb000008-0000-0000-0000-000000000008',
   'Pedro Alvarenga',   'pedroalvarenga',   'Head of Wine',                'Rede Alma Mater',              'premium',   ARRAY['Sommelier','Restauração','Harmonização'], true, NOW(), NOW()),

  ('fb000009-0000-0000-0000-000000000009', 'fb000009-0000-0000-0000-000000000009',
   'Fernanda Leal',     'fernandaleal',     'Enóloga',                     'Vinhos Naturais & Biodinâmicos','gratuito', ARRAY['Enólogo','Orgânico','Vinhos Naturais','Vinificação'], true, NOW(), NOW()),

  ('fb000010-0000-0000-0000-000000000010', 'fb000010-0000-0000-0000-000000000010',
   'Eduardo Pinheiro',  'eduardopinheiro',  'Gerente de Exportação',       'Vinhos do Alentejo Brasil',    'premium',   ARRAY['Exportação','Mercado','Importador','Europa'], true, NOW(), NOW())

ON CONFLICT (id) DO UPDATE SET
  full_name  = EXCLUDED.full_name,
  username   = EXCLUDED.username,
  position   = EXCLUDED.position,
  company    = EXCLUDED.company,
  plan       = EXCLUDED.plan,
  areas      = EXCLUDED.areas,
  updated_at = NOW();
