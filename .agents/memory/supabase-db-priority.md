---
name: SUPABASE_DATABASE_URL takes priority over DATABASE_URL at runtime
description: Why a table/migration created via the executeSql tool can be invisible to the running app, and how to apply schema changes to the DB the app actually uses.
---

## Lesson
When both `SUPABASE_DATABASE_URL` and `DATABASE_URL` secrets are set, `lib/db/src/index.ts`
prefers `SUPABASE_DATABASE_URL` — so the running api-server talks to Supabase, NOT the
Replit-managed dev Postgres.

**Why:** The `database` skill's `executeSql` tool only runs against Replit's own
built-in DB (`DATABASE_URL`). A new table created that way exists there, but the live
app never sees it — it 500s with `relation "..." does not exist` because it's actually
connected to Supabase. This caused a real production bug (`module_patches` table).

**How to apply:**
- Before creating/altering a table, check which connection string the app's DB client
  actually uses at runtime (grep the db package's connection-selection logic).
- If it's Supabase, `executeSql` cannot reach it. Run DDL with a raw `pg` client
  against `SUPABASE_DATABASE_URL` instead — the `pg` package usually isn't hoisted to
  workspace root `node_modules`, so resolve it from `.pnpm` (e.g.
  `node_modules/.pnpm/pg@<version>/node_modules/pg`) or run the script via `bash`/`node -e`
  (not the code_execution sandbox — `process.env` secrets aren't exposed there).
- Always verify Supabase project identity first — see `supabase-db-verification.md`.
