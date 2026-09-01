---
name: Stale API workflow processes
description: Environment-specific guidance for API responses that do not match current route source.
---

When an artifact API response appears to omit a recently added field, first verify the managed API workflow and restart it if an older process still owns its port.

**Why:** A prior restart attempt failed with an address-in-use error while an older server continued serving the previous bundle, making a correct route look broken.

**How to apply:** Check the workflow logs and port owner, use the exact managed artifact workflow restart, then verify the health endpoint and rebuilt bundle before changing application code.