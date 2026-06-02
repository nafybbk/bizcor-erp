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

// Re-export PG types for TypeScript consumers (routes, etc.)
export type * from "./schema";
