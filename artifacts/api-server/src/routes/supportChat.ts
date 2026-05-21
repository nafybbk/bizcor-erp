import { Router } from "express";
import { db } from "@workspace/db";
import { supportMessagesTable } from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";
import { requireSuperAdmin } from "../middlewares/auth";

const router = Router();

// ─── PUBLIC: Send a message (no auth) ────────────────────────────────────────

router.post("/support-chat/messages", async (req, res) => {
  try {
    const { sessionId, name, phone, email, message } = req.body || {};
    if (!sessionId || !message?.trim()) {
      res.status(400).json({ error: "sessionId aur message required hain" });
      return;
    }
    const [row] = await db.insert(supportMessagesTable).values({
      sessionId: sessionId.trim(),
      senderType: "user",
      name: name?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      message: message.trim(),
      status: "new",
    }).returning();
    res.json({ success: true, id: row.id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── PUBLIC: Get messages for a session (no auth) ────────────────────────────

router.get("/support-chat/messages/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }
    const rows = await db.select().from(supportMessagesTable)
      .where(eq(supportMessagesTable.sessionId, sessionId))
      .orderBy(asc(supportMessagesTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── SUPER ADMIN: List all sessions ──────────────────────────────────────────

router.get("/super-admin/support-messages", requireSuperAdmin, async (req, res) => {
  try {
    const all = await db.select().from(supportMessagesTable)
      .orderBy(desc(supportMessagesTable.createdAt));

    const sessionsMap = new Map<string, {
      sessionId: string;
      name: string | null;
      phone: string | null;
      email: string | null;
      latestMessage: string;
      status: string;
      createdAt: Date;
      replyCount: number;
      messages: typeof all;
    }>();

    for (const row of all) {
      if (!sessionsMap.has(row.sessionId)) {
        sessionsMap.set(row.sessionId, {
          sessionId: row.sessionId,
          name: null,
          phone: null,
          email: null,
          latestMessage: row.message,
          status: row.status,
          createdAt: row.createdAt,
          replyCount: 0,
          messages: [],
        });
      }
      const session = sessionsMap.get(row.sessionId)!;
      session.messages.push(row);
      if (row.senderType === "user" && !session.name) {
        session.name = row.name;
        session.phone = row.phone;
        session.email = row.email;
      }
      if (row.senderType === "admin") session.replyCount++;
    }

    const sessions = Array.from(sessionsMap.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json(sessions);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── SUPER ADMIN: Reply to a session ─────────────────────────────────────────

router.post("/super-admin/support-messages/:sessionId/reply", requireSuperAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body || {};
    if (!message?.trim()) { res.status(400).json({ error: "message required" }); return; }

    const [row] = await db.insert(supportMessagesTable).values({
      sessionId,
      senderType: "admin",
      message: message.trim(),
      status: "replied",
    }).returning();

    await db.update(supportMessagesTable)
      .set({ status: "replied" })
      .where(eq(supportMessagesTable.sessionId, sessionId));

    res.json({ success: true, id: row.id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── SUPER ADMIN: Mark session as read ───────────────────────────────────────

router.patch("/super-admin/support-messages/:sessionId/read", requireSuperAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    await db.update(supportMessagesTable)
      .set({ status: "read" })
      .where(eq(supportMessagesTable.sessionId, sessionId));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
