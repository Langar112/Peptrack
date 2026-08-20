---
name: Private device sessions
description: PepTrack's deliberate anonymous-session and device-only data policy.
---

PepTrack provisions an opaque, private API session automatically for each app installation instead of asking users to create an account. Existing valid legacy account sessions continue to work and are refreshed into the new token format.

**Why:** The product should open without sign-in while still keeping every user's cycles and journal entries isolated. A shared unauthenticated data store would break privacy, while recovery across devices would require a separate account or export feature.

**How to apply:** Keep all user-owned API routes scoped to the session user ID. Settings must plainly explain that data is private to the current installation and cannot be restored after uninstalling or moving devices. Preserve a clear all-data action; do not introduce hidden account requirements.