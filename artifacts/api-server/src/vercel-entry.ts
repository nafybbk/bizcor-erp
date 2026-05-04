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
    const hash = await bcrypt.hash("031975", 10);
    await db.execute(sql`UPDATE super_admins SET password_hash = ${hash} WHERE phone = '7905282816'`);
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
