-- v24: Company identity in stories (Momentos)
-- Allows stories to be published on behalf of a company page

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS company_page_id uuid REFERENCES company_pages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_stories_company_page
  ON stories(company_page_id)
  WHERE company_page_id IS NOT NULL;
