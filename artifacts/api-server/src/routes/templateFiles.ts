import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import fs from "fs";
import path from "path";

const router = Router();

// Templates folder: <project-root>/templates/<businessId>/
const TEMPLATES_DIR = path.resolve(process.cwd(), "templates");

const VALID_REPORT_TYPES = [
  "sales_invoice",
  "credit_note",
  "purchase_bill",
  "debit_note",
];

function businessDir(businessId: number): string {
  return path.join(TEMPLATES_DIR, String(businessId));
}

function templatePath(businessId: number, reportType: string): string {
  return path.join(businessDir(businessId), `${reportType}.json`);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── List available template files ─────────────────────────────────────────────
router.get("/template-files", requireAuth, (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const dir = businessDir(businessId);
    if (!fs.existsSync(dir)) { res.json({ files: [] }); return; }

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const reportType = f.replace(".json", "");
        const filePath = path.join(dir, f);
        const stat = fs.statSync(filePath);
        return {
          reportType,
          fileName: f,
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          isKnown: VALID_REPORT_TYPES.includes(reportType),
        };
      });

    res.json({ files, folder: dir });
  } catch (err: any) {
    req.log.error({ err }, "list template-files failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ── Get single template file ───────────────────────────────────────────────────
router.get("/template-files/:reportType", requireAuth, (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const reportType = String(req.params.reportType);

    // Security: only allow alphanumeric + underscore
    if (!/^[a-z0-9_]+$/.test(reportType)) {
      res.status(400).json({ error: "Invalid reportType" }); return;
    }

    const fpath = templatePath(businessId, reportType);
    if (!fs.existsSync(fpath)) {
      res.status(404).json({ error: "File nahi mila" }); return;
    }

    const content = fs.readFileSync(fpath, "utf-8");
    const data = JSON.parse(content);
    res.json(data);
  } catch (err: any) {
    req.log.error({ err }, "get template-file failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ── Save template file (overwrite) ────────────────────────────────────────────
router.put("/template-files/:reportType", requireAuth, (req, res) => {
  try {
    if (req.user!.role === "staff") {
      res.status(403).json({ error: "Sirf Admin template file save kar sakta hai" }); return;
    }
    const businessId = req.user!.businessId!;
    const reportType = String(req.params.reportType);

    if (!/^[a-z0-9_]+$/.test(reportType)) {
      res.status(400).json({ error: "Invalid reportType" }); return;
    }

    const dir = businessDir(businessId);
    ensureDir(dir);

    const fpath = templatePath(businessId, reportType);
    const payload = {
      _bizcor_file_template: true,
      savedAt: new Date().toISOString(),
      ...req.body,
    };

    fs.writeFileSync(fpath, JSON.stringify(payload, null, 2), "utf-8");

    res.json({
      success: true,
      filePath: fpath,
      reportType,
      savedAt: payload.savedAt,
    });
  } catch (err: any) {
    req.log.error({ err }, "save template-file failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ── Delete template file ──────────────────────────────────────────────────────
router.delete("/template-files/:reportType", requireAuth, (req, res) => {
  try {
    if (req.user!.role === "staff") {
      res.status(403).json({ error: "Sirf Admin template file delete kar sakta hai" }); return;
    }
    const businessId = req.user!.businessId!;
    const reportType = String(req.params.reportType);

    if (!/^[a-z0-9_]+$/.test(reportType)) {
      res.status(400).json({ error: "Invalid reportType" }); return;
    }

    const fpath = templatePath(businessId, reportType);
    if (!fs.existsSync(fpath)) {
      res.status(404).json({ error: "File nahi mila" }); return;
    }

    fs.unlinkSync(fpath);
    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "delete template-file failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

export default router;
