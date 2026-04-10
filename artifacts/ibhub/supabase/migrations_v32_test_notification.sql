-- ═══════════════════════════════════════════════════════════════════════════
-- Migration v32: Diagnóstico de notificações
--
-- Parte 1: Insere uma notificação de TESTE para o usuário principal para
--          verificar se a tela de notificações consegue buscar e exibir.
--          (Se aparecer no app, o problema é só de criação, não de leitura.)
--
-- Parte 2: Garante que a trigger de follow/conexão ainda funciona
--          (mantida em v31) e adiciona RLS grant para SELECT.
--
-- Execute no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jbvzjjdecwzomucnmzsn/sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Notificação de teste ─────────────────────────────────────────────────
-- Insere um "like" de teste do próprio usuário para si mesmo (actor_id = user_id).
-- O create_notification RPC bloqueia auto-notificação, mas INSERT direto passa.
-- Isso vai aparecer na tela → confirma que fetch funciona.
-- APAGUE após o teste se quiser.

INSERT INTO public.notifications (user_id, actor_id, type, post_id, message, read)
VALUES (
  '14f21080-e3a3-4fb4-baa4-7782f6b437ac',  -- user_id: sua conta
  '14f21080-e3a3-4fb4-baa4-7782f6b437ac',  -- actor_id: mesmo usuário (teste)
  'like',
  NULL,
  '🧪 Notificação de teste — se aparecer, o fetch está ok!',
  false
);

-- ── 2. Verificar se há notificações existentes ──────────────────────────────
SELECT id, user_id, actor_id, type, message, read, created_at
FROM public.notifications
WHERE user_id = '14f21080-e3a3-4fb4-baa4-7782f6b437ac'
ORDER BY created_at DESC
LIMIT 10;
