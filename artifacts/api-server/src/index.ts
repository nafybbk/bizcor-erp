import app from "./app";
import { logger } from "./lib/logger";
import { db, sqlite, superAdminsTable } from "@workspace/db";
import bcrypt from "bcryptjs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const isOfflineMode = !!process.env.SQLITE_PATH;

// ─── SQLite Init (offline mode) ───────────────────────────────────────────────
// Uses the raw better-sqlite3 connection to create all tables synchronously.
// SQLite-compatible SQL only — no SERIAL, no ENUM types, no PG casts.

function runSqliteInit() {
  if (!sqlite) return;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS super_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      plain_password TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price TEXT NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      max_users INTEGER NOT NULL DEFAULT 5,
      trial_days INTEGER NOT NULL DEFAULT 0,
      validity_days INTEGER NOT NULL DEFAULT 30,
      features TEXT,
      max_vouchers_per_month INTEGER,
      max_items INTEGER,
      max_parties INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      business_code TEXT NOT NULL UNIQUE,
      gstin TEXT,
      pan TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      state_code TEXT,
      pincode TEXT,
      phone TEXT,
      email TEXT,
      business_type TEXT,
      logo TEXT,
      plan_id INTEGER,
      plan_start_date TEXT,
      plan_expires_at TEXT,
      is_trial INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      financial_year_start TEXT DEFAULT '04-01',
      currency TEXT DEFAULT 'INR',
      invoice_prefix TEXT DEFAULT 'SI',
      credit_note_prefix TEXT DEFAULT 'CN',
      bill_prefix TEXT DEFAULT 'PB',
      debit_note_prefix TEXT DEFAULT 'DN',
      serial_number_mode TEXT DEFAULT 'auto',
      number_series INTEGER DEFAULT 1,
      number_digits INTEGER DEFAULT 4,
      number_separator TEXT DEFAULT '-',
      si_start_number INTEGER DEFAULT 1,
      cn_start_number INTEGER DEFAULT 1,
      pb_start_number INTEGER DEFAULT 1,
      dn_start_number INTEGER DEFAULT 1,
      bank_name TEXT,
      bank_account TEXT,
      bank_ifsc TEXT,
      bank_branch TEXT,
      signatory_name TEXT,
      invoice_footer TEXT,
      print_show_prefix INTEGER DEFAULT 1,
      print_show_series INTEGER DEFAULT 1,
      print_show_zeros INTEGER DEFAULT 1,
      referral_code TEXT UNIQUE,
      referred_by TEXT,
      referral_count INTEGER NOT NULL DEFAULT 0,
      referral_reward_count INTEGER NOT NULL DEFAULT 0,
      referral_rewarded_at TEXT,
      bonus_days_added INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS license_vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      plan_id INTEGER NOT NULL,
      validity_days INTEGER NOT NULL DEFAULT 30,
      selling_price TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      generated_by INTEGER,
      redeemed_by_business_id INTEGER,
      redeemed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      plain_password TEXT,
      role TEXT NOT NULL DEFAULT 'staff',
      permissions TEXT,
      can_edit INTEGER NOT NULL DEFAULT 1,
      can_delete INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      login_pin TEXT,
      session_token TEXT,
      last_seen_at TEXT,
      last_login_at TEXT,
      last_login_ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      business_id INTEGER,
      user_name TEXT,
      business_name TEXT,
      role TEXT,
      ip_address TEXT,
      user_agent TEXT,
      latitude TEXT,
      longitude TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hsn_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      description TEXT,
      tax_rate TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tax_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      rate TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      entity TEXT NOT NULL,
      field_name TEXT NOT NULL,
      field_label TEXT NOT NULL,
      field_type TEXT NOT NULL DEFAULT 'text',
      options TEXT,
      is_required INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      gstin TEXT,
      pan TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      state_code TEXT,
      pincode TEXT,
      opening_balance TEXT DEFAULT '0',
      opening_balance_type TEXT DEFAULT 'debit',
      credit_limit TEXT DEFAULT '0',
      credit_days INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      custom_fields TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'goods',
      hsn_code TEXT,
      unit_id INTEGER,
      tax_rate_id INTEGER,
      sale_price TEXT DEFAULT '0',
      purchase_price TEXT DEFAULT '0',
      opening_stock TEXT DEFAULT '0',
      low_stock_alert TEXT DEFAULT '0',
      is_active INTEGER NOT NULL DEFAULT 1,
      custom_fields TEXT,
      shipping_addresses TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      voucher_type TEXT NOT NULL,
      voucher_number TEXT NOT NULL,
      date TEXT NOT NULL,
      party_id INTEGER NOT NULL,
      billing_address TEXT,
      use_shipping_address INTEGER DEFAULT 0,
      shipping_address TEXT,
      sub_total TEXT DEFAULT '0',
      total_discount TEXT DEFAULT '0',
      taxable_amount TEXT DEFAULT '0',
      total_cgst TEXT DEFAULT '0',
      total_sgst TEXT DEFAULT '0',
      total_igst TEXT DEFAULT '0',
      total_tax TEXT DEFAULT '0',
      transport_charges TEXT DEFAULT '0',
      transport_name TEXT,
      round_off TEXT DEFAULT '0',
      grand_total TEXT NOT NULL DEFAULT '0',
      paid_amount TEXT DEFAULT '0',
      status TEXT NOT NULL DEFAULT 'posted',
      notes TEXT,
      terms_and_conditions TEXT,
      linked_voucher_id INTEGER,
      is_inter_state INTEGER DEFAULT 0,
      place_of_supply TEXT,
      custom_fields TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS voucher_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_id INTEGER NOT NULL,
      item_id INTEGER,
      item_name TEXT NOT NULL,
      description TEXT,
      hsn_code TEXT,
      quantity TEXT NOT NULL,
      unit TEXT,
      rate TEXT NOT NULL,
      discount TEXT DEFAULT '0',
      discount_type TEXT DEFAULT 'percent',
      taxable_amount TEXT NOT NULL,
      tax_rate_id INTEGER,
      tax_rate TEXT DEFAULT '0',
      cgst TEXT DEFAULT '0',
      sgst TEXT DEFAULT '0',
      igst TEXT DEFAULT '0',
      tax_amount TEXT DEFAULT '0',
      total TEXT NOT NULL,
      custom_fields TEXT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      payment_number TEXT NOT NULL,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      party_id INTEGER NOT NULL,
      amount TEXT NOT NULL,
      payment_mode TEXT NOT NULL DEFAULT 'cash',
      reference_number TEXT,
      notes TEXT,
      is_on_account INTEGER NOT NULL DEFAULT 0,
      account_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payment_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      voucher_id INTEGER NOT NULL,
      allocated_amount TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cash_bank_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'cash',
      bank_name TEXT,
      account_number TEXT,
      ifsc_code TEXT,
      opening_balance TEXT NOT NULL DEFAULT '0',
      is_default INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expense_heads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expense_vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      expense_number TEXT NOT NULL,
      date TEXT NOT NULL,
      expense_head_id INTEGER,
      account_id INTEGER,
      amount TEXT NOT NULL,
      payment_mode TEXT NOT NULL DEFAULT 'cash',
      reference_number TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contra_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      contra_number TEXT NOT NULL,
      date TEXT NOT NULL,
      from_account_id INTEGER NOT NULL,
      to_account_id INTEGER NOT NULL,
      amount TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      from_user_id INTEGER NOT NULL,
      from_user_name TEXT NOT NULL,
      message TEXT,
      file_path TEXT,
      file_name TEXT,
      file_mime_type TEXT,
      file_size INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS chat_messages_business_idx ON chat_messages(business_id, id);
  `);

  logger.info("SQLite schema initialized — all tables ready");
}

// ─── SQLite Migrations (offline EXE — safe ALTER TABLE for existing databases) ─
function runSqliteMigrations() {
  if (!sqlite) return;
  // Each migration wrapped in try-catch — silently skips if column already exists
  const migrations = [
    // vouchers — CRITICAL: without deleted_at all voucher list queries fail
    "ALTER TABLE vouchers ADD COLUMN deleted_at TEXT",
    "ALTER TABLE vouchers ADD COLUMN transport_name TEXT",
    // businesses — new settings columns
    "ALTER TABLE businesses ADD COLUMN si_start_number INTEGER DEFAULT 1",
    "ALTER TABLE businesses ADD COLUMN cn_start_number INTEGER DEFAULT 1",
    "ALTER TABLE businesses ADD COLUMN pb_start_number INTEGER DEFAULT 1",
    "ALTER TABLE businesses ADD COLUMN dn_start_number INTEGER DEFAULT 1",
    "ALTER TABLE businesses ADD COLUMN serial_number_mode TEXT DEFAULT 'auto'",
    "ALTER TABLE businesses ADD COLUMN number_series INTEGER DEFAULT 1",
    "ALTER TABLE businesses ADD COLUMN number_digits INTEGER DEFAULT 4",
    "ALTER TABLE businesses ADD COLUMN number_separator TEXT DEFAULT '-'",
    "ALTER TABLE businesses ADD COLUMN bank_name TEXT",
    "ALTER TABLE businesses ADD COLUMN bank_account TEXT",
    "ALTER TABLE businesses ADD COLUMN bank_ifsc TEXT",
    "ALTER TABLE businesses ADD COLUMN bank_branch TEXT",
    "ALTER TABLE businesses ADD COLUMN signatory_name TEXT",
    "ALTER TABLE businesses ADD COLUMN invoice_footer TEXT",
    "ALTER TABLE businesses ADD COLUMN print_show_prefix INTEGER DEFAULT 1",
    "ALTER TABLE businesses ADD COLUMN print_show_series INTEGER DEFAULT 1",
    "ALTER TABLE businesses ADD COLUMN print_show_zeros INTEGER DEFAULT 1",
    "ALTER TABLE businesses ADD COLUMN referral_code TEXT",
    "ALTER TABLE businesses ADD COLUMN referred_by TEXT",
    "ALTER TABLE businesses ADD COLUMN referral_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE businesses ADD COLUMN referral_reward_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE businesses ADD COLUMN referral_rewarded_at TEXT",
    "ALTER TABLE businesses ADD COLUMN bonus_days_added INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE businesses ADD COLUMN plan_start_date TEXT",
    "ALTER TABLE businesses ADD COLUMN is_trial INTEGER NOT NULL DEFAULT 0",
    // users — new columns
    "ALTER TABLE users ADD COLUMN plain_password TEXT",
    "ALTER TABLE users ADD COLUMN login_pin TEXT",
    "ALTER TABLE users ADD COLUMN session_token TEXT",
    "ALTER TABLE users ADD COLUMN last_seen_at TEXT",
    "ALTER TABLE users ADD COLUMN last_login_at TEXT",
    "ALTER TABLE users ADD COLUMN last_login_ip TEXT",
    "ALTER TABLE users ADD COLUMN can_edit INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE users ADD COLUMN can_delete INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE users ADD COLUMN app_source TEXT DEFAULT 'bizcor'",
    // items — columns added in later versions
    "ALTER TABLE items ADD COLUMN low_stock_alert TEXT DEFAULT '0'",
    "ALTER TABLE items ADD COLUMN shipping_addresses TEXT",
    // parties — columns added in later versions
    "ALTER TABLE parties ADD COLUMN credit_limit TEXT DEFAULT '0'",
    "ALTER TABLE parties ADD COLUMN credit_days INTEGER DEFAULT 0",
    "ALTER TABLE parties ADD COLUMN pan TEXT",
    "ALTER TABLE parties ADD COLUMN email TEXT",
    "ALTER TABLE parties ADD COLUMN city TEXT",
    "ALTER TABLE parties ADD COLUMN pincode TEXT",
    // payments — account_id for Cash & Bank linking
    "ALTER TABLE payments ADD COLUMN account_id INTEGER",
    // payments — soft delete (bin)
    "ALTER TABLE payments ADD COLUMN deleted_at TEXT",
    // businesses — active_voucher_id for exact license tracking
    "ALTER TABLE businesses ADD COLUMN active_voucher_id INTEGER",
  ];
  let applied = 0;
  for (const stmt of migrations) {
    try { sqlite.exec(stmt); applied++; } catch { /* column already exists — skip */ }
  }
  logger.info({ applied }, "SQLite migrations done");
}

// ─── PG Migrations (cloud mode only) ─────────────────────────────────────────

import { sql } from "drizzle-orm";

async function runPgMigrations() {
  try {
    await db.execute(sql`ALTER TABLE super_admins ADD COLUMN IF NOT EXISTS avatar TEXT`);
    await db.execute(sql`ALTER TABLE super_admins ADD COLUMN IF NOT EXISTS plain_password TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS si_start_number INTEGER DEFAULT 1`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cn_start_number INTEGER DEFAULT 1`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS pb_start_number INTEGER DEFAULT 1`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS dn_start_number INTEGER DEFAULT 1`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS serial_number_mode TEXT DEFAULT 'auto'`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS number_series INTEGER DEFAULT 1`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS number_digits INTEGER DEFAULT 4`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS number_separator TEXT DEFAULT '-'`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS referral_code TEXT`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS referred_by TEXT`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS referral_count INTEGER NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS bonus_days_added INTEGER NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS plan_start_date TIMESTAMP`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS signatory_name TEXT`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS invoice_footer TEXT`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS bank_name TEXT`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS bank_account TEXT`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS bank_ifsc TEXT`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS bank_branch TEXT`);
    await db.execute(sql`ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS transport_name TEXT`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS print_show_prefix BOOLEAN DEFAULT TRUE`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS print_show_series BOOLEAN DEFAULT TRUE`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS print_show_zeros BOOLEAN DEFAULT TRUE`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_pin TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip TEXT`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS referral_reward_count INTEGER NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS referral_rewarded_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS pending_token TEXT`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS invoice_template TEXT DEFAULT 'classic'`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS login_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER, business_id INTEGER, user_name TEXT, business_name TEXT,
        role TEXT, ip_address TEXT, user_agent TEXT,
        latitude NUMERIC(10,7), longitude NUMERIC(10,7),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS license_vouchers (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        plan_id INTEGER NOT NULL,
        validity_days INTEGER NOT NULL DEFAULT 30,
        selling_price NUMERIC(10,2),
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT, generated_by INTEGER, redeemed_by_business_id INTEGER,
        redeemed_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE, value TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_message_status') THEN
          CREATE TYPE support_message_status AS ENUM ('new', 'read', 'replied');
        END IF;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_message_sender') THEN
          CREATE TYPE support_message_sender AS ENUM ('user', 'admin');
        END IF;
      END $$
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS support_messages (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        sender_type support_message_sender NOT NULL DEFAULT 'user',
        name TEXT,
        phone TEXT,
        email TEXT,
        message TEXT NOT NULL,
        status support_message_status NOT NULL DEFAULT 'new',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS support_messages_session_idx ON support_messages(session_id)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL,
        from_user_id INTEGER NOT NULL,
        from_user_name TEXT NOT NULL,
        message TEXT,
        file_path TEXT,
        file_name TEXT,
        file_mime_type TEXT,
        file_size INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS chat_messages_business_idx ON chat_messages(business_id, id)
    `);
    await db.execute(sql`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='file_data') THEN
          ALTER TABLE chat_messages DROP COLUMN file_data;
        END IF;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='file_path') THEN
          ALTER TABLE chat_messages ADD COLUMN file_path TEXT;
        END IF;
      END $$
    `);
    logger.info("PG migrations applied");
  } catch (err) {
    logger.error({ err }, "PG migration failed (non-fatal)");
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
      logger.info("Default super admin created: admin@bizerp.in / Tech@1234");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed super admin");
  }
}

app.listen(port, "0.0.0.0", async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, mode: isOfflineMode ? "offline-sqlite" : "cloud-postgres", version: "2.3.6" }, "Server listening");

  if (isOfflineMode) {
    // SQLite: create all tables, then run migrations for existing DBs
    runSqliteInit();
    runSqliteMigrations();
  } else {
    // PostgreSQL: run incremental migrations
    await runPgMigrations();
  }

  await seedSuperAdmin();
});
