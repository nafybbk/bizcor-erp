import { Router } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable, usersTable } from "@workspace/db";
import { eq, and, gt, asc, desc } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB base64 limit

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

// POST /chat/messages — send a message (text or file)
router.post("/chat/messages", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const userId = req.user!.id;

    const { message, fileData, fileName, fileMimeType, fileSize } = req.body || {};

    if (!message?.trim() && !fileData) {
      res.status(400).json({ error: "message ya file zaroori hai" });
      return;
    }

    if (fileData && fileData.length > MAX_FILE_SIZE_BYTES * 1.4) {
      res.status(400).json({ error: "File bahut badi hai — max 2MB allowed" });
      return;
    }

    const [user] = await db.select({ name: usersTable.name })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    const [row] = await db.insert(chatMessagesTable).values({
      businessId,
      fromUserId: userId,
      fromUserName: user?.name || "Unknown",
      message: message?.trim() || null,
      fileData: fileData || null,
      fileName: fileName || null,
      fileMimeType: fileMimeType || null,
      fileSize: fileSize || null,
    }).returning();

    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /chat/messages/:id — delete own message
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

    await db.delete(chatMessagesTable).where(eq(chatMessagesTable.id, msgId));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
