---
name: Cloud publish Metro interruption
description: Diagnostic pattern for mobile artifact publish builds that stop during Metro bundling.
---

If a Cloud Run publish build ends while Metro is still bundling and emits no compiler, dependency, or startup error, reproduce the same production build locally before editing application code.

**Why:** The cloud builder can terminate a long Metro phase without retaining a useful final error, while the local build completes the identical bundles successfully.

**How to apply:** Compare the failed build's final log window with a known successful build, run the mobile production build locally, and retry publishing if the local build passes. Treat repeated local failures as a separate code/configuration issue.