---
name: Supabase DB identity verification
description: How to positively confirm which physical Supabase project a connection string points to before trusting any query result, and pooler-string gotchas.
---

## Lesson
A configured `SUPABASE_DATABASE_URL` secret can silently point to the WRONG Supabase
project even if it "looks" like the right one (same app name shown in the Supabase
dashboard breadcrumb does NOT guarantee same project — there can be multiple
similarly-named projects, or leftover URLs from unrelated apps sharing the same
Replit account/secrets).

**Why:** In this project, `SUPABASE_DATABASE_URL` was pointing to project ref
`byboobszokaiupxatcup` ("naewtdb", an unrelated app's DB with polluted/merged
tables), while the actual BizCor production project was `bljbfuqtcokadfroufsx`.
Query results looked plausible (real-looking business names) which almost caused
a destructive cleanup to run against the wrong database.

**How to apply:** Before trusting any DB analysis, positively verify identity:
- Compare the project ref in the connection string's host/user
  (`postgres.<ref>@...pooler.supabase.com` or `db.<ref>.supabase.co`) against the
  project ref visible in the Supabase dashboard URL
  (`supabase.com/dashboard/project/<ref>/...`) — ask the user for a screenshot/URL
  if unsure.
- Cross-check actual row-level data (e.g. exact row count and a sample of business
  names) against what the user sees in their own dashboard Table Editor. A count
  mismatch (e.g. 16 vs 38 rows) is a hard signal of wrong DB, even if some sample
  rows coincidentally look similar.
- If a `psql` connection fails with an opaque empty `psql: error:` (no message),
  suspect the host resolves to an IPv6-only address (Supabase "Direct connection"
  host `db.<ref>.supabase.co`) which this sandbox cannot reach. Use the "Transaction
  pooler" connection string instead (host `aws-<n>-<region>.pooler.supabase.com`,
  port 6543, username `postgres.<project-ref>` — note the dot-suffixed username,
  different from the direct-connection username which is plain `postgres`).
- Passwords containing `@` must be percent-encoded as `%40` in the URI, or the URL
  parser misreads the userinfo/host boundary.
