-- v23: Company identity in chat messages
-- Allows messages to be sent on behalf of a company page

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS from_company_page_id uuid REFERENCES company_pages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_from_company
  ON messages(from_company_page_id)
  WHERE from_company_page_id IS NOT NULL;
