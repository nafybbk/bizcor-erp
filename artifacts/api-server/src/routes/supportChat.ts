import { Router } from "express";
import { pool } from "@workspace/db";
import { requireSuperAdmin } from "../middlewares/auth";

const router = Router();

// ─── Lazy table init — runs once per cold start, uses same pool as routes ───
let tableReady = false;
let tableInitError: string | null = null;
async function ensureTables() {
  if (tableReady) return;
  if (tableInitError) throw new Error("Table init previously failed: " + tableInitError);
  const p = pool as any;
  if (!p) { tableInitError = "pool is null"; throw new Error(tableInitError); }
  try {
    await p.query(`CREATE TABLE IF NOT EXISTS support_messages (
      id SERIAL PRIMARY KEY, session_id TEXT NOT NULL,
      sender_type TEXT NOT NULL DEFAULT 'user',
      name TEXT, phone TEXT, email TEXT,
      message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await p.query(`CREATE INDEX IF NOT EXISTS support_messages_session_idx ON support_messages(session_id)`);
    await p.query(`CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY, business_id INTEGER NOT NULL,
      from_user_id INTEGER NOT NULL, from_user_name TEXT NOT NULL,
      message TEXT, file_path TEXT, file_name TEXT,
      file_mime_type TEXT, file_size INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await p.query(`CREATE INDEX IF NOT EXISTS chat_messages_business_idx ON chat_messages(business_id, id)`);
    tableReady = true;
  } catch (err) {
    tableInitError = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

// helper
async function pgQuery(text: string, params: unknown[] = []) {
  const p = pool as any;
  if (!p) throw new Error("No database pool available");
  return p.query(text, params);
}

// ─── PUBLIC: Send a message (no auth) ────────────────────────────────────────

router.post("/support-chat/messages", async (req, res) => {
  await ensureTables();
  try {
    const { sessionId, name, phone, email, message } = req.body || {};
    if (!sessionId || !message?.trim()) {
      res.status(400).json({ error: "sessionId aur message required hain" });
      return;
    }
    const result = await pgQuery(
      `INSERT INTO support_messages (session_id, sender_type, name, phone, email, message, status)
       VALUES ($1, 'user', $2, $3, $4, $5, 'new') RETURNING id`,
      [sessionId.trim(), name?.trim() || null, phone?.trim() || null, email?.trim() || null, message.trim()]
    );
    res.json({ success: true, id: result.rows[0]?.id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ─── PUBLIC: Get messages for a session (no auth) ────────────────────────────

router.get("/support-chat/messages/:sessionId", async (req, res) => {
  await ensureTables();
  try {
    const sessionId = String(req.params.sessionId);
    const result = await pgQuery(
      `SELECT id, session_id as "sessionId", sender_type as "senderType",
              name, phone, email, message, status, created_at as "createdAt"
       FROM support_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );
    res.json(result.rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ─── SUPER ADMIN: List all sessions ──────────────────────────────────────────

router.get("/super-admin/support-messages", requireSuperAdmin, async (req, res) => {
  await ensureTables();
  try {
    const result = await pgQuery(
      `SELECT id, session_id as "sessionId", sender_type as "senderType",
              name, phone, email, message, status, created_at as "createdAt"
       FROM support_messages ORDER BY created_at DESC`
    );
    const all = result.rows;
    const sessionsMap = new Map<string, {
      sessionId: string; name: string | null; phone: string | null; email: string | null;
      latestMessage: string; status: string; createdAt: string;
      replyCount: number; messages: typeof all;
    }>();
    for (const row of all) {
      if (!sessionsMap.has(row.sessionId)) {
        sessionsMap.set(row.sessionId, {
          sessionId: row.sessionId, name: null, phone: null, email: null,
          latestMessage: row.message, status: row.status, createdAt: row.createdAt,
          replyCount: 0, messages: [],
        });
      }
      const s = sessionsMap.get(row.sessionId)!;
      s.messages.push(row);
      if (row.senderType === "user" && !s.name) { s.name = row.name; s.phone = row.phone; s.email = row.email; }
      if (row.senderType === "admin") s.replyCount++;
    }
    res.json(
      Array.from(sessionsMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ─── SUPER ADMIN: Reply to a session ─────────────────────────────────────────

router.post("/super-admin/support-messages/:sessionId/reply", requireSuperAdmin, async (req, res) => {
  await ensureTables();
  try {
    const sessionId = String(req.params.sessionId);
    const { message } = req.body || {};
    if (!message?.trim()) { res.status(400).json({ error: "message required" }); return; }
    const result = await pgQuery(
      `INSERT INTO support_messages (session_id, sender_type, message, status)
       VALUES ($1, 'admin', $2, 'replied') RETURNING id`,
      [sessionId, message.trim()]
    );
    await pgQuery(`UPDATE support_messages SET status='replied' WHERE session_id=$1`, [sessionId]);
    res.json({ success: true, id: result.rows[0]?.id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ─── SUPER ADMIN: Mark session as read ───────────────────────────────────────

router.patch("/super-admin/support-messages/:sessionId/read", requireSuperAdmin, async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId);
    await pgQuery(`UPDATE support_messages SET status='read' WHERE session_id=$1`, [sessionId]);
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
