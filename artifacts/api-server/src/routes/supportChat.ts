import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
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
    const result = await db.execute(sql`
      INSERT INTO support_messages (session_id, sender_type, name, phone, email, message, status)
      VALUES (${sessionId.trim()}, 'user', ${name?.trim() || null}, ${phone?.trim() || null}, ${email?.trim() || null}, ${message.trim()}, 'new')
      RETURNING id, session_id, sender_type, name, phone, email, message, status, created_at
    `);
    const row = (result as any).rows?.[0] ?? result[0];
    res.json({ success: true, id: row?.id });
  } catch (err) {
    req.log.error(err);
    const cause = (err as any)?.cause;
    res.status(500).json({ error: "Server error", detail: cause?.message || (err instanceof Error ? err.message : String(err)), code: cause?.code });
  }
});

// ─── PUBLIC: Get messages for a session (no auth) ────────────────────────────

router.get("/support-chat/messages/:sessionId", async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId);
    if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }
    const result = await db.execute(sql`
      SELECT id, session_id as "sessionId", sender_type as "senderType", name, phone, email, message, status, created_at as "createdAt"
      FROM support_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `);
    const rows = (result as any).rows ?? result;
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ─── SUPER ADMIN: List all sessions ──────────────────────────────────────────

router.get("/super-admin/support-messages", requireSuperAdmin, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT id, session_id as "sessionId", sender_type as "senderType", name, phone, email, message, status, created_at as "createdAt"
      FROM support_messages
      ORDER BY created_at DESC
    `);
    const all = (result as any).rows ?? result;

    const sessionsMap = new Map<string, {
      sessionId: string;
      name: string | null;
      phone: string | null;
      email: string | null;
      latestMessage: string;
      status: string;
      createdAt: string;
      replyCount: number;
      messages: typeof all;
    }>();

    for (const row of all) {
      if (!sessionsMap.has(row.sessionId)) {
        sessionsMap.set(row.sessionId, {
          sessionId: row.sessionId,
          name: null, phone: null, email: null,
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
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(sessions);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ─── SUPER ADMIN: Reply to a session ─────────────────────────────────────────

router.post("/super-admin/support-messages/:sessionId/reply", requireSuperAdmin, async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId);
    const { message } = req.body || {};
    if (!message?.trim()) { res.status(400).json({ error: "message required" }); return; }

    const result = await db.execute(sql`
      INSERT INTO support_messages (session_id, sender_type, message, status)
      VALUES (${sessionId}, 'admin', ${message.trim()}, 'replied')
      RETURNING id
    `);
    const row = (result as any).rows?.[0] ?? result[0];

    await db.execute(sql`
      UPDATE support_messages SET status = 'replied'
      WHERE session_id = ${sessionId}
    `);

    res.json({ success: true, id: row?.id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ─── SUPER ADMIN: Mark session as read ───────────────────────────────────────

router.patch("/super-admin/support-messages/:sessionId/read", requireSuperAdmin, async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId);
    await db.execute(sql`
      UPDATE support_messages SET status = 'read'
      WHERE session_id = ${sessionId}
    `);
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
