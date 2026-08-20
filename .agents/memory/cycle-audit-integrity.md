---
name: Cycle audit integrity
description: Rules for preserving schedule history and trustworthy system-generated cycle-change records.
---

Cycle edits must regenerate only scheduled events at or after their effective date, while preserving earlier scheduled events. System-generated `cycle_update` Journal entries are append-only: users may read but not create, edit, or delete them.

**Why:** Historical calendars and change records must remain trustworthy after a cycle is modified. Regenerating the full schedule or allowing edits to audit records would erase the context needed to understand past plan changes.

**How to apply:** Keep the cycle update, schedule-rule change, audit entry, change history, and affected event replacement in one transaction. Validate schedule invariants before generating events, including positive intervals and an exact distinct-day count for weekly-frequency schedules.