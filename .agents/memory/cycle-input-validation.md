---
name: Cycle input validation
description: Data-integrity rule for saving optional reconstitution details on calendar cycles.
---

Calendar-created cycles require a compound name, a positive dose, and an injection frequency. Vial amount, BAC water, calculated volume, and syringe units are optional; blank values are normalized to zero before storage.

**Why:** Users may track cycles without reconstitution details. Missing optional numeric fields must not reach PostgreSQL as the literal string `undefined`, which causes an opaque save failure.

**How to apply:** Keep the mobile form and API validation aligned: require only the three essential fields, validate any optional numeric value if supplied, and persist absent optional values as zero.