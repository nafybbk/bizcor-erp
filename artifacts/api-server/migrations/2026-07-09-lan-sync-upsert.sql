-- 2026-07-09 — LAN sync upsert support (additive only)
-- Run against production Supabase (bljbfuqtcokadfroufsx).
-- Purpose: lets a re-pushed voucher/payment REPLACE its previous copy instead of
-- duplicating, and lets deletions be marked so the mini app stops showing them.
-- Both tables were verified EMPTY before index creation (no dedup needed).

CREATE UNIQUE INDEX IF NOT EXISTS mini_app_lan_vouchers_biz_ext_type_idx
  ON mini_app_lan_vouchers (business_id, external_id, voucher_type);

CREATE UNIQUE INDEX IF NOT EXISTS mini_app_lan_payments_biz_ext_type_idx
  ON mini_app_lan_payments (business_id, external_id, payment_type);

ALTER TABLE mini_app_lan_payments
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'posted';
