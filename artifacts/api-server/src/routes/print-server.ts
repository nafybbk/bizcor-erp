import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import fs from "fs";
import path from "path";

const router = Router();

function getDataDir(sqlitePath: string) {
  // SQLITE_PATH is actually the bizcor-db DIRECTORY (server-manager.js) —
  // dirname() on it walked one level too high, so the queue file landed
  // where Electron's poller never looks and Server Print silently did nothing.
  try {
    if (fs.statSync(sqlitePath).isDirectory()) return sqlitePath;
  } catch { /* fall through */ }
  return path.dirname(sqlitePath);
}

function getQueueFile(sqlitePath: string) {
  return path.join(getDataDir(sqlitePath), "print-queue.json");
}

function getStatusFile(sqlitePath: string) {
  return path.join(getDataDir(sqlitePath), "print-status.json");
}

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

  const jobId = Date.now();
  const job = {
    id: jobId,
    voucherId: String(voucherId),
    voucherType,
    token,
    requestedAt: new Date().toISOString(),
  };

  // Clear old status before writing new job
  try { fs.unlinkSync(getStatusFile(sqlitePath)); } catch (_) {}

  fs.writeFileSync(getQueueFile(sqlitePath), JSON.stringify(job), "utf8");
  res.json({ success: true, jobId });
});

// GET /api/print-server/status
// Client polls this to know if Electron has finished printing
router.get("/print-server/status", requireAuth, (req, res) => {
  const sqlitePath = process.env.SQLITE_PATH;
  if (!sqlitePath) {
    res.status(400).json({ error: "Only available in desktop/LAN mode." });
    return;
  }

  const statusFile = getStatusFile(sqlitePath);
  if (!fs.existsSync(statusFile)) {
    res.json({ status: "pending" });
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(statusFile, "utf8"));
    res.json(data);
  } catch {
    res.json({ status: "pending" });
  }
});

export default router;
