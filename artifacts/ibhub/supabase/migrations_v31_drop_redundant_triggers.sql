-- ═══════════════════════════════════════════════════════════════════════════
-- Migration v31: Remover triggers redundantes
--
-- v29 criou triggers SECURITY DEFINER para: likes_count, comments_count,
-- like_notification e comment_notification.
-- v30 passou a fazer tudo via RPCs diretamente no código JS.
-- Resultado: cada ação incrementava o contador DUAS VEZES e criava
-- notificações duplicadas.
--
-- Esta migration remove os triggers que agora são substituídos pelos RPCs.
-- Mantém: follow_count, follow_notification, connections_count,
--          connection_notification (não têm RPC equivalente no código).
--
-- Execute no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jbvzjjdecwzomucnmzsn/sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Remover trigger de likes_count (substituído por RPC v30) ────────────
DROP TRIGGER IF EXISTS likes_count_trigger ON public.likes;

-- ── 2. Remover trigger de notificação de like (substituído por código v30) ─
DROP TRIGGER IF EXISTS like_notification_trigger ON public.likes;

-- ── 3. Remover trigger de comments_count (substituído por RPC v30) ─────────
DROP TRIGGER IF EXISTS comments_count_trigger ON public.comments;

-- ── 4. Remover trigger de notificação de comentário (substituído por código v30)
DROP TRIGGER IF EXISTS comment_notification_trigger ON public.comments;

-- ── 5. Corrigir contagens que foram duplicadas ──────────────────────────────
-- Recalcula likes_count e comments_count baseado nos dados reais
UPDATE public.posts p
SET likes_count = (
  SELECT COUNT(*) FROM public.likes l WHERE l.post_id = p.id
);

UPDATE public.posts p
SET comments_count = (
  SELECT COUNT(*) FROM public.comments c WHERE c.post_id = p.id
);
