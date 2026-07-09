-- 2026-07-09 — Activity Log (additive only)
-- Run against production Supabase (bljbfuqtcokadfroufsx).
-- Per-business user activity trail with before-snapshots for voucher edits/deletes.
-- Admin-only view + clear; optional per-business auto-cleanup retention.

CREATE TABLE IF NOT EXISTS activity_logs (
  id serial PRIMARY KEY,
  business_id integer NOT NULL REFERENCES businesses(id),
  user_id integer,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id integer,
  entity_label text,
  summary text NOT NULL,
  details jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_biz_created_idx
  ON activity_logs (business_id, created_at);

CREATE INDEX IF NOT EXISTS activity_logs_biz_entity_idx
  ON activity_logs (business_id, entity_type, entity_id);

-- Optional auto-cleanup: history older than this many days is purged (NULL = keep forever)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS activity_retention_days integer;
