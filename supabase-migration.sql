-- ============================================================
-- BizERP — Full Database Migration for Supabase
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- ── 1. ENUM TYPES ─────────────────────────────────────────

CREATE TYPE balance_type       AS ENUM ('debit', 'credit');
CREATE TYPE billing_cycle      AS ENUM ('monthly', 'yearly');
CREATE TYPE business_status    AS ENUM ('active', 'inactive', 'suspended', 'trial');
CREATE TYPE custom_field_entity AS ENUM ('item', 'party', 'voucher', 'voucher_item');
CREATE TYPE custom_field_type  AS ENUM ('text', 'number', 'date', 'boolean', 'select');
CREATE TYPE discount_type      AS ENUM ('percent', 'amount');
CREATE TYPE item_type          AS ENUM ('goods', 'service');
CREATE TYPE party_type         AS ENUM ('customer', 'supplier', 'both');
CREATE TYPE payment_mode       AS ENUM ('cash', 'bank', 'cheque', 'upi', 'other');
CREATE TYPE payment_type       AS ENUM ('receipt', 'payment');
CREATE TYPE user_role          AS ENUM ('business_admin', 'staff');
CREATE TYPE voucher_status     AS ENUM ('draft', 'posted', 'paid', 'partial', 'cancelled');
CREATE TYPE voucher_type       AS ENUM ('sales_invoice', 'credit_note', 'purchase_bill', 'debit_note');

-- ── 2. SUPER ADMINS (Tech Support) ───────────────────────

