---
name: Web feed post publishing (RLS identity)
description: Why web feed publishing failed while the feed still loaded, and the identity rule for writing posts.user_id.
---

# Web feed: publishing fails but feed loads

**Rule:** When creating a post from the web app, `posts.user_id` MUST be the
authenticated auth user id (the Supabase session `user.id` / `auth.uid()`), not
the caller-supplied `profile.id`.

**Why:** The feed READS go through the API server (service-role, no user JWT), so
the feed loads even with a stale/expired client session — this masks auth
problems. But post CREATION is a DIRECT Supabase insert governed by RLS
`posts_insert: with check (auth.uid() = user_id)`. The web compose path derived
`userId = profile?.id ?? user?.id`, so whenever `profile.id` diverges from
`auth.uid()` the insert fails RLS while the feed keeps working → the classic
"feed works but publishing fails" report. The old `createWebPost` also swallowed
the real error (`if (error || !data) return null`), hiding the cause. The mobile
app never had this bug because it inserts `user_id: user.id` directly.

**How to apply:** In web `createWebPost` (artifacts/web/src/services/api.ts),
override `insertData.user_id = session.user.id` after fetching the session; throw
the real PostgREST error instead of returning null. Note `posts.user_id` FK
points to `profiles.id` (migration v27), and the invariant `profiles.id =
auth.uid()` is what both the mobile insert and the feed author-enrichment
(`_fetchProfilesMap` keyed on `profiles.id`) already rely on — so writing
`session.user.id` is a no-op for standard users and only corrects the divergent
case. Do NOT try to "fix" legacy `profiles.id != auth.uid()` rows in code; that
would need a data migration (ask the user first).
