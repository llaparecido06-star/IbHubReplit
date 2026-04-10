-- ═══════════════════════════════════════════════════════════════════════════
-- Migration v29: Recriar triggers com SECURITY DEFINER
-- Problema: triggers de likes/comments/follows sem SECURITY DEFINER ficam
-- sujeitos à RLS do usuário ativo → update de likes_count em post alheio
-- é bloqueado → transação inteira cancela → like/comentário não persiste.
-- Execute no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jbvzjjdecwzomucnmzsn/sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. likes_count: SECURITY DEFINER ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS likes_count_trigger ON public.likes;
CREATE TRIGGER likes_count_trigger
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();

-- ── 2. notify_on_like: SECURITY DEFINER + suporte empresa ───────────────
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author uuid;
BEGIN
  SELECT user_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
  -- Não notifica se é o próprio autor curtindo o post
  IF post_author IS NOT NULL AND post_author != NEW.user_id THEN
    INSERT INTO public.notifications(user_id, actor_id, type, post_id, message)
    VALUES (post_author, NEW.user_id, 'like', NEW.post_id, 'curtiu sua publicação');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS like_notification_trigger ON public.likes;
CREATE TRIGGER like_notification_trigger
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

-- ── 3. comments_count: SECURITY DEFINER ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_comments_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS comments_count_trigger ON public.comments;
CREATE TRIGGER comments_count_trigger
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comments_count();

-- ── 4. notify_on_comment: novo trigger SECURITY DEFINER ─────────────────
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author uuid;
BEGIN
  SELECT user_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
  IF post_author IS NOT NULL AND post_author != NEW.user_id THEN
    INSERT INTO public.notifications(user_id, actor_id, type, post_id, message)
    VALUES (post_author, NEW.user_id, 'comment', NEW.post_id, 'comentou sua publicação');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comment_notification_trigger ON public.comments;
CREATE TRIGGER comment_notification_trigger
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- ── 5. notify_on_follow: SECURITY DEFINER ───────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications(user_id, actor_id, type, message)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', 'começou a te seguir');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS follow_notification_trigger ON public.follows;
CREATE TRIGGER follow_notification_trigger
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- ── 6. follow_count: SECURITY DEFINER ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
    UPDATE public.profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS follow_count_trigger ON public.follows;
CREATE TRIGGER follow_count_trigger
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();

-- ── 7. connections_count: SECURITY DEFINER ──────────────────────────────
CREATE OR REPLACE FUNCTION public.update_connections_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    UPDATE public.profiles SET connections_count = connections_count + 1 WHERE id = NEW.requester_id;
    UPDATE public.profiles SET connections_count = connections_count + 1 WHERE id = NEW.receiver_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS connections_count_trigger ON public.connections;
CREATE TRIGGER connections_count_trigger
  AFTER UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.update_connections_count();

-- ── 8. notify_on_connection_request: SECURITY DEFINER ───────────────────
CREATE OR REPLACE FUNCTION public.notify_on_connection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notifica ao enviar pedido
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(user_id, actor_id, type, message)
    VALUES (NEW.receiver_id, NEW.requester_id, 'connection', 'quer se conectar com você');
  -- Notifica ao aceitar
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications(user_id, actor_id, type, message)
    VALUES (NEW.requester_id, NEW.receiver_id, 'connection_accepted', 'aceitou seu pedido de conexão');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS connection_notification_trigger ON public.connections;
CREATE TRIGGER connection_notification_trigger
  AFTER INSERT OR UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_connection();
