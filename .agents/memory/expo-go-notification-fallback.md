---
name: Expo Go notification fallback
description: Keeping the Android Expo Go preview usable when notification support is unavailable.
---

Treat notification support as optional in the Expo Go preview, especially on Android. The app must still open and allow core tracking when the native notification module cannot load.

**Why:** Expo Go removed Android remote-push functionality starting with SDK 53. A mismatched or unsupported notification module can fail during startup rather than merely disabling reminders.

**How to apply:** Keep notification imports out of module startup paths, load them only when notification work is requested, and safely return without scheduling when unavailable. Use the Expo SDK-compatible package version; native development or production builds can provide full reminder support.