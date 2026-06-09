---
name: Group members role constraint
description: Production DB has legacy 'admin' role in group_members; constraint and trigger history causing group creation failures.
---

## The rule
The `group_members_role_check` constraint must include `'admin'` as an allowed value alongside `'owner'`, `'member'`, `'moderator'`, `'pending'`.

**Why:** The production Supabase DB has an older trigger version (`auto_add_group_owner`) that was created directly in Supabase before migrations were tracked. That trigger inserts with `role='admin'` and `company_page_id=<user's company UUID>`. When migration v73 recreated the constraint without 'admin', every group creation failed with `23514 CHECK VIOLATION`.

## The onConflict rule
All upserts into `group_members` must use the **3-column** conflict target: `group_id,user_id,company_page_id` — NOT the 2-column `group_id,user_id`. The unique constraint is `UNIQUE NULLS NOT DISTINCT (group_id, user_id, company_page_id)`. Same applies to `conversation_participants`: use `conversation_id,user_id,company_page_id`.

**Why:** Using a 2-column onConflict on a table that only has a 3-column unique constraint causes PostgREST to either error or fall back to a plain INSERT.

## Web app role guard
`GrupoConfiguracoesPage.tsx` has a role gate that redirects non-members back to the chat. It must accept `"admin"` as a valid role (treat as `"moderator"`). Also use `grp.owner_id === userId` as an ownership fallback in case `group_members.role` is stale.

Pattern to follow:
```js
const isActualOwner = grp.owner_id === userId;
const role: MyRole =
  isActualOwner       ? "owner"     :
  rawRole === "owner" || rawRole === "moderator" || rawRole === "member" ? rawRole :
  rawRole === "admin" ? "moderator" : null;
```

## How to apply
- Any new migration that touches the role check constraint must include `'admin'`
- Any upsert into `group_members` or `conversation_participants` must specify the 3-column onConflict and include `company_page_id: null` (or the actual value) in the payload
- Migration v74 (`v74_fix_role_constraint_and_trigger.sql`) is the canonical fix — must be run in Supabase SQL Editor for each environment (dev + prod)
- Any page that gates access by `group_members.role` must handle `"admin"` and also fall back to `groups.owner_id` check
