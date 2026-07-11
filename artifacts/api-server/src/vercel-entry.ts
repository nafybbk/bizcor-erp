import app from "./app";
import { db, pool, superAdminsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

let migrated = false;

// Bump this whenever a new statement is added to runMigrations() below.
// Cold starts check schema_meta.version first — if it matches, the whole
// migration pass (50+ ALTERs, 20-60s on a cold Neon connection) is skipped,
// so the first request after a cold start responds fast instead of hanging
// the mini-app login spinner.
const MIGRATION_VERSION = 2;

async function migrationsAlreadyApplied(): Promise<boolean> {
  try {
    const client = pool as any;
    if (!client) return false;
    await client.query(`CREATE TABLE IF NOT EXISTS schema_meta (id INTEGER PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0)`);
    const r = await client.query(`SELECT version FROM schema_meta WHERE id = 1`);
    return (r.rows?.[0]?.version ?? 0) >= MIGRATION_VERSION;
  } catch {
    return false;
  }
}

// Raw pg query — works directly with the pool (same as routes use)
async function q(text: string) {
  try {
    if (pool) {
      await (pool as any).query(text);
    } else {
      await db.execute(sql.raw(text));
    }
  } catch (err) {
    // log so we can see in Vercel function logs
    console.error("[migration] failed:", text.slice(0, 60), "|", err instanceof Error ? err.message : err);
  }
}

async function runMigrations() {
  if (migrated) return;
  migrated = true;

  // ── NEW TABLES — must exist before any route is hit ──────────────────────
  await q(`CREATE TABLE IF NOT EXISTS support_messages (
    id SERIAL PRIMARY KEY, session_id TEXT NOT NULL,
    sender_type TEXT NOT NULL DEFAULT 'user',
    name TEXT, phone TEXT, email TEXT,
    message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await q(`CREATE INDEX IF NOT EXISTS support_messages_session_idx ON support_messages(session_id)`);

  await q(`CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY, business_id INTEGER NOT NULL,
    from_user_id INTEGER NOT NULL, from_user_name TEXT NOT NULL,
    message TEXT, file_path TEXT, file_name TEXT,
    file_mime_type TEXT, file_size INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await q(`CREATE INDEX IF NOT EXISTS chat_messages_business_idx ON chat_messages(business_id, id)`);

  await q(`CREATE TABLE IF NOT EXISTS login_logs (
    id SERIAL PRIMARY KEY, user_id INTEGER, business_id INTEGER,
    user_name TEXT, business_name TEXT, role TEXT,
    ip_address TEXT, user_agent TEXT,
    latitude NUMERIC(10,7), longitude NUMERIC(10,7),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  await q(`CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id SERIAL PRIMARY KEY, credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL, counter INTEGER NOT NULL DEFAULT 0,
    super_admin_id INTEGER NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  await q(`CREATE TABLE IF NOT EXISTS cash_bank_accounts (
    id SERIAL PRIMARY KEY, business_id INTEGER NOT NULL,
    name TEXT NOT NULL, account_type TEXT NOT NULL DEFAULT 'bank',
    opening_balance NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  // ── ALTER COLUMNS ─────────────────────────────────────────────────────────
  await q(`ALTER TABLE super_admins ADD COLUMN IF NOT EXISTS avatar TEXT`);
  await q(`ALTER TABLE super_admins ADD COLUMN IF NOT EXISTS plain_password TEXT`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password TEXT`);
  await q(`ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS transport_name TEXT`);
  await q(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS print_show_prefix BOOLEAN DEFAULT TRUE`);
  await q(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS print_show_series BOOLEAN DEFAULT TRUE`);
  await q(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS print_show_zeros BOOLEAN DEFAULT TRUE`);
  await q(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS invoice_template TEXT DEFAULT 'classic'`);
  await q(`ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS reference_number TEXT`);
  await q(`ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS due_date TEXT`);
  await q(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS active_voucher_id INTEGER`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS business_id INTEGER`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS app_source TEXT DEFAULT 'fabricpro'`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit BOOLEAN DEFAULT TRUE`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_delete BOOLEAN DEFAULT TRUE`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_pin TEXT`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip TEXT`);
  await q(`ALTER TABLE mini_app_connections ADD COLUMN IF NOT EXISTS customer_paused BOOLEAN NOT NULL DEFAULT FALSE`);
  await q(`ALTER TABLE mini_app_lan_vouchers ADD COLUMN IF NOT EXISTS items JSONB`);
  await q(`ALTER TABLE payments ALTER COLUMN from_user_id DROP NOT NULL`);
  await q(`ALTER TABLE payments ALTER COLUMN to_user_id DROP NOT NULL`);
  await q(`ALTER TABLE payments ALTER COLUMN connection_id DROP NOT NULL`);
  await q(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS business_id INTEGER`);
  await q(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_number TEXT`);
  await q(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='payment_type') THEN CREATE TYPE payment_type AS ENUM ('receipt','payment'); END IF; END $$`);
  await q(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='payment_mode') THEN CREATE TYPE payment_mode AS ENUM ('cash','bank','cheque','upi','other'); END IF; END $$`);
  await q(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS type payment_type`);
  await q(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS date TEXT`);
  await q(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS party_id INTEGER`);
  await q(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_mode payment_mode DEFAULT 'cash'`);
  await q(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_number TEXT`);
  await q(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT`);
  await q(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_on_account BOOLEAN DEFAULT FALSE`);
  await q(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS account_id INTEGER`);
  await q(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);
  await q(`ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);
  await q(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS package_config JSONB`);

  await q(`INSERT INTO schema_meta (id, version) VALUES (1, ${MIGRATION_VERSION})
    ON CONFLICT (id) DO UPDATE SET version = ${MIGRATION_VERSION}`);

  // ── SEED super admin password ─────────────────────────────────────────────
  try {
    const hash = await bcrypt.hash("031975", 10);
    await db.execute(sql`
      UPDATE super_admins SET password_hash = ${hash}, plain_password = '031975'
      WHERE phone = '7905282816'
    `);
  } catch {
    // ignore
  }
}

async function seedSuperAdmin() {
  try {
    const existing = await db.select().from(superAdminsTable).limit(1);
    if (existing.length === 0) {
      const hash = await bcrypt.hash("Tech@1234", 10);
      await db.insert(superAdminsTable).values({
        name: "Admin",
        email: "admin@bizerp.in",
        phone: "9999999999",
        passwordHash: hash,
        isActive: true,
      });
    }
  } catch {
    // ignore seed errors
  }
}

if (!(await migrationsAlreadyApplied())) {
  await runMigrations();
  await seedSuperAdmin();
}

export default app;
