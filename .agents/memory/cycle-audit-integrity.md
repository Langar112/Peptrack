---
name: Cycle audit integrity
description: Rules for preserving schedule history and trustworthy system-generated cycle-change records.
---

Cycle edits must regenerate only scheduled events at or after their effective date, while preserving earlier scheduled events. System-generated `cycle_update` Journal entries are append-only: users may read but not create, edit, or delete them.

**Why:** Historical calendars and change records must remain trustworthy after a cycle is modified. Regenerating the full schedule or allowing edits to audit records would erase the context needed to understand past plan changes.

**How to apply:** When changing cycle scheduling or audit behavior, prevent the change from rewriting history or making system-generated history user-editable.