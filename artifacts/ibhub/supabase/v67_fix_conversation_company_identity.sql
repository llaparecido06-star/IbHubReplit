-- Migration v67: Backfill conversation company_page_id
-- Problem: conversations created while the user was in company mode had
-- company_page_id = NULL because the mobile call sites didn't pass the
-- activeCompany id to getOrCreateDirectConversation.
-- The MESSAGES inside those conversations correctly have from_company_page_id
-- set, but the conversation header was never tagged.
--
-- Fix: for every direct conversation (is_group = false) that has
-- company_page_id IS NULL, if ALL messages in it have the same
-- from_company_page_id (meaning only company messages), tag the conversation.
--
-- NOTE: we only update when every message in the conversation was sent from
-- the same company, to avoid accidentally tagging conversations where both
-- personal and company messages coexist. Those edge cases will stay as-is and
-- the user can open a fresh company conversation from the empresa page.

UPDATE public.conversations c
SET    company_page_id = subq.from_company_page_id
FROM (
  SELECT
    m.conversation_id,
    m.from_company_page_id,
    COUNT(*)                                      AS total_msgs,
    COUNT(*) FILTER (WHERE m.from_company_page_id IS NOT NULL) AS company_msgs
  FROM public.messages m
  JOIN public.conversations cv ON cv.id = m.conversation_id
  WHERE cv.is_group = false
    AND cv.company_page_id IS NULL
    AND m.from_company_page_id IS NOT NULL
  GROUP BY m.conversation_id, m.from_company_page_id
  HAVING COUNT(*) = COUNT(*) FILTER (WHERE m.from_company_page_id IS NOT NULL)
) subq
WHERE c.id = subq.conversation_id
  AND c.company_page_id IS NULL;
