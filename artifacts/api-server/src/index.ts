import app from "./app";
import { logger } from "./lib/logger";
import { db, superAdminsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const isOfflineMode = !!process.env.PGLITE_PATH;

// Full schema init for PGlite (fresh empty database on first run)
async function runInitSchema() {
  // ENUMs — CREATE TYPE IF NOT EXISTS (requires PG16+, PGlite uses PG17)
  const enumDefs = [
    `CREATE TYPE IF NOT EXISTS user_role AS ENUM ('business_admin', 'staff')`,
    `CREATE TYPE IF NOT EXISTS business_status AS ENUM ('active', 'inactive', 'suspended', 'trial')`,
    `CREATE TYPE IF NOT EXISTS billing_cycle AS ENUM ('monthly', 'yearly')`,
    `CREATE TYPE IF NOT EXISTS party_type AS ENUM ('customer', 'supplier', 'both')`,
    `CREATE TYPE IF NOT EXISTS balance_type AS ENUM ('debit', 'credit')`,
    `CREATE TYPE IF NOT EXISTS item_type AS ENUM ('goods', 'service')`,
    `CREATE TYPE IF NOT EXISTS custom_field_entity AS ENUM ('item', 'party', 'voucher', 'voucher_item')`,
    `CREATE TYPE IF NOT EXISTS custom_field_type AS ENUM ('text', 'number', 'date', 'boolean', 'select')`,
    `CREATE TYPE IF NOT EXISTS voucher_type AS ENUM ('sales_invoice', 'credit_note', 'purchase_bill', 'debit_note')`,
    `CREATE TYPE IF NOT EXISTS voucher_status AS ENUM ('draft', 'posted', 'paid', 'partial', 'cancelled')`,
    `CREATE TYPE IF NOT EXISTS discount_type AS ENUM ('percent', 'amount')`,
    `CREATE TYPE IF NOT EXISTS payment_type AS ENUM ('receipt', 'payment')`,
    `CREATE TYPE IF NOT EXISTS payment_mode AS ENUM ('cash', 'bank', 'cheque', 'upi', 'other')`,
    `CREATE TYPE IF NOT EXISTS account_type AS ENUM ('cash', 'bank')`,
  ];

  for (const enumSql of enumDefs) {
    await db.execute(sql.raw(enumSql));
  }

  // Tables in dependency order
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS super_admins (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      plain_password TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS plans (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price NUMERIC(10,2) NOT NULL,
      billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
      max_users INTEGER NOT NULL DEFAULT 5,
      trial_days INTEGER NOT NULL DEFAULT 0,
      validity_days INTEGER NOT NULL DEFAULT 30,
      features TEXT[],
      max_vouchers_per_month INTEGER,
      max_items INTEGER,
      max_parties INTEGER,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS businesses (
      id SERIAL PRIMARY KEY,
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
      plan_id INTEGER REFERENCES plans(id),
      plan_start_date TIMESTAMP,
      plan_expires_at TIMESTAMP,
      is_trial BOOLEAN NOT NULL DEFAULT FALSE,
      status business_status NOT NULL DEFAULT 'active',
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
      print_show_prefix BOOLEAN DEFAULT TRUE,
      print_show_series BOOLEAN DEFAULT TRUE,
      print_show_zeros BOOLEAN DEFAULT TRUE,
      referral_code TEXT UNIQUE,
      referred_by TEXT,
      referral_count INTEGER NOT NULL DEFAULT 0,
      referral_reward_count INTEGER NOT NULL DEFAULT 0,
      referral_rewarded_at TIMESTAMP,
      bonus_days_added INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS license_vouchers (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      plan_id INTEGER NOT NULL REFERENCES plans(id),
      validity_days INTEGER NOT NULL DEFAULT 30,
      selling_price NUMERIC(10,2),
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      generated_by INTEGER REFERENCES super_admins(id),
      redeemed_by_business_id INTEGER REFERENCES businesses(id),
      redeemed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      plain_password TEXT,
      role user_role NOT NULL DEFAULT 'staff',
      permissions TEXT[],
      can_edit BOOLEAN NOT NULL DEFAULT TRUE,
      can_delete BOOLEAN NOT NULL DEFAULT TRUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      login_pin TEXT,
      session_token TEXT,
      last_seen_at TIMESTAMP,
      last_login_at TIMESTAMP,
      last_login_ip TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS login_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      business_id INTEGER,
      user_name TEXT,
      business_name TEXT,
      role TEXT,
      ip_address TEXT,
      user_agent TEXT,
      latitude NUMERIC(10,7),
      longitude NUMERIC(10,7),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS units (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hsn_codes (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      code TEXT NOT NULL,
      description TEXT,
      tax_rate NUMERIC(5,2),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tax_rates (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      rate NUMERIC(5,2) NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS custom_fields (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      entity custom_field_entity NOT NULL,
      field_name TEXT NOT NULL,
      field_label TEXT NOT NULL,
      field_type custom_field_type NOT NULL DEFAULT 'text',
      options TEXT[],
      is_required BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS parties (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      type party_type NOT NULL,
      gstin TEXT,
      pan TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      state_code TEXT,
      pincode TEXT,
      opening_balance NUMERIC(15,2) DEFAULT 0,
      opening_balance_type balance_type DEFAULT 'debit',
      credit_limit NUMERIC(15,2) DEFAULT 0,
      credit_days INTEGER DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      custom_fields JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      description TEXT,
      type item_type NOT NULL DEFAULT 'goods',
      hsn_code TEXT,
      unit_id INTEGER REFERENCES units(id),
      tax_rate_id INTEGER REFERENCES tax_rates(id),
      sale_price NUMERIC(15,2) DEFAULT 0,
      purchase_price NUMERIC(15,2) DEFAULT 0,
      opening_stock NUMERIC(15,3) DEFAULT 0,
      low_stock_alert NUMERIC(15,3) DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      custom_fields JSONB,
      shipping_addresses JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS vouchers (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      voucher_type voucher_type NOT NULL,
      voucher_number TEXT NOT NULL,
      date TEXT NOT NULL,
      party_id INTEGER NOT NULL REFERENCES parties(id),
      billing_address TEXT,
      use_shipping_address BOOLEAN DEFAULT FALSE,
      shipping_address TEXT,
      sub_total NUMERIC(15,2) DEFAULT 0,
      total_discount NUMERIC(15,2) DEFAULT 0,
      taxable_amount NUMERIC(15,2) DEFAULT 0,
      total_cgst NUMERIC(15,2) DEFAULT 0,
      total_sgst NUMERIC(15,2) DEFAULT 0,
      total_igst NUMERIC(15,2) DEFAULT 0,
      total_tax NUMERIC(15,2) DEFAULT 0,
      transport_charges NUMERIC(15,2) DEFAULT 0,
      transport_name TEXT,
      round_off NUMERIC(15,2) DEFAULT 0,
      grand_total NUMERIC(15,2) NOT NULL DEFAULT 0,
      paid_amount NUMERIC(15,2) DEFAULT 0,
      status voucher_status NOT NULL DEFAULT 'posted',
      notes TEXT,
      terms_and_conditions TEXT,
      linked_voucher_id INTEGER,
      is_inter_state BOOLEAN DEFAULT FALSE,
      place_of_supply TEXT,
      custom_fields JSONB,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS voucher_items (
      id SERIAL PRIMARY KEY,
      voucher_id INTEGER NOT NULL REFERENCES vouchers(id),
      item_id INTEGER,
      item_name TEXT NOT NULL,
      description TEXT,
      hsn_code TEXT,
      quantity NUMERIC(15,3) NOT NULL,
      unit TEXT,
      rate NUMERIC(15,2) NOT NULL,
      discount NUMERIC(15,2) DEFAULT 0,
      discount_type discount_type DEFAULT 'percent',
      taxable_amount NUMERIC(15,2) NOT NULL,
      tax_rate_id INTEGER,
      tax_rate NUMERIC(5,2) DEFAULT 0,
      cgst NUMERIC(15,2) DEFAULT 0,
      sgst NUMERIC(15,2) DEFAULT 0,
      igst NUMERIC(15,2) DEFAULT 0,
      tax_amount NUMERIC(15,2) DEFAULT 0,
      total NUMERIC(15,2) NOT NULL,
      custom_fields JSONB
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      payment_number TEXT NOT NULL,
      type payment_type NOT NULL,
      date TEXT NOT NULL,
      party_id INTEGER NOT NULL REFERENCES parties(id),
      amount NUMERIC(15,2) NOT NULL,
      payment_mode payment_mode NOT NULL DEFAULT 'cash',
      reference_number TEXT,
      notes TEXT,
      is_on_account BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payment_allocations (
      id SERIAL PRIMARY KEY,
      payment_id INTEGER NOT NULL REFERENCES payments(id),
      voucher_id INTEGER NOT NULL REFERENCES vouchers(id),
      allocated_amount NUMERIC(15,2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cash_bank_accounts (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      type account_type NOT NULL DEFAULT 'cash',
      bank_name TEXT,
      account_number TEXT,
      ifsc_code TEXT,
      opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS expense_heads (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS expense_vouchers (
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
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS contra_entries (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      contra_number TEXT NOT NULL,
      date TEXT NOT NULL,
      from_account_id INTEGER NOT NULL REFERENCES cash_bank_accounts(id),
      to_account_id INTEGER NOT NULL REFERENCES cash_bank_accounts(id),
      amount NUMERIC(15,2) NOT NULL,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  logger.info("Schema init complete (all tables created)");
}

async function runMigrations() {
  try {
    // If offline mode (PGlite): create full schema first
    if (isOfflineMode) {
      await runInitSchema();
    }

    // Incremental column additions (safe for both PG and PGlite)
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
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS login_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        business_id INTEGER,
        user_name TEXT,
        business_name TEXT,
        role TEXT,
        ip_address TEXT,
        user_agent TEXT,
        latitude NUMERIC(10,7),
        longitude NUMERIC(10,7),
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
        notes TEXT,
        generated_by INTEGER,
        redeemed_by_business_id INTEGER,
        redeemed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Migrations applied");
  } catch (err) {
    logger.error({ err }, "Migration failed (non-fatal)");
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

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, mode: isOfflineMode ? "offline-pglite" : "cloud-postgres" }, "Server listening");
  await runMigrations();
  await seedSuperAdmin();
});
