---
name: Unanchored ignore pattern silently drops nested native module source
description: An unanchored `ios/` or `android/` line in .gitignore/.easignore matches nested dirs too (e.g. modules/<name>/ios/), not just the root prebuild output — silently excluding custom native module source from git AND from the EAS build upload, with no error anywhere.
---

A `.gitignore`/`.easignore` line like `ios/` (no leading slash) is NOT anchored to
the project root — git/EAS ignore semantics match that pattern at ANY depth. If
the project also has a custom Expo native module under `modules/<name>/ios/`
(e.g. a Swift/ObjC source dir for a config-plugin-installed fix), the same line
meant only to exclude the generated root-level Expo prebuild output
(`ios/`, `android/`) also silently swallows the custom module's native source.

**Why this is dangerous:** the exclusion is silent. `git status` shows nothing
wrong (the files just look untracked/absent from history). `.easignore`
mirrors `.gitignore`, so EAS Build uploads a project archive missing those
files too — the build succeeds, but ships without the native fix. There is no
build error, because from the build's perspective the module directory simply
doesn't contain those files. A native crash/hang "fix" landed in a commit can
look complete (files exist on disk, referenced by a config plugin, code
reviewed as correct) while never actually reaching a single shipped binary.

**How to apply:** whenever a custom native module lives under
`modules/<name>/ios/` or `modules/<name>/android/` in an Expo project, always
root-anchor the generic native-output ignore lines (`/ios/`, `/android/`
instead of `ios/`, `android/`) in both `.gitignore` and `.easignore`. When
debugging "a native fix isn't taking effect" on iOS/Android with zero
observable error, check `git check-ignore -v <path-to-native-source-files>`
and `git ls-files <module-dir>` before assuming the code itself is wrong —
confirm the files are actually tracked/shipped before debugging their logic.
