---
name: drizzle-kit push gets stuck on unrelated schema drift prompts
description: Why `drizzle-kit push` can hang/misbehave and when to hand-write raw SQL instead for small additive changes.
---

## Lesson
`drizzle-kit push` opens an interactive TUI (arrow-key/select) prompt whenever it
detects ANY drift between the schema file and live DB — not just for the new
table/column you're adding. In a long-lived project this often means pre-existing,
unrelated drift (e.g. a unique constraint or column added directly via SQL earlier)
also triggers a prompt, and prompts are one-at-a-time, not batchable.

**Why:** Piping input (e.g. `\r`) to auto-advance works for exactly one prompt: if
there are multiple unrelated drift prompts queued up, the automated input can
misfire and cause `drizzle-kit` to try to "recreate" existing tables instead of
just adding the new one — risking data loss on tables that were never meant to
be touched.

**How to apply:** For a small, purely additive schema change (new table, new
column, new enum) on a project with known pre-existing drift, don't fight the
interactive push. Instead: add the table/column to the Drizzle schema file (for
type-safety and future consumers), then apply the actual DDL via raw SQL (e.g.
`CREATE TABLE ...` / `ALTER TABLE ... ADD COLUMN ...`) through a direct DB
connection. Verify afterward with `tsc --noEmit` on the `db` package that the
schema file and live table agree.
