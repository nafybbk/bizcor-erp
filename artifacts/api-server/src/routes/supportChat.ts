import { Router } from "express";
import { pool } from "@workspace/db";
import { requireSuperAdmin } from "../middlewares/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "support-chat");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${stamp}_${rand}_${safe}`);
  },
});
const upload = multer({ storage });

// ─── Lazy table init ──────────────────────────────────────────────────────────
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
      message TEXT, status TEXT NOT NULL DEFAULT 'new',
      file_path TEXT, file_name TEXT, file_mime_type TEXT, file_size INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    // Add file columns to existing tables that may not have them
    for (const col of [
      `ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS file_path TEXT`,
      `ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS file_name TEXT`,
      `ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS file_mime_type TEXT`,
      `ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS file_size INTEGER`,
    ]) {
      try { await p.query(col); } catch { /* column may already exist */ }
    }
    await p.query(`CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY, business_id INTEGER NOT NULL,
      from_user_id INTEGER NOT NULL, from_user_name TEXT NOT NULL,
      message TEXT, file_path TEXT, file_name TEXT,
      file_mime_type TEXT, file_size INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    try { await p.query(`CREATE INDEX IF NOT EXISTS support_messages_session_idx ON support_messages(session_id)`); } catch {}
    try { await p.query(`CREATE INDEX IF NOT EXISTS chat_messages_business_idx ON chat_messages(business_id, id)`); } catch {}
    tableReady = true;
  } catch (err) {
    tableInitError = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

async function pgQuery(text: string, params: unknown[] = []) {
  const p = pool as any;
  if (!p) throw new Error("No database pool available");
  return p.query(text, params);
}

// ─── DIAGNOSTIC ───────────────────────────────────────────────────────────────
router.get("/support-chat/diag", async (_req, res) => {
  const p = pool as any;
  const info: Record<string, unknown> = { poolNull: !p, tableReady, tableInitError };
  if (p) {
    try {
      const r = await p.query(`SELECT COUNT(*) as n FROM information_schema.tables WHERE table_schema='public' AND table_name='support_messages'`);
      info.tableExistsInDB = r.rows[0]?.n !== "0";
    } catch (e) { info.tableCheckError = (e as Error).message; }
    try {
      await p.query(`CREATE TABLE IF NOT EXISTS support_messages_diag_test (id SERIAL PRIMARY KEY, ts TIMESTAMP DEFAULT NOW())`);
      await p.query(`DROP TABLE IF EXISTS support_messages_diag_test`);
      info.canCreateTable = true;
    } catch (e) { info.canCreateTable = false; info.createError = (e as Error).message; }
    try {
      const r2 = await p.query(`SELECT current_database() as db`);
      info.currentDb = r2.rows[0]?.db;
    } catch (e) { info.dbNameError = (e as Error).message; }
  }
  res.json(info);
});

// ─── PUBLIC: Send text message ────────────────────────────────────────────────
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

// ─── PUBLIC: Upload file message ──────────────────────────────────────────────
router.post("/support-chat/messages/file", upload.single("file"), async (req, res) => {
  await ensureTables();
  try {
    const { sessionId, name, phone, email } = req.body || {};
    const file = req.file;
    if (!sessionId || !file) {
      res.status(400).json({ error: "sessionId aur file zaroori hain" });
      return;
    }
    const result = await pgQuery(
      `INSERT INTO support_messages (session_id, sender_type, name, phone, email, message, status, file_path, file_name, file_mime_type, file_size)
       VALUES ($1, 'user', $2, $3, $4, $5, 'new', $6, $7, $8, $9) RETURNING id`,
      [
        sessionId.trim(),
        name?.trim() || null, phone?.trim() || null, email?.trim() || null,
        file.originalname,
        file.filename, file.originalname, file.mimetype, file.size,
      ]
    );
    res.json({ success: true, id: result.rows[0]?.id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ─── PUBLIC: Get messages for a session ──────────────────────────────────────
router.get("/support-chat/messages/:sessionId", async (req, res) => {
  await ensureTables();
  try {
    const sessionId = String(req.params.sessionId);
    const result = await pgQuery(
      `SELECT id, session_id as "sessionId", sender_type as "senderType",
              name, phone, email, message, status,
              file_path as "filePath", file_name as "fileName",
              file_mime_type as "fileMimeType", file_size as "fileSize",
              created_at as "createdAt"
       FROM support_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );
    res.json(result.rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ─── PUBLIC: Serve file (validated by sessionId) ──────────────────────────────
router.get("/support-chat/files/:filename", async (req, res) => {
  await ensureTables();
  try {
    const filename = req.params.filename;
    const sessionId = Array.isArray(req.query.session) ? req.query.session[0] : req.query.session as string;
    if (!sessionId) { res.status(400).json({ error: "session required" }); return; }

    const result = await pgQuery(
      `SELECT id FROM support_messages WHERE file_path=$1 AND session_id=$2 LIMIT 1`,
      [filename, sessionId]
    );
    if (!result.rows.length) { res.status(404).json({ error: "File nahi mili" }); return; }

    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File disk pe nahi mili" }); return; }
    res.sendFile(filePath);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── SUPER ADMIN: Download/view support file ──────────────────────────────────
router.get("/super-admin/support-files/:filename", requireSuperAdmin, async (req, res) => {
  const filename = String(req.params.filename);
  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File nahi mili" }); return; }
  res.sendFile(filePath);
});

// ─── SUPER ADMIN: List all sessions ──────────────────────────────────────────
router.get("/super-admin/support-messages", requireSuperAdmin, async (req, res) => {
  await ensureTables();
  try {
    const result = await pgQuery(
      `SELECT id, session_id as "sessionId", sender_type as "senderType",
              name, phone, email, message, status,
              file_path as "filePath", file_name as "fileName",
              file_mime_type as "fileMimeType", file_size as "fileSize",
              created_at as "createdAt"
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
          latestMessage: row.message || row.fileName || "", status: row.status, createdAt: row.createdAt,
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

// ─── SUPER ADMIN: Reply ───────────────────────────────────────────────────────
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

// ─── SUPER ADMIN: Mark read ───────────────────────────────────────────────────
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
