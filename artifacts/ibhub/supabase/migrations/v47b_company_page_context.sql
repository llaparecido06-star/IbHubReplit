-- Migration v47b: Add company_page_id to opportunities and events
-- Allows opportunities (vagas/marketplace) and events to be linked to a company page

-- opportunities: add company_page_id column with FK to company_pages
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS company_page_id UUID REFERENCES company_pages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_company_page_id ON opportunities(company_page_id);

-- events: add company_page_id column with FK to company_pages
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS company_page_id UUID REFERENCES company_pages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_company_page_id ON events(company_page_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON opportunities TO authenticated;
GRANT SELECT, INSERT, UPDATE ON events TO authenticated;
