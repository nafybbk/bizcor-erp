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

async function runMigrations() {
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
      logger.info("Default super admin created: phone=9999999999 / password=Tech@1234");
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

  logger.info({ port }, "Server listening");
  await runMigrations();
  await seedSuperAdmin();
});
