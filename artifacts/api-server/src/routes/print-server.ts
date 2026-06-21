import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import fs from "fs";
import path from "path";

const router = Router();

function getDataDir(sqlitePath: string) {
  return path.dirname(sqlitePath);
}

// GET /api/print-server/printers
// Returns list of printers available on server PC (written by Electron at startup)
router.get("/print-server/printers", requireAuth, (req, res) => {
  const sqlitePath = process.env.SQLITE_PATH;
  if (!sqlitePath) {
    res.status(400).json({ error: "Only available in desktop/LAN mode." });
    return;
  }
  const printersFile = path.join(getDataDir(sqlitePath), "printers.json");
  if (!fs.existsSync(printersFile)) {
    res.json({ printers: [] });
    return;
  }
  try {
    const printers = JSON.parse(fs.readFileSync(printersFile, "utf8"));
    res.json({ printers });
  } catch {
    res.json({ printers: [] });
  }
});

// POST /api/print-server
// Desktop/LAN mode only — writes a print job for Electron to pick up and print silently
router.post("/print-server", requireAuth, async (req, res) => {
  const sqlitePath = process.env.SQLITE_PATH;
  if (!sqlitePath) {
    res.status(400).json({ error: "Print server is only available in desktop/LAN mode." });
    return;
  }

  const { voucherId, voucherType, token, printerName } = req.body as {
    voucherId: string | number;
    voucherType: string;
    token: string;
    printerName?: string;
  };

  if (!voucherId || !voucherType || !token) {
    res.status(400).json({ error: "voucherId, voucherType, and token are required." });
    return;
  }

  const queueFile = path.join(getDataDir(sqlitePath), "print-queue.json");
  const job = {
    id: Date.now(),
    voucherId: String(voucherId),
    voucherType,
    token,
    printerName: printerName || "",
    requestedAt: new Date().toISOString(),
  };

  fs.writeFileSync(queueFile, JSON.stringify(job), "utf8");
  res.json({ success: true, message: "Print request sent to server printer." });
});

export default router;
