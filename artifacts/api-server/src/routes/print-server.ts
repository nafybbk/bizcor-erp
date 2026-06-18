import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import fs from "fs";
import path from "path";

const router = Router();

// POST /api/print-server
// Desktop/LAN mode only — writes a print job for Electron to pick up and print silently
router.post("/print-server", requireAuth, async (req, res) => {
  const sqlitePath = process.env.SQLITE_PATH;
  if (!sqlitePath) {
    res.status(400).json({ error: "Print server is only available in desktop/LAN mode." });
    return;
  }

  const { voucherId, voucherType, token } = req.body as {
    voucherId: string | number;
    voucherType: string;
    token: string;
  };

  if (!voucherId || !voucherType || !token) {
    res.status(400).json({ error: "voucherId, voucherType, and token are required." });
    return;
  }

  const queueFile = path.join(sqlitePath, "print-queue.json");
  const job = {
    id: Date.now(),
    voucherId: String(voucherId),
    voucherType,
    token,
    requestedAt: new Date().toISOString(),
  };

  fs.writeFileSync(queueFile, JSON.stringify(job), "utf8");
  res.json({ success: true, message: "Print request sent to server printer." });
});

export default router;