CREATE TABLE super_admins (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. PLANS ──────────────────────────────────────────────

CREATE TABLE plans (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL,
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  max_users     INTEGER NOT NULL DEFAULT 5,
  features      TEXT[],
  is_active     BOOLEAN NOT NULL DEFAULT true,
  trial_days    INTEGER NOT NULL DEFAULT 0,
  validity_days INTEGER NOT NULL DEFAULT 30,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. BUSINESSES ─────────────────────────────────────────

CREATE TABLE businesses (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  business_code        TEXT NOT NULL UNIQUE,
  gstin                TEXT,
  pan                  TEXT,
  address              TEXT,
  city                 TEXT,
  state                TEXT,
  state_code           TEXT,
  pincode              TEXT,
  phone                TEXT,
  email                TEXT,
  business_type        TEXT,
  logo                 TEXT,
  plan_id              INTEGER REFERENCES plans(id),
  status               business_status NOT NULL DEFAULT 'active',
  financial_year_start TEXT DEFAULT '04-01',
  currency             TEXT DEFAULT 'INR',
  plan_start_date      TIMESTAMPTZ,
  plan_expires_at      TIMESTAMPTZ,
  is_trial             BOOLEAN NOT NULL DEFAULT false,
  invoice_prefix       TEXT DEFAULT 'SI',
  credit_note_prefix   TEXT DEFAULT 'CN',
  bill_prefix          TEXT DEFAULT 'PB',
  debit_note_prefix    TEXT DEFAULT 'DN',
  serial_number_mode   TEXT DEFAULT 'auto',
  number_digits        INTEGER DEFAULT 4,
  number_separator     TEXT DEFAULT '-',
  bank_name            TEXT,
  bank_account         TEXT,
  bank_ifsc            TEXT,
  bank_branch          TEXT,
  signatory_name       TEXT,
  invoice_footer       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. USERS ──────────────────────────────────────────────

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'staff',
  permissions   TEXT[] DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 6. APP SETTINGS ───────────────────────────────────────

CREATE TABLE app_settings (
  id         SERIAL PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 7. PARTIES ────────────────────────────────────────────

CREATE TABLE parties (
  id                    SERIAL PRIMARY KEY,
  business_id           INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  type                  party_type NOT NULL,
  gstin                 TEXT,
  pan                   TEXT,
  phone                 TEXT,
  email                 TEXT,
  address               TEXT,
  city                  TEXT,
  state                 TEXT,
  state_code            TEXT,
  pincode               TEXT,
  opening_balance       NUMERIC(15,2) DEFAULT 0,
  opening_balance_type  balance_type DEFAULT 'debit',
  credit_limit          NUMERIC(15,2) DEFAULT 0,
  credit_days           INTEGER DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  custom_fields         JSONB,
  shipping_addresses    JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 8. TAX RATES ──────────────────────────────────────────

CREATE TABLE tax_rates (
  id          SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  rate        NUMERIC(5,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 9. UNITS ──────────────────────────────────────────────

CREATE TABLE units (
  id          SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 10. HSN CODES ─────────────────────────────────────────

CREATE TABLE hsn_codes (
  id          SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  description TEXT,
  tax_rate    NUMERIC(5,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 11. ITEMS ─────────────────────────────────────────────

CREATE TABLE items (
  id               SERIAL PRIMARY KEY,
  business_id      INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  type             item_type NOT NULL DEFAULT 'goods',
  hsn_code         TEXT,
  unit_id          INTEGER REFERENCES units(id),
  tax_rate_id      INTEGER REFERENCES tax_rates(id),
  sale_price       NUMERIC(15,2) DEFAULT 0,
  purchase_price   NUMERIC(15,2) DEFAULT 0,
  opening_stock    NUMERIC(15,3) DEFAULT 0,
  low_stock_alert  NUMERIC(15,3) DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  custom_fields    JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 12. CUSTOM FIELDS ─────────────────────────────────────

CREATE TABLE custom_fields (
  id          SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  entity      custom_field_entity NOT NULL,
  field_name  TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type  custom_field_type NOT NULL DEFAULT 'text',
  options     TEXT[],
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 13. VOUCHERS ──────────────────────────────────────────

CREATE TABLE vouchers (
  id                 SERIAL PRIMARY KEY,
  business_id        INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  voucher_type       voucher_type NOT NULL,
  voucher_number     TEXT NOT NULL,
  date               TEXT NOT NULL,
  party_id           INTEGER NOT NULL REFERENCES parties(id),
  billing_address    TEXT,
  use_shipping_address BOOLEAN DEFAULT false,
  shipping_address   TEXT,
  sub_total          NUMERIC(15,2) DEFAULT 0,
  total_discount     NUMERIC(15,2) DEFAULT 0,
  taxable_amount     NUMERIC(15,2) DEFAULT 0,
  total_cgst         NUMERIC(15,2) DEFAULT 0,
  total_sgst         NUMERIC(15,2) DEFAULT 0,
  total_igst         NUMERIC(15,2) DEFAULT 0,
  total_tax          NUMERIC(15,2) DEFAULT 0,
  transport_charges  NUMERIC(15,2) DEFAULT 0,
  round_off          NUMERIC(15,2) DEFAULT 0,
  grand_total        NUMERIC(15,2) NOT NULL DEFAULT 0,
  paid_amount        NUMERIC(15,2) DEFAULT 0,
  status             voucher_status NOT NULL DEFAULT 'posted',
  notes              TEXT,
  terms_and_conditions TEXT,
  linked_voucher_id  INTEGER,
  is_inter_state     BOOLEAN DEFAULT false,
  place_of_supply    TEXT,
  custom_fields      JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 14. VOUCHER ITEMS ─────────────────────────────────────

CREATE TABLE voucher_items (
  id              SERIAL PRIMARY KEY,
  voucher_id      INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  item_id         INTEGER,
  item_name       TEXT NOT NULL,
  description     TEXT,
  hsn_code        TEXT,
  quantity        NUMERIC(15,3) NOT NULL,
  unit            TEXT,
  rate            NUMERIC(15,2) NOT NULL,
  discount        NUMERIC(15,2) DEFAULT 0,
  discount_type   discount_type DEFAULT 'percent',
  taxable_amount  NUMERIC(15,2) NOT NULL,
  tax_rate_id     INTEGER,
  tax_rate        NUMERIC(5,2) DEFAULT 0,
  cgst            NUMERIC(15,2) DEFAULT 0,
  sgst            NUMERIC(15,2) DEFAULT 0,
  igst            NUMERIC(15,2) DEFAULT 0,
  tax_amount      NUMERIC(15,2) DEFAULT 0,
  total           NUMERIC(15,2) NOT NULL,
  custom_fields   JSONB
);

-- ── 15. PAYMENTS ──────────────────────────────────────────

CREATE TABLE payments (
  id               SERIAL PRIMARY KEY,
  business_id      INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  payment_number   TEXT NOT NULL,
  type             payment_type NOT NULL,
  date             TEXT NOT NULL,
  party_id         INTEGER NOT NULL REFERENCES parties(id),
  amount           NUMERIC(15,2) NOT NULL,
  payment_mode     payment_mode NOT NULL DEFAULT 'cash',
  reference_number TEXT,
  notes            TEXT,
  is_on_account    BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 16. PAYMENT ALLOCATIONS ───────────────────────────────

CREATE TABLE payment_allocations (
  id               SERIAL PRIMARY KEY,
  payment_id       INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  voucher_id       INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(15,2) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 17. USEFUL INDEXES ────────────────────────────────────

CREATE INDEX idx_vouchers_business_id   ON vouchers(business_id);
CREATE INDEX idx_vouchers_party_id      ON vouchers(party_id);
CREATE INDEX idx_vouchers_date          ON vouchers(date);
CREATE INDEX idx_vouchers_type          ON vouchers(voucher_type);
CREATE INDEX idx_parties_business_id    ON parties(business_id);
CREATE INDEX idx_items_business_id      ON items(business_id);
CREATE INDEX idx_users_business_id      ON users(business_id);
CREATE INDEX idx_users_email            ON users(email);
CREATE INDEX idx_payments_business_id   ON payments(business_id);

-- ============================================================
-- Migration complete! Now register your first Super Admin:
-- UPDATE the email and password_hash below, then run it.
-- Generate bcrypt hash at: https://bcrypt-generator.com
-- ============================================================
-- INSERT INTO super_admins (name, email, password_hash)
-- VALUES ('Your Name', 'your@email.com', '$2b$10$...');
