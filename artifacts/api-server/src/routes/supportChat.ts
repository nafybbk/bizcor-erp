import { Router } from "express";
import { pool } from "@workspace/db";
import { requireSuperAdmin } from "../middlewares/auth";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

const router = Router();

// ─── Cloudinary config ────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const CLOUDINARY_FOLDER = "support-chat";
const MAX_STORAGE_BYTES = 500 * 1024 * 1024; // 500 MB cap

// multer — memory storage (no disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB per file
});

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
    for (const col of [
      `ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS file_path TEXT`,
      `ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS file_name TEXT`,
      `ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS file_mime_type TEXT`,
      `ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS file_size INTEGER`,
    ]) {
      try { await p.query(col); } catch { /* already exists */ }
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

// ─── Upload buffer to Cloudinary ──────────────────────────────────────────────
async function uploadToCloudinary(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{ publicId: string; secureUrl: string; bytes: number }> {
  return new Promise((resolve, reject) => {
    const isRaw = !mimeType.startsWith("image/") && !mimeType.startsWith("video/");
    const resourceType: "image" | "video" | "raw" = mimeType.startsWith("image/")
      ? "image" : mimeType.startsWith("video/") ? "video" : "raw";

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER,
        resource_type: resourceType,
        public_id: `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
        use_filename: true,
        unique_filename: true,
        ...(isRaw ? { format: undefined } : {}),
      },
      (err, result) => {
        if (err || !result) return reject(err || new Error("Cloudinary upload failed"));
        resolve({ publicId: result.public_id, secureUrl: result.secure_url, bytes: result.bytes });
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

// ─── FIFO cleanup: delete oldest files when > 500 MB ─────────────────────────
async function fifoCleanup() {
  try {
    // Get total size from DB
    const r = await pgQuery(
      `SELECT id, file_path, file_size FROM support_messages
       WHERE file_path IS NOT NULL ORDER BY created_at ASC`
    );
    const rows: { id: number; file_path: string; file_size: number }[] = r.rows;
    const totalBytes = rows.reduce((s: number, row: { file_size: number }) => s + (row.file_size || 0), 0);
    if (totalBytes <= MAX_STORAGE_BYTES) return;

    let freed = 0;
    const toDelete = totalBytes - MAX_STORAGE_BYTES;
    for (const row of rows) {
      if (freed >= toDelete) break;
      // Delete from Cloudinary
      try {
        const mimeR = await pgQuery(
          `SELECT file_mime_type FROM support_messages WHERE id=$1`, [row.id]
        );
        const mime: string = mimeR.rows[0]?.file_mime_type || "";
        const resourceType: "image" | "video" | "raw" = mime.startsWith("image/")
          ? "image" : mime.startsWith("video/") ? "video" : "raw";
        await cloudinary.uploader.destroy(row.file_path, { resource_type: resourceType });
      } catch { /* ignore cloudinary errors */ }
      // Nullify file columns in DB (keep message row)
      await pgQuery(
        `UPDATE support_messages SET file_path=NULL, file_name=NULL, file_mime_type=NULL, file_size=NULL WHERE id=$1`,
        [row.id]
      );
      freed += row.file_size || 0;
    }
  } catch { /* non-critical */ }
}

// ─── DIAGNOSTIC ───────────────────────────────────────────────────────────────
router.get("/support-chat/diag", async (_req, res) => {
  const p = pool as any;
  const info: Record<string, unknown> = {
    poolNull: !p, tableReady, tableInitError,
    cloudinaryConfigured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY),
  };
  if (p) {
    try {
      const r = await p.query(`SELECT COUNT(*) as n FROM information_schema.tables WHERE table_schema='public' AND table_name='support_messages'`);
      info.tableExistsInDB = r.rows[0]?.n !== "0";
    } catch (e) { info.tableCheckError = (e as Error).message; }
    try {
      const r2 = await p.query(`SELECT current_database() as db`);
      info.currentDb = r2.rows[0]?.db;
    } catch (e) { info.dbNameError = (e as Error).message; }
    try {
      const r3 = await pgQuery(
        `SELECT COALESCE(SUM(file_size),0) as total FROM support_messages WHERE file_path IS NOT NULL`
      );
      info.storageBytesUsed = Number(r3.rows[0]?.total || 0);
      info.storageCapBytes = MAX_STORAGE_BYTES;
    } catch { /* ignore */ }
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

// ─── PUBLIC: Upload file message → Cloudinary ────────────────────────────────
router.post("/support-chat/messages/file", upload.single("file"), async (req, res) => {
  await ensureTables();
  try {
    const { sessionId, name, phone, email } = req.body || {};
    const file = req.file;
    if (!sessionId || !file) {
      res.status(400).json({ error: "sessionId aur file zaroori hain" });
      return;
    }

    // Upload to Cloudinary
    const { publicId, secureUrl, bytes } = await uploadToCloudinary(
      file.buffer, file.originalname, file.mimetype
    );

    // Store public_id as file_path, secure_url as file_name (for display/download)
    const result = await pgQuery(
      `INSERT INTO support_messages
         (session_id, sender_type, name, phone, email, message, status,
          file_path, file_name, file_mime_type, file_size)
       VALUES ($1, 'user', $2, $3, $4, $5, 'new', $6, $7, $8, $9) RETURNING id`,
      [
        sessionId.trim(),
        name?.trim() || null, phone?.trim() || null, email?.trim() || null,
        file.originalname,
        publicId,        // file_path = Cloudinary public_id (for delete/FIFO)
        secureUrl,       // file_name = Cloudinary secure URL (for serving)
        file.mimetype,
        bytes,
      ]
    );

    // Run FIFO cleanup async (non-blocking)
    fifoCleanup().catch(() => {});

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

// ─── NOTE: File serving ───────────────────────────────────────────────────────
// Files are now served directly from Cloudinary CDN.
// file_name column stores the Cloudinary secure_url.
// Frontend uses file_name (secureUrl) directly — no proxy route needed.
// Super admin can also use the same URL.

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

// ─── SUPER ADMIN: Storage stats ──────────────────────────────────────────────
router.get("/super-admin/support-storage", requireSuperAdmin, async (req, res) => {
  try {
    const r = await pgQuery(
      `SELECT COALESCE(SUM(file_size),0) as total_bytes,
              COUNT(*) FILTER (WHERE file_path IS NOT NULL) as file_count
       FROM support_messages`
    );
    const totalBytes = Number(r.rows[0]?.total_bytes || 0);
    res.json({
      usedBytes: totalBytes,
      usedMB: (totalBytes / 1024 / 1024).toFixed(1),
      capBytes: MAX_STORAGE_BYTES,
      capMB: 500,
      percentUsed: ((totalBytes / MAX_STORAGE_BYTES) * 100).toFixed(1),
      fileCount: Number(r.rows[0]?.file_count || 0),
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
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
