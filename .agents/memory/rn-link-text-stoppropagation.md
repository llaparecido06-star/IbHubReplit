---
name: RN nested link Text needs stopPropagation
description: In React Native, a Text onPress link inside a parent Pressable can double-fire; stop propagation in the link handler.
---

In React Native, a `<Text onPress>` link rendered inside a parent `Pressable` (or another `Text` with `onPress`) can fire BOTH handlers on a single tap — e.g. tapping a URL opens the link AND also triggers the parent's navigation (open post / open thread).

**Rule:** every tappable link handler must take the event and call `e.stopPropagation()` before doing its work:
`onPress={(e) => { e.stopPropagation(); openLink(url); }}`

**Why:** RN's responder system does not behave like DOM bubbling, and whether the parent also fires is platform/version dependent — relying on the inner Text "winning" the responder is unreliable. Plain (non-link) text segments have no `onPress`, so they still bubble to the parent as intended; only link segments stop propagation.

**How to apply:** applies to any linkifier that renders link sub-`Text` nodes inside content that sits in a pressable container — feed/post cards, chat bubbles, comments. The shared linkifier component centralizes this, but any hand-rolled `splitLinks().map(... <Text onPress>)` (e.g. a mention renderer) must add it too.
