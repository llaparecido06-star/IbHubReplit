---
name: schema.sql is stale past v80
description: supabase/schema.sql no longer reflects the live database; don't trust it or try to keep it in sync when adding migrations.
---

`artifacts/ibhub/supabase/schema.sql` stopped being updated around migration v80 — it does not include v81/v82/v83+ changes (e.g. columns/functions added by later migration files).

**Why:** there is no migration runner in this repo; every migration is a standalone `.sql` file applied by hand in the Supabase SQL Editor (see `artifacts/ibhub/supabase/migrations/`), and nobody has been mirroring later files back into `schema.sql`.

**How to apply:**
- Don't read `schema.sql` as ground truth for the current table/function shape — grep the actual `migrations*/*.sql` files (highest version numbers) or query the live database instead.
- When adding a new migration, don't bother mirroring it into `schema.sql` either — that would create a false impression that `schema.sql` is being kept current when it isn't. Just add the new numbered migration file.
- Since there's no DB migration runner, the agent generally cannot apply new SQL itself (no `exec_sql` RPC, no direct `SUPABASE_DB_URL`) — hand the new migration file's contents to the user to run manually in the Supabase SQL Editor.
