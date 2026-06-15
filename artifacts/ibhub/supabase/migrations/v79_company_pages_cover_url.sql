-- v79: Add cover_url to company_pages
-- Allows companies to set a banner/cover photo on their profile page.

ALTER TABLE public.company_pages
  ADD COLUMN IF NOT EXISTS cover_url text;
