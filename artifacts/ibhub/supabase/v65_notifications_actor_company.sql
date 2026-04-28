-- Migration v65: Track company actor in notifications
-- When a user likes a post as a company, the notification should show
-- the company name/avatar instead of the personal profile.

-- 1. Add actor_company_id column to notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_company_id uuid
    REFERENCES public.company_pages(id) ON DELETE SET NULL;

-- 2. Update notify_on_like to capture company_page_id from the likes row
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
  -- Don't notify if it's the post author themselves liking
  IF post_author IS NOT NULL AND post_author != NEW.user_id THEN
    INSERT INTO public.notifications(user_id, actor_id, actor_company_id, type, post_id, message)
    VALUES (
      post_author,
      NEW.user_id,
      NEW.company_page_id,   -- null when liked as user, company id when liked as company
      'like',
      NEW.post_id,
      'curtiu sua publicação'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS like_notification_trigger ON public.likes;
CREATE TRIGGER like_notification_trigger
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();
