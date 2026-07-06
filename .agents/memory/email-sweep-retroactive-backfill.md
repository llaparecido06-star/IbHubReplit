---
name: Email/notification sweep cron needs backfill guard
description: A periodic cron that treats "column IS NULL" as "pending" will retroactively fire for the entire existing user base the moment it ships, unless existing rows are backfilled first.
---

When adding a new "one-time event" tracking column (e.g. `welcome_email_sent_at`) plus a periodic sweep job that queries `WHERE <column> IS NULL` to find "pending" recipients, every pre-existing row also has that column NULL. The very first cron tick after deploy treats the ENTIRE existing user base as newly-pending and mass-sends to them.

**Why:** In this project, shipping a welcome-email sweep this way caused ~37 real, already-active users to receive an unintended "welcome to the app" email within seconds of the API server restarting with the new migration + Brevo key live, before the bug was caught and the cron process was killed. The remaining pending rows had to be emergency-backfilled to stop further sends.

**How to apply:** Before enabling any new "sweep for NULL timestamp column" cron, backfill `SET <column> = now()` for all rows that already satisfy the "should not receive this" condition (i.e. existed before the feature shipped), in the SAME migration/deploy step that adds the column — not as an afterthought. Only rows created/confirmed AFTER the backfill should ever see the column as genuinely NULL.
