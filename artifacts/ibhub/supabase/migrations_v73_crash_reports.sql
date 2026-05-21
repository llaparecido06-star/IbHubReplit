-- v73: crash_reports table
-- Stores JS-level crash reports sent from the mobile app via the API server.
-- Native startup crashes (before JS runs) are NOT captured here — those require
-- a native SDK like Sentry. This table captures React render errors,
-- unhandled JS exceptions, and fatal JS errors that happen after the JS engine starts.

CREATE TABLE IF NOT EXISTS crash_reports (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  type         text        NOT NULL CHECK (type IN ('js_error', 'render_error', 'unhandled_rejection')),
  message      text,
  stack        text,
  component_stack text,
  device_info  jsonb,
  app_version  text,
  build_version text,
  ip           text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crash_reports_created_at_idx ON crash_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS crash_reports_type_idx       ON crash_reports (type);

-- No RLS: only the service-role key (used by the API server) can insert here.
-- The table is not exposed via the anon/user keys.
ALTER TABLE crash_reports DISABLE ROW LEVEL SECURITY;
