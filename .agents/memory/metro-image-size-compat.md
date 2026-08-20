---
name: Metro image-size compatibility
description: Why Expo SDK 54 asset bundling needs a preload adapter with image-size 2.
---

When the workspace forces `image-size` 2.x, Expo SDK 54's Metro asset pipeline must start with the image-size compatibility preload enabled. The adapter must be loaded through `NODE_OPTIONS` so it is present in Metro's separate transform-worker processes as well as the parent bundler.

**Why:** Metro 0.83 supplies asset file paths, while image-size 2.x expects binary input. A configuration-only in-memory patch does not cross the worker-process boundary, causing blank previews and bundle HTTP 500 responses.

**How to apply:** Preserve the preload in every process that starts Metro or exports a web/native bundle, including development, standalone builds, and verification commands. Re-evaluate and remove it only after the installed Metro version natively supports image-size 2.x path inputs.