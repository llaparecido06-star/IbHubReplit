---
name: conversation_participants RLS blocks direct inserts
description: Client-side INSERT/UPSERT to conversation_participants silently fails due to RLS; must go through API server using supabaseAdmin.
---

## Rule
Never write to `conversation_participants` from the Supabase JS client. Always use the API server (`supabaseAdmin`) for INSERT/UPSERT operations on this table.

**Why:** The table has a recursive RLS self-reference (reads its own rows to evaluate the policy) that blocks both SELECT and INSERT/UPSERT from the client. This is documented in the `/api/conversations` route comment. The INSERT/UPSERT failure is silent — no error is surfaced to the caller — which made the bug hard to find.

**How to apply:**
- All routes that need to add a user to a conversation (DM creation, group join, approve-member) must go through Express routes using `supabaseAdmin`.
- The `GET /conversations` endpoint has a backfill that self-heals missing rows on every load: it cross-checks `group_members` against `conversation_participants` and upserts any gaps.
- The `joinGroup` client function was the offender: it upserted `conversation_participants` directly. It was replaced with a `POST /community/groups/:id/join` API endpoint.
