-- v78: badge definitions (admin-managed badge types)
CREATE TABLE IF NOT EXISTS badge_definitions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key         text NOT NULL UNIQUE,
  icon        text NOT NULL DEFAULT '🏅',
  label       text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_read_badge_defs" ON badge_definitions
  FOR SELECT USING (true);

CREATE POLICY "admins_manage_badge_defs" ON badge_definitions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

INSERT INTO badge_definitions (key, icon, label, description, sort_order) VALUES
  ('representante',       '🎖️', 'Representante',        'Representante oficial da plataforma',  1),
  ('embaixador',          '🌍', 'Embaixador',            'Embaixador da Rede do Vinho',          2),
  ('comunidade',          '👥', 'Comunidade',            'Pilar da comunidade ibhub',            3),
  ('especialista',        '🍷', 'Especialista',          'Especialista reconhecido em vinhos',   4),
  ('produtor_verificado', '✅', 'Produtor Verificado',   'Produtor verificado pela equipe',      5),
  ('sommelier',           '🍾', 'Sommelier Certificado', 'Sommelier com certificação validada',  6),
  ('destaque_editorial',  '⭐', 'Destaque Editorial',    'Destaque selecionado pela curadoria',  7),
  ('parceiro',            '🤝', 'Parceiro',              'Parceiro oficial da plataforma',       8)
ON CONFLICT (key) DO NOTHING;
