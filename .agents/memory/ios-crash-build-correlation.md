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

## Build NUMBER can COLLIDE across pre/post-fix — trust the version STRING
- `autoIncrement:true` + `appVersionSource:"local"` bumps ONLY the iOS
  `buildNumber` at build time, never the `version` string. So a build cut from a
  pre-fix checkout at local `buildNumber` N ships as build **N+1** — which can equal
  the `buildNumber` a later fix commit hardcoded. Real example: a fix commit set
  `version 1.1.8→1.1.9` AND `buildNumber 22→23` together; a pre-fix (1.1.8/22)
  build auto-increments to **23**, colliding with the fix's number, while a genuine
  post-fix (1.1.9/23) build auto-increments to **24**. Seeing "build 23" is thus
  MORE consistent with pre-fix code than post-fix.
- **Build number never proves code recency.** The `version` STRING does, because it
  only changes by explicit commit. Always: (a) bump `version` in the SAME commit as
  a boot/crash fix, and (b) ask the user to read the on-device version STRING (not
  the build number) in TestFlight. If it shows the pre-fix version, debate over.

## Same principle for a "still blank/broken" boot (not just crashes)
- A missing on-device diagnostic is a hard tell: if the code renders something
  UNCONDITIONALLY on iOS (e.g. the temporary `SHOW_BOOT_HUD` strip in
  `RootLayoutNav`, `SHOW_BOOT_HUD && Platform.OS==="ios"`) and the user reports it
  is absent, the installed binary predates the commit that added it — full stop.
  Correlate with git: `git log -S "SHOW_BOOT_HUD" --oneline -- <file>`.
- "Published your App" commits are WEB/API deploys — they do NOT rebuild the Expo
  mobile binary. Only `eas build -p ios` + TestFlight/App Store install ships new
  mobile code. Never treat a web publish as evidence the phone has the fix.
- USER-WORKFLOW TRAP (cost this whole saga): users conflate Replit "Publish" with a
  mobile build. Pattern: they click Publish, then RE-INSTALL from TestFlight, and
  believe the app updated — but TestFlight still serves the LAST `eas build`, i.e.
  the old binary. Reinstalling from TestFlight does NOT fetch new code; only a new
  `eas build` puts a new build there. BEFORE any deeper mobile debugging, ask two
  things: (1) "did you run `eas build -p ios`, or click Publish/Deploy?" and (2)
  "what version does the on-screen strip show?" If Publish + no version strip, the
  phone is on old code — stop debugging, have them run `eas build`.
- `crash_reports` table empty + blank navy + no HUD + splash already hidden ⇒ not a
  JS crash, not a render error (ErrorBoundary would show "Algo deu errado"), not a
  provider gate (all providers pass `{children}`) — it is a pre-fix binary. Tell the
  user to cut a fresh EAS build; do not touch code.

Related: `ios-notifications-void-crash.md` (the actual void-TurboModule fix being shipped),
`ios-empty-navy-redirect-noop.md` (the render-login-in-place fix this build must contain).
