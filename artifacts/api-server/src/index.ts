import app from "./app";
import { logger } from "./lib/logger";
import { db, superAdminsTable } from "@workspace/db";
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
  await seedSuperAdmin();
});
