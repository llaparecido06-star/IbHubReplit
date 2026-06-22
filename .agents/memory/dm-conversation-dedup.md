---
name: DM conversation duplication
description: Why direct-message threads fragment, and the rule for looking up / creating a DM without spawning duplicate conversation rows.
---

# Direct-message conversation duplication

Symptom: opening a person's chat shows only a fragment of the history, and the
header name/photo can mismatch the messages — especially from the floating
mini-chat panel that deep-links via `?conv=<id>`.

Root cause: multiple `conversations` rows exist for the SAME two-person pair, so
the real history is scattered across them. `GET /conversations` only papers over
it by deduping DMs to one "winner" per participant; when that winner flips
between two loads (mini-chat vs full page), a `?conv=` link lands on a row not in
the deduped list and falls into a blank-header placeholder branch.

**Rule:** when looking up OR creating a direct conversation, resolve BOTH
participants' alias ids before matching existing threads. Each human can be
stored under two ids (Supabase `auth.uid()` in one participant row and
`profiles.id` in another). Expand each side to its full id set via the `profiles`
table (`id` <-> `user_id`) and match `conversation_participants` against both
sets.

**Why:** matching only the raw ids passed in misses the legacy mismatch, so a
second "open chat" with the alternate id fails to find the existing thread and
inserts a new `conversations` row. Over time this produced pairs with 10-15
duplicate rows and badly fragmented histories.

**How to apply:**
- Server lookup must alias-resolve user_id_1/caller AND user_id_2 (not just the
  caller side).
- Keep the dedup tiebreak deterministic (e.g. smaller id wins on equal
  `last_message_at`) so the mini-chat panel and full page always pick the same
  winner.
- Route the `?conv=` deep-link open through the same hardened loader as a manual
  click (clear messages, set the active-conv ref, stale-guard the fetch) so a
  previous thread never bleeds under a new/blank header.
- Residual gap: `POST /conversations/direct` is still read-then-insert with no
  DB-level unique guard, so truly concurrent first-opens can still race into two
  rows. A real fix needs a unique constraint / advisory lock / transactional RPC
  keyed by the normalized pair (+ company_page_id).
- Merging duplicates safely: group by (pair, company_page_id) to keep personal
  vs company inboxes separate; re-point `messages.conversation_id` to the
  canonical BEFORE deleting the duplicate `conversations` rows (avoid cascade
  wiping messages); back up first — Supabase is external and NOT covered by
  Replit checkpoints.
