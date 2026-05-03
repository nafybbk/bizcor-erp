import app from "./app";
import { db, superAdminsTable } from "@workspace/db";
import bcrypt from "bcryptjs";

let seeded = false;

async function seedSuperAdmin() {
  if (seeded) return;
  seeded = true;
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

seedSuperAdmin();

export default app;
