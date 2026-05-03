import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/db-test", async (_req, res) => {
  try {
    const { db } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(sql`SELECT 1 as ping`);
    res.json({ db: "ok", result: result.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ db: "error", message: msg });
  }
});

export default router;
