---
name: Correlate iOS crash reports to build number vs fix-commit time
description: Before concluding "the fix failed", prove the crashing build actually contains the fix — EAS+TestFlight latency makes that easy to get wrong.
---

# A repeat iOS crash after a fix is usually a PRE-FIX build, not a failed fix

**Rule:** When a user resends an iOS/TestFlight crash that looks identical to one
you just "fixed", do NOT assume the fix failed. First correlate three facts:
1. the crash log's `Version: X (N)` build number,
2. the crash `Date/Time` (convert local↔UTC — Brazil is UTC-3),
3. the commit time of the fix.

A native iOS build via `eas build` + Apple/TestFlight processing + install
realistically takes ~45+ min, often much longer. If the crash happened only a
short time (e.g. <40 min) after the fix commit, the tested build was almost
certainly cut BEFORE the fix — it cannot validate anything.

**Why:** This project burned multiple round-trips chasing an iOS startup crash
where consecutive builds (15, then 16) were BOTH pre-fix. The crash signature was
identical each time, which *looked* like the fix not working, but the timeline
proved each build predated the fix commit. EAS build numbers auto-increment per
submission, so a higher build number does NOT mean "newer than your latest code".

**How to apply:**
- Inspect git history for the fix commit's exact UTC time
  (`git --no-optional-locks show -s --format='%h %cd' --date=iso <sha>`).
- Compare to the crash `Date/Time`. If too tight for a full EAS+TestFlight cycle,
  tell the user the build is pre-fix and a fresh build is needed — do not touch code.
- To END the pre/post-fix ambiguity, bump the human-visible `version` in
  `app.json` (e.g. 1.1.2 → 1.1.3) so the user can confirm in TestFlight they are
  testing the build that carries the fix. Build numbers auto-increment via EAS
  (`eas.json` production `autoIncrement: true`, `appVersionSource: "local"`).
- Only after a build that provably contains the fix still crashes should you
  treat the fix as incomplete and hunt for another cause.

Related: `ios-notifications-void-crash.md` (the actual void-TurboModule fix being shipped).
