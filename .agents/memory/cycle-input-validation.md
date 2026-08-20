---
name: Cycle input validation
description: Data-integrity rule for saving reconstitution cycles.
---

Cycle creation must validate all required reconstitution and dose values as positive numbers in the mobile form and again at the API boundary. Never coerce missing numeric values into strings for database writes.

**Why:** Incomplete fields otherwise reach PostgreSQL as the literal string `undefined`, producing an opaque save failure instead of telling the user what to complete.

**How to apply:** Keep the mobile form's visible error state and the API's 400-level validation aligned whenever cycle fields or creation paths change.