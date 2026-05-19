import app from "./app";
import { db, superAdminsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

let migrated = false;

async function runMigrations() {
  if (migrated) return;
  migrated = true;
  try {
    await db.execute(sql`ALTER TABLE super_admins ADD COLUMN IF NOT EXISTS avatar TEXT`);
    await db.execute(sql`ALTER TABLE super_admins ADD COLUMN IF NOT EXISTS plain_password TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password TEXT`);
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
      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id SERIAL PRIMARY KEY,
        credential_id TEXT NOT NULL UNIQUE,
        public_key TEXT NOT NULL,
        counter INTEGER NOT NULL DEFAULT 0,
        super_admin_id INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS transport_name TEXT`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS print_show_prefix BOOLEAN DEFAULT TRUE`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS print_show_series BOOLEAN DEFAULT TRUE`);
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS print_show_zeros BOOLEAN DEFAULT TRUE`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS business_id INTEGER`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB`);
    const hash = await bcrypt.hash("031975", 10);
    await db.execute(sql`
      UPDATE super_admins SET password_hash = ${hash}, plain_password = '031975'
      WHERE phone = '7905282816'
    `);
  } catch (_err) {
    // non-fatal
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
  } catch (_err) {
    // ignore seed errors
  }
}

runMigrations().then(() => seedSuperAdmin());

export default app;
