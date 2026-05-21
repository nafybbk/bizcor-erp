import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const mode = process.env.SQLITE_PATH ? "desktop" : "cloud";
  const data = HealthCheckResponse.parse({ status: "ok", mode });
  res.json(data);
});

// One-time setup: creates missing tables directly via pool
router.get("/setup-tables", async (_req, res) => {
  const results: Record<string, string> = {};
  const p = pool as any;
  if (!p) { res.json({ error: "pool is null" }); return; }

  const tables = [
    {
      name: "support_messages",
      sql: `CREATE TABLE IF NOT EXISTS support_messages (
        id SERIAL PRIMARY KEY, session_id TEXT NOT NULL,
        sender_type TEXT NOT NULL DEFAULT 'user',
        name TEXT, phone TEXT, email TEXT,
        message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "chat_messages",
      sql: `CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY, business_id INTEGER NOT NULL,
        from_user_id INTEGER NOT NULL, from_user_name TEXT NOT NULL,
        message TEXT, file_path TEXT, file_name TEXT,
        file_mime_type TEXT, file_size INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
  ];

  for (const t of tables) {
    try {
      await p.query(t.sql);
      await p.query(`CREATE INDEX IF NOT EXISTS ${t.name}_idx ON ${t.name}(id)`);
      results[t.name] = "ok";
    } catch (err) {
      results[t.name] = err instanceof Error ? err.message : String(err);
    }
  }

  // verify
  try {
    const r = await p.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('support_messages','chat_messages')`
    );
    results["verified_tables"] = r.rows.map((x: any) => x.table_name).join(", ") || "none";
  } catch (err) {
    results["verify_error"] = err instanceof Error ? err.message : String(err);
  }

  // show which DB host we are on
  try {
    const r = await p.query(`SELECT current_database() as db, inet_server_addr() as host`);
    results["db_info"] = JSON.stringify(r.rows[0]);
  } catch {
    results["db_info"] = "unavailable";
  }

  res.json(results);
});

export default router;
