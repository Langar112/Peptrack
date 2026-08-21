---
name: Metro image-size compatibility
description: Expo SDK 54 Metro must retain its compatible image-size 1.x dependency.
---

Expo SDK 54's Metro 0.83.3 asset pipeline expects `image-size` 1.x, currently 1.2.1. Do not add a workspace-wide override that forces image-size 2.x onto Metro.

**Why:** Metro 0.83.3 supplies asset file paths in the form expected by image-size 1.x. image-size 2.x rejects those paths with a SharedArrayBuffer/ArrayBuffer type error during iOS asset processing.

**How to apply:** Keep the workspace override absent, regenerate the lockfile after dependency changes, and verify Metro's nested dependency with `pnpm why image-size` before Expo exports.