-- Migration v66: Separate personal vs company notifications
-- 1. Add target_company_id so notifications can be addressed to a company
-- 2. Update like/comment triggers to route to company when post.company_page_id IS NOT NULL
-- 3. Add trigger on company_follows to notify the company owner

-- ─── 1. Add target_company_id to notifications ───────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_company_id uuid
    REFERENCES public.company_pages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_target_company
  ON public.notifications(target_company_id, created_at DESC);

-- ─── 2. notify_on_like: route to company or personal ─────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_company_id uuid;
  v_post_user_id    uuid;
  v_company_owner   uuid;
BEGIN
  SELECT user_id, company_page_id
    INTO v_post_user_id, v_post_company_id
    FROM public.posts
   WHERE id = NEW.post_id;

  IF v_post_company_id IS NOT NULL THEN
    -- Company post: notify the company owner as a company notification
    SELECT owner_id INTO v_company_owner
      FROM public.company_pages
     WHERE id = v_post_company_id;

    -- Don't notify if the liker is the company owner themselves,
    -- or if the liker is acting as the same company
    IF v_company_owner IS NOT NULL
       AND v_company_owner != NEW.user_id
       AND (NEW.company_page_id IS NULL OR NEW.company_page_id != v_post_company_id)
    THEN
      INSERT INTO public.notifications(
        user_id, actor_id, actor_company_id, type, post_id, message, target_company_id
      ) VALUES (
        v_company_owner,
        NEW.user_id,
        NEW.company_page_id,
        'like',
        NEW.post_id,
        'curtiu a publicação da empresa',
        v_post_company_id
      );
    END IF;
  ELSE
    -- Personal post: notify the post author
    IF v_post_user_id IS NOT NULL AND v_post_user_id != NEW.user_id THEN
      INSERT INTO public.notifications(
        user_id, actor_id, actor_company_id, type, post_id, message
      ) VALUES (
        v_post_user_id,
        NEW.user_id,
        NEW.company_page_id,
        'like',
        NEW.post_id,
        'curtiu sua publicação'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS like_notification_trigger ON public.likes;
CREATE TRIGGER like_notification_trigger
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

-- ─── 3. notify_on_comment: route to company or personal ──────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_company_id uuid;
  v_post_user_id    uuid;
  v_company_owner   uuid;
  v_parent_author   uuid;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    -- Root comment on a post
    SELECT user_id, company_page_id
      INTO v_post_user_id, v_post_company_id
      FROM public.posts
     WHERE id = NEW.post_id;

    IF v_post_company_id IS NOT NULL THEN
      SELECT owner_id INTO v_company_owner
        FROM public.company_pages
       WHERE id = v_post_company_id;

      IF v_company_owner IS NOT NULL
         AND v_company_owner != NEW.user_id
         AND (NEW.company_page_id IS NULL OR NEW.company_page_id != v_post_company_id)
      THEN
        INSERT INTO public.notifications(
          user_id, actor_id, actor_company_id, type, post_id, comment_id, message, target_company_id
        ) VALUES (
          v_company_owner,
          NEW.user_id,
          NEW.company_page_id,
          'comment',
          NEW.post_id,
          NEW.id,
          'comentou na publicação da empresa',
          v_post_company_id
        );
      END IF;
    ELSE
      IF v_post_user_id IS NOT NULL AND v_post_user_id != NEW.user_id THEN
        INSERT INTO public.notifications(
          user_id, actor_id, actor_company_id, type, post_id, comment_id, message
        ) VALUES (
          v_post_user_id,
          NEW.user_id,
          NEW.company_page_id,
          'comment',
          NEW.post_id,
          NEW.id,
          'comentou na sua publicação'
        );
      END IF;
    END IF;
  ELSE
    -- Reply: always notify the personal author of the parent comment
    SELECT user_id INTO v_parent_author
      FROM public.comments
     WHERE id = NEW.parent_comment_id;

    IF v_parent_author IS NOT NULL AND v_parent_author != NEW.user_id THEN
      INSERT INTO public.notifications(
        user_id, actor_id, actor_company_id, type, post_id, comment_id, message
      ) VALUES (
        v_parent_author,
        NEW.user_id,
        NEW.company_page_id,
        'comment_reply',
        NEW.post_id,
        NEW.id,
        'respondeu seu comentário'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comment_notification_trigger ON public.comments;
CREATE TRIGGER comment_notification_trigger
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- ─── 4. notify_on_company_follow: new trigger on company_follows ──────────────
CREATE OR REPLACE FUNCTION public.notify_on_company_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT owner_id INTO v_owner_id
    FROM public.company_pages
   WHERE id = NEW.company_id;

  -- Don't notify if the follower is the company owner themselves
  IF v_owner_id IS NOT NULL AND v_owner_id != NEW.user_id THEN
    INSERT INTO public.notifications(
      user_id, actor_id, type, message, target_company_id
    ) VALUES (
      v_owner_id,
      NEW.user_id,
      'company_follow',
      'começou a seguir sua empresa',
      NEW.company_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS company_follow_notification_trigger ON public.company_follows;
CREATE TRIGGER company_follow_notification_trigger
  AFTER INSERT ON public.company_follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_company_follow();
