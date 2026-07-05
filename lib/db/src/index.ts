import path from "node:path";

const sqlitePath = process.env.SQLITE_PATH;
const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!sqlitePath && !connectionString) {
  throw new Error("DATABASE_URL or SQLITE_PATH must be set.");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pool: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sqlite: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _schema: any;

if (sqlitePath) {
  // ─── Offline SQLite mode (better-sqlite3 — native, no WASM, works in Node.js) ───
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error — better-sqlite3 loaded at EXE runtime from server-bundle/node_modules
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sqliteSchema = await import("./sqlite-schema/index.js" as any);

  const dbPath = path.join(sqlitePath, "bizcor.db");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _sqlite = new (Database as any)(dbPath);
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("busy_timeout = 5000");
  _sqlite.pragma("foreign_keys = ON");

  // Auto-migrate missing columns (safe — each in try/catch, SQLite ignores if already exists)
  const migrations = [
    "ALTER TABLE businesses ADD COLUMN pending_token TEXT",
    "ALTER TABLE businesses ADD COLUMN voucher_code TEXT",
    "ALTER TABLE businesses ADD COLUMN activation_type TEXT DEFAULT 'cloud'",
    "ALTER TABLE businesses ADD COLUMN referral_code TEXT",
    "ALTER TABLE businesses ADD COLUMN referred_by TEXT",
    "ALTER TABLE businesses ADD COLUMN referral_count INTEGER DEFAULT 0",
    "ALTER TABLE businesses ADD COLUMN bonus_days_added INTEGER DEFAULT 0",
    // Required by Drizzle schema — must exist before ANY route runs (including login)
    "ALTER TABLE businesses ADD COLUMN package_config TEXT",
    "ALTER TABLE businesses ADD COLUMN logo TEXT",
    "ALTER TABLE businesses ADD COLUMN active_voucher_id INTEGER",
    "ALTER TABLE businesses ADD COLUMN referral_reward_count INTEGER DEFAULT 0",
    "ALTER TABLE businesses ADD COLUMN referral_rewarded_at TEXT",
    "ALTER TABLE businesses ADD COLUMN plan_start_date TEXT",
    // plans table — package_config added to plansTable schema (login queries plans)
    "ALTER TABLE plans ADD COLUMN package_config TEXT",
    // parties — unique codes per type
    "ALTER TABLE parties ADD COLUMN customer_code TEXT",
    "ALTER TABLE parties ADD COLUMN supplier_code TEXT",
    "ALTER TABLE parties ADD COLUMN pin TEXT",
    `CREATE TABLE IF NOT EXISTS activation_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      business_code TEXT NOT NULL,
      business_name TEXT,
      business_email TEXT,
      hardware_fingerprint TEXT,
      ip TEXT,
      exe_version TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT
    )`,
  ];
  for (const stmt of migrations) {
    try { _sqlite.prepare(stmt).run(); } catch { /* column already exists */ }
  }

  db = drizzle(_sqlite, { schema: sqliteSchema });
  _schema = sqliteSchema;
} else {
  // ─── Cloud PostgreSQL mode (Supabase / Neon / etc.) ──────────────────────────
  const { default: pg } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pgSchema = await import("./schema/index.js");

  const isSupabase = /supabase\.(com|co)/.test(connectionString!) || connectionString!.includes("pooler.supabase");
  const isNeon = connectionString!.includes("neon.tech");
  const sslDisabled = process.env.DB_SSL === "false";
  const sslForced = process.env.DB_SSL === "true";
  const useSSL = !sslDisabled && (sslForced || isSupabase || isNeon || process.env.NODE_ENV === "production");

  pool = new pg.Pool({
    connectionString: connectionString!,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  db = drizzle(pool, { schema: pgSchema });
  _schema = pgSchema;

  // Auto-migrate missing columns (safe — IF NOT EXISTS, runs on every cold start)
  const pgMigrations = [
    "ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS template_id INTEGER",
    "ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS template_version INTEGER",
    "ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS rendered_snapshot JSONB",
    "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS pending_token TEXT",
    "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS voucher_code TEXT",
    "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS activation_type TEXT DEFAULT 'cloud'",
    "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS referral_code TEXT",
    "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS referred_by TEXT",
    "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0",
    "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS bonus_days_added INTEGER DEFAULT 0",
    "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS package_config TEXT",
    "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS logo TEXT",
    "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS active_voucher_id INTEGER",
    "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS referral_reward_count INTEGER DEFAULT 0",
    "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS referral_rewarded_at TIMESTAMPTZ",
    "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS plan_start_date TIMESTAMPTZ",
    "ALTER TABLE plans ADD COLUMN IF NOT EXISTS package_config TEXT",
    "ALTER TABLE parties ADD COLUMN IF NOT EXISTS customer_code TEXT",
    "ALTER TABLE parties ADD COLUMN IF NOT EXISTS supplier_code TEXT",
    "ALTER TABLE parties ADD COLUMN IF NOT EXISTS pin TEXT",
    `DO $$ BEGIN
      CREATE TYPE connection_status AS ENUM ('active', 'blocked');
    EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `DO $$ BEGIN
      CREATE TYPE chat_sender_type AS ENUM ('customer', 'business');
    EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `CREATE TABLE IF NOT EXISTS mini_app_customers (
      id SERIAL PRIMARY KEY,
      customer_id TEXT NOT NULL UNIQUE,
      mobile TEXT NOT NULL UNIQUE,
      pin TEXT NOT NULL DEFAULT '1234',
      name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS mini_app_connections (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES mini_app_customers(id),
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      party_id INTEGER NOT NULL REFERENCES parties(id),
      permissions JSONB NOT NULL DEFAULT '{"invoice":true,"payment":true,"statement":true,"gallery":false}',
      status connection_status NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS mini_app_chat_messages (
      id SERIAL PRIMARY KEY,
      connection_id INTEGER NOT NULL REFERENCES mini_app_connections(id),
      sender_type chat_sender_type NOT NULL,
      sender_name TEXT,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `DO $$ BEGIN
      CREATE TYPE account_type AS ENUM ('cash', 'bank');
    EXCEPTION WHEN duplicate_object THEN null; END $$`,
    `CREATE TABLE IF NOT EXISTS cash_bank_accounts (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      type account_type NOT NULL DEFAULT 'cash',
      bank_name TEXT,
      account_number TEXT,
      ifsc_code TEXT,
      opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
      is_default BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS expense_heads (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS expense_vouchers (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      expense_number TEXT NOT NULL,
      date TEXT NOT NULL,
      expense_head_id INTEGER REFERENCES expense_heads(id),
      account_id INTEGER REFERENCES cash_bank_accounts(id),
      amount NUMERIC(15,2) NOT NULL,
      payment_mode TEXT NOT NULL DEFAULT 'cash',
      reference_number TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS contra_entries (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      contra_number TEXT NOT NULL,
      date TEXT NOT NULL,
      from_account_id INTEGER NOT NULL REFERENCES cash_bank_accounts(id),
      to_account_id INTEGER NOT NULL REFERENCES cash_bank_accounts(id),
      amount NUMERIC(15,2) NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES cash_bank_accounts(id)",
    `CREATE TABLE IF NOT EXISTS activation_requests (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL,
      business_code TEXT NOT NULL,
      business_name TEXT,
      business_email TEXT,
      hardware_fingerprint TEXT,
      ip TEXT,
      exe_version TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ
    )`,
  ];
  for (const stmt of pgMigrations) {
    try { await pool.query(stmt); } catch { /* ignore if already exists */ }
  }
}

export { db, pool };

// Raw SQLite connection — used in api-server for DDL (CREATE TABLE)
export const sqlite = _sqlite;

// ─── Schema table exports ────────────────────────────────────────────────────
// At runtime: either SQLite or PG table objects, depending on mode.
// TypeScript sees the PG types (for route type-checking). esbuild ignores TS errors.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const s = _schema as typeof import("./schema/index.js");

export const superAdminsTable = s.superAdminsTable;
export const plansTable = s.plansTable;
export const businessesTable = s.businessesTable;
export const appSettingsTable = s.appSettingsTable;
export const licenseVouchersTable = s.licenseVouchersTable;
export const usersTable = s.usersTable;
export const loginLogsTable = s.loginLogsTable;
export const unitsTable = s.unitsTable;
export const hsnCodesTable = s.hsnCodesTable;
export const taxRatesTable = s.taxRatesTable;
export const statesTable = s.statesTable;
export const customFieldsTable = s.customFieldsTable;
export const partiesTable = s.partiesTable;
export const itemsTable = s.itemsTable;
export const vouchersTable = s.vouchersTable;
export const voucherItemsTable = s.voucherItemsTable;
export const paymentsTable = s.paymentsTable;
export const paymentAllocationsTable = s.paymentAllocationsTable;
export const cashBankAccountsTable = s.cashBankAccountsTable;
export const expenseHeadsTable = s.expenseHeadsTable;
export const expenseVouchersTable = s.expenseVouchersTable;
export const contraEntriesTable = s.contraEntriesTable;
export const supportMessagesTable = s.supportMessagesTable;
export const chatMessagesTable = s.chatMessagesTable;
export const reportTemplatesTable = s.reportTemplatesTable;
export const customersTable = s.customersTable;
export const connectionsTable = s.connectionsTable;
export const customerChatMessagesTable = s.customerChatMessagesTable;

// Re-export PG types for TypeScript consumers (routes, etc.)
export type * from "./schema";
