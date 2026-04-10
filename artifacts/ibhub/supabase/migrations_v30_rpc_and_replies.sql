-- ═══════════════════════════════════════════════════════════════════════════
-- Migration v30: RPC functions + comment replies
-- 1. Drop ALL unique constraints on likes (regardless of name) and recreate
--    partial indexes safely.
-- 2. Create SECURITY DEFINER RPC functions called directly by the app so we
--    never depend on trigger execution order or RLS bypass inside triggers.
-- 3. Add parent_comment_id to comments for threaded replies.
-- Execute no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jbvzjjdecwzomucnmzsn/sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Limpar TODAS as unique constraints da tabela likes ────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'likes'
      AND table_schema = 'public'
      AND constraint_type = 'UNIQUE'
  LOOP
    EXECUTE format('ALTER TABLE public.likes DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
  END LOOP;
END;
$$;

-- Remover indexes parciais antigos (se existirem)
DROP INDEX IF EXISTS public.uq_likes_personal;
DROP INDEX IF EXISTS public.uq_likes_company;
DROP INDEX IF EXISTS public.likes_post_id_user_id_key;

-- Recriar indexes parciais corretos
CREATE UNIQUE INDEX uq_likes_personal
  ON public.likes (post_id, user_id)
  WHERE company_page_id IS NULL;

CREATE UNIQUE INDEX uq_likes_company
  ON public.likes (post_id, company_page_id)
  WHERE company_page_id IS NOT NULL;

-- ── 2. RPC: incrementar likes_count ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_post_likes(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE posts SET likes_count = likes_count + 1 WHERE id = p_post_id;
END;
$$;

-- ── 3. RPC: decrementar likes_count ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_post_likes(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = p_post_id;
END;
$$;

-- ── 4. RPC: incrementar comments_count ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_post_comments(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE posts SET comments_count = comments_count + 1 WHERE id = p_post_id;
END;
$$;

-- ── 5. RPC: decrementar comments_count ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_post_comments(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = p_post_id;
END;
$$;

-- ── 6. RPC: criar notificação genérica ──────────────────────────────────
-- Só insere se o actor != destinatário (evita auto-notificação)
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id  uuid,
  p_actor_id uuid,
  p_type     text,
  p_post_id  uuid DEFAULT NULL,
  p_message  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NOT NULL AND p_user_id != p_actor_id THEN
    INSERT INTO notifications(user_id, actor_id, type, post_id, message)
    VALUES (p_user_id, p_actor_id, p_type, p_post_id, p_message);
  END IF;
END;
$$;

-- ── 7. RPC: retorna dono do post para notificação ────────────────────────
CREATE OR REPLACE FUNCTION public.get_post_author(p_post_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM posts WHERE id = p_post_id;
  RETURN v_user_id;
END;
$$;

-- ── 8. Adicionar parent_comment_id em comments ───────────────────────────
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid
    REFERENCES public.comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comments_parent
  ON public.comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

-- ── 9. RPC: criar notificação de resposta de comentário ─────────────────
CREATE OR REPLACE FUNCTION public.notify_comment_reply(
  p_parent_comment_id uuid,
  p_actor_id uuid,
  p_post_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_comment_author uuid;
BEGIN
  SELECT user_id INTO v_comment_author FROM comments WHERE id = p_parent_comment_id;
  IF v_comment_author IS NOT NULL AND v_comment_author != p_actor_id THEN
    INSERT INTO notifications(user_id, actor_id, type, post_id, message)
    VALUES (v_comment_author, p_actor_id, 'comment_reply', p_post_id, 'respondeu seu comentário');
  END IF;
END;
$$;
