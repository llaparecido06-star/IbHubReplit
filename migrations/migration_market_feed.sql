-- ============================================================
-- Feed Exclusivo Ideal.BI  (market_posts)
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Tabela de posts de mercado
CREATE TABLE IF NOT EXISTS market_posts (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  image_url     TEXT,
  likes_count   INT  NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de curtidas de posts de mercado
CREATE TABLE IF NOT EXISTS market_post_likes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    UUID NOT NULL REFERENCES market_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- 3. Tabela de comentários de posts de mercado
CREATE TABLE IF NOT EXISTS market_post_comments (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    UUID NOT NULL REFERENCES market_posts(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS (Row Level Security)
ALTER TABLE market_posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_post_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_post_comments ENABLE ROW LEVEL SECURITY;

-- market_posts: qualquer autenticado pode ler; somente admins podem inserir
CREATE POLICY "market_posts_select"
  ON market_posts FOR SELECT
  USING (true);

CREATE POLICY "market_posts_insert"
  ON market_posts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "market_posts_update"
  ON market_posts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "market_posts_delete"
  ON market_posts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- market_post_likes: autenticados podem curtir / remover curtida
CREATE POLICY "market_post_likes_select"
  ON market_post_likes FOR SELECT
  USING (true);

CREATE POLICY "market_post_likes_insert"
  ON market_post_likes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "market_post_likes_delete"
  ON market_post_likes FOR DELETE
  USING (user_id = auth.uid());

-- market_post_comments: autenticados podem ler e comentar
CREATE POLICY "market_post_comments_select"
  ON market_post_comments FOR SELECT
  USING (true);

CREATE POLICY "market_post_comments_insert"
  ON market_post_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND author_id = auth.uid());

-- 5. Índices
CREATE INDEX IF NOT EXISTS market_posts_created_at_idx      ON market_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS market_post_likes_post_id_idx    ON market_post_likes(post_id);
CREATE INDEX IF NOT EXISTS market_post_comments_post_id_idx ON market_post_comments(post_id);
