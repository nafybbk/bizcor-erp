import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/db-test", async (_req, res) => {
  try {
    const { pool } = await import("@workspace/db");
    const client = await pool.connect();
    const result = await client.query("SELECT 1 as ping");
    client.release();
    res.json({ db: "ok", row: result.rows[0] });
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    res.status(500).json({
      db: "error",
      message: e.message,
      code: e.code,
      detail: e.detail,
      cause: e.cause ? String(e.cause) : undefined,
    });
  }
});

export default router;
