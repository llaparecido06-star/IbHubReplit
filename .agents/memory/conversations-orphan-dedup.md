---
name: Conversations orphan rows & deduplication
description: Why 30 of 32 conversations disappeared from the list, and the fix strategy.
---

## The bug

`conversation_participants` had 32 rows for a user, but the `conversations` table had only 2 matching rows. The `GET /conversations` endpoint queried `conversations WHERE id IN (32 IDs)` → returned 2. The other 30 were silently dropped.

**Root cause:** Legacy DMs were created (likely by early mobile code paths or direct Supabase inserts) by inserting into `conversation_participants` WITHOUT also inserting into `conversations`. There is no FK enforcement between the two tables in production.

**Secondary cause:** An additional identity-scoping filter excluded DMs where `company_page_id` matched a company the user owned. Many old DMs had `company_page_id` set due to an earlier client-side bug (active company context leaking into `startConversation`).

**Tertiary cause:** Multiple conversation rows existed for the same user pair (duplicate DMs).

## Fixes applied (API server `routes/messages.ts`)

1. **Personal-mode filter removed**: in personal mode (`activeCompanyId = null`), `filtered = sorted` — no exclusion of company-tagged DMs.
2. **Catch-all recovery**: after building `allConvosData` from the conversations table + groups supplement, any convId still uncovered is queried against the `groups` table; remaining uncovered IDs are added as minimal DM entries so they appear in the list.
3. **Orphan-DM backfill**: fire-and-forget `upsert` to `conversations` for any orphan DM IDs — self-heals on first load so future calls hit the normal path.
4. **Deduplication**: after building `results`, DMs are collapsed by `participant.id` — keeping the most recently active thread per pair.

## Same fixes applied in mobile (`services/api/messages.ts`)

- Personal-mode filter removed (same `return sorted` instead of `sorted.filter(...)`).
- Deduplication block added before the identity filter.

**Why:** The `conversations` table has NO FK constraint enforcing consistency with `conversation_participants`. Any code path that writes to `conversation_participants` without also writing to `conversations` will produce orphaned rows. The catch-all + backfill self-heal this.
