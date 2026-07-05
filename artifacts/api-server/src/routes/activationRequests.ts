import { Router } from "express";
import { requireSuperAdmin } from "../middlewares/auth";

const router = Router();

// ── Tech Panel: list all activation requests ──────────────────────────────────
router.get("/activation-requests", requireSuperAdmin, async (req, res) => {
  try {
    const { pool, sqlite } = await import("@workspace/db");
    const status = (req.query.status as string) || "pending";

    if (sqlite) {
      const rows = sqlite.prepare(`
        SELECT * FROM activation_requests WHERE status = ? ORDER BY created_at DESC LIMIT 100
      `).all(status);
      res.json(rows);
    } else if (pool) {
      const { rows } = await pool.query(
        `SELECT * FROM activation_requests WHERE status = $1 ORDER BY created_at DESC LIMIT 100`,
        [status]
      );
      res.json(rows);
    } else {
      res.json([]);
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// ── Business: check status of their pending request ───────────────────────────
router.get("/activation-requests/check", async (req, res) => {
  try {
    const { pool, sqlite } = await import("@workspace/db");
    const { code, businessCode } = req.query as { code: string; businessCode: string };
    if (!code || !businessCode) { res.status(400).json({ error: "code and businessCode required" }); return; }

    if (sqlite) {
      const row = sqlite.prepare(
        `SELECT status FROM activation_requests WHERE code = ? AND business_code = ? ORDER BY created_at DESC LIMIT 1`
      ).get(code.toUpperCase(), businessCode.toUpperCase()) as any;
      res.json({ status: row?.status || "not_found" });
    } else if (pool) {
      const { rows } = await pool.query(
        `SELECT status FROM activation_requests WHERE code = $1 AND business_code = $2 ORDER BY created_at DESC LIMIT 1`,
        [code.toUpperCase(), businessCode.toUpperCase()]
      );
      res.json({ status: rows[0]?.status || "not_found" });
    } else {
      res.json({ status: "not_found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// ── Tech Panel: approve a request ────────────────────────────────────────────
router.post("/activation-requests/:id/approve", requireSuperAdmin, async (req, res) => {
  try {
    const { pool, sqlite, db, licenseVouchersTable, plansTable, businessesTable } = await import("@workspace/db");
    const { eq, sql } = await import("drizzle-orm");
    const id = Number(req.params.id);

    let reqRow: any;
    if (sqlite) {
      reqRow = sqlite.prepare(`SELECT * FROM activation_requests WHERE id = ?`).get(id);
    } else if (pool) {
      const { rows } = await pool.query(`SELECT * FROM activation_requests WHERE id = $1`, [id]);
      reqRow = rows[0];
    }

    if (!reqRow) { res.status(404).json({ error: "Request not found" }); return; }
    if (reqRow.status !== "pending") { res.status(400).json({ error: "Already reviewed" }); return; }

    const code = (reqRow.code || reqRow.voucher_code || "").toUpperCase();
    const businessCode = (reqRow.business_code || reqRow.businessCode || "").toUpperCase();

    const [voucher] = await db.select().from(licenseVouchersTable).where(eq(licenseVouchersTable.code, code)).limit(1);
    if (!voucher) { res.status(404).json({ error: "Voucher not found" }); return; }

    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, voucher.planId)).limit(1);
    if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }

    const [biz] = await db.select().from(businessesTable).where(eq(businessesTable.businessCode, businessCode)).limit(1);

    const now = new Date();
    const nowStr = now.toISOString();

    // Approving a "new device" activation request is still a reuse of an
    // already-activated voucher — must NOT reset the validity timer.
    // Preserve the remaining period from the voucher's original activation.
    let firstActivatedAt: string | null = null;
    try {
      const prevNotes = JSON.parse(voucher.notes || "{}");
      firstActivatedAt = prevNotes.firstActivatedAt || prevNotes.activatedAt || null;
    } catch { /* ignore */ }
    if (!firstActivatedAt && voucher.redeemedAt) {
      firstActivatedAt = new Date(voucher.redeemedAt).toISOString();
    }
    if (!firstActivatedAt) firstActivatedAt = nowStr;

    const baseDate = new Date(firstActivatedAt);
    const expiresAt = new Date(baseDate.getTime() + voucher.validityDays * 24 * 60 * 60 * 1000);

    const activationLog = JSON.stringify({
      activatedAt: nowStr,
      firstActivatedAt,
      businessCode,
      hardware: reqRow.hardware_fingerprint || reqRow.hardwareFingerprint || null,
      ip: reqRow.ip || null,
      exeVersion: reqRow.exe_version || reqRow.exeVersion || null,
      approvedByTech: true,
    });

    if (biz) {
      await db.update(businessesTable).set({
        planId: plan.id,
        planStartDate: now,
        planExpiresAt: sql`${expiresAt.toISOString()}` as unknown as Date,
        isTrial: false,
        status: "active",
      }).where(eq(businessesTable.id, biz.id));
    }

    await db.update(licenseVouchersTable).set({
      status: "used",
      redeemedByBusinessId: biz?.id || voucher.redeemedByBusinessId,
      redeemedAt: now,
      notes: activationLog,
    }).where(eq(licenseVouchersTable.id, voucher.id));

    const reviewedAt = now.toISOString();
    if (sqlite) {
      sqlite.prepare(`UPDATE activation_requests SET status = 'approved', reviewed_at = ? WHERE id = ?`).run(reviewedAt, id);
    } else if (pool) {
      await pool.query(`UPDATE activation_requests SET status = 'approved', reviewed_at = $1 WHERE id = $2`, [reviewedAt, id]);
    }

    res.json({ success: true, message: "Approved — business plan updated" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// ── Tech Panel: deny a request ───────────────────────────────────────────────
router.post("/activation-requests/:id/deny", requireSuperAdmin, async (req, res) => {
  try {
    const { pool, sqlite } = await import("@workspace/db");
    const id = Number(req.params.id);
    const reviewedAt = new Date().toISOString();
    if (sqlite) {
      sqlite.prepare(`UPDATE activation_requests SET status = 'denied', reviewed_at = ? WHERE id = ?`).run(reviewedAt, id);
    } else if (pool) {
      await pool.query(`UPDATE activation_requests SET status = 'denied', reviewed_at = $1 WHERE id = $2`, [reviewedAt, id]);
    }
    res.json({ success: true, message: "Denied" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

export default router;
