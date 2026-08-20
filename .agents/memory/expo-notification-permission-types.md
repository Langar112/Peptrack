---
name: Expo notification permission types
description: Permission typing behavior when Expo Notifications and the installed Expo SDK are on different release lines.
---

Keep the Expo SDK and expo-notifications versions on the same supported release line. Until they are aligned, interpret notification permission responses through the declared iOS and Android fields rather than inherited fields that may disappear from TypeScript.

**Why:** A mismatched notification package can expose a runtime permission shape that TypeScript cannot inherit from the installed Expo SDK, while `skipLibCheck` hides the dependency declaration problem.

**How to apply:** Prefer `ios.status` and `android.importance` for the interim permission check, then simplify to the shared response fields after dependency alignment is verified.