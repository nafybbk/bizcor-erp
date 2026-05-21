import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { chatMessagesTable, usersTable } from "@workspace/db";
import { eq, and, gt, asc, desc } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();

// ── Upload directory ──────────────────────────────────────────────────────────
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "chat");
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

// No size limit — LAN is fast enough for any file size
const upload = multer({ storage });

router.use(requireBusiness);

// GET /chat/messages?since=<id>  — poll for new messages
router.get("/chat/messages", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const sinceId = parseInt(req.query.since as string) || 0;

    const rows = await db.select().from(chatMessagesTable)
      .where(sinceId > 0
        ? and(eq(chatMessagesTable.businessId, businessId), gt(chatMessagesTable.id, sinceId))
        : eq(chatMessagesTable.businessId, businessId)
      )
      .orderBy(asc(chatMessagesTable.id))
      .limit(100);

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /chat/messages/recent — last 50 messages (initial load)
router.get("/chat/messages/recent", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;

    const rows = await db.select().from(chatMessagesTable)
      .where(eq(chatMessagesTable.businessId, businessId))
      .orderBy(desc(chatMessagesTable.id))
      .limit(50);

    res.json(rows.reverse());
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /chat/messages — send text message
router.post("/chat/messages", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const userId = req.user!.id;
    const { message } = req.body || {};

    if (!message?.trim()) {
      res.status(400).json({ error: "Message zaroori hai" });
      return;
    }

    const [u] = await db.select({ name: usersTable.name })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    const [row] = await db.insert(chatMessagesTable).values({
      businessId,
      fromUserId: userId,
      fromUserName: u?.name || "Unknown",
      message: message.trim(),
    }).returning();

    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /chat/messages/file — upload any file (no size limit)
router.post("/chat/messages/file", upload.single("file"), async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "File nahi mili" });
      return;
    }

    const [u] = await db.select({ name: usersTable.name })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    const [row] = await db.insert(chatMessagesTable).values({
      businessId,
      fromUserId: userId,
      fromUserName: u?.name || "Unknown",
      filePath: file.filename,
      fileName: file.originalname,
      fileMimeType: file.mimetype,
      fileSize: file.size,
    }).returning();

    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /chat/files/:filename — serve file (auth guarded, business-scoped)
router.get("/chat/files/:filename", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const filename = req.params.filename;

    const [msg] = await db.select({ id: chatMessagesTable.id })
      .from(chatMessagesTable)
      .where(and(
        eq(chatMessagesTable.businessId, businessId),
        eq(chatMessagesTable.filePath, filename)
      )).limit(1);

    if (!msg) { res.status(404).json({ error: "File nahi mili ya access nahi" }); return; }

    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File disk pe nahi mili" }); return; }

    res.sendFile(filePath);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /chat/messages/:id — delete own message + file from disk
router.delete("/chat/messages/:id", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const userId = req.user!.id;
    const msgId = parseInt(req.params.id);

    const [msg] = await db.select().from(chatMessagesTable)
      .where(and(eq(chatMessagesTable.id, msgId), eq(chatMessagesTable.businessId, businessId)))
      .limit(1);

    if (!msg) { res.status(404).json({ error: "Message nahi mila" }); return; }
    if (msg.fromUserId !== userId) { res.status(403).json({ error: "Sirf apna message delete kar sakte hain" }); return; }

    if (msg.filePath) {
      const fp = path.join(UPLOAD_DIR, msg.filePath);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }

    await db.delete(chatMessagesTable).where(eq(chatMessagesTable.id, msgId));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
