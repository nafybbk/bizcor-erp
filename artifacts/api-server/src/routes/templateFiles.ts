import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import fs from "fs";
import path from "path";

const router = Router();

// Templates folder structure (priority order):
//   1. <bizcor-db-folder>/reports/<reportType>.json  — external editable folder (desktop only)
//   2. templates/<businessId>/<reportType>.json       — per-business copies (app folder)
//   3. templates/defaults/<reportType>.json           — BizCor built-in defaults (read-only)
const TEMPLATES_DIR = path.resolve(process.cwd(), "templates");
const DEFAULTS_DIR = path.join(TEMPLATES_DIR, "defaults");

// Desktop mode: reports folder inside bizcor-db (externally editable)
function getExternalReportsDir(): string | null {
  const sqlitePath = process.env.SQLITE_PATH;
  if (!sqlitePath) return null;
  return path.join(path.dirname(sqlitePath), "reports");
}

function externalReportPath(reportType: string): string | null {
  const dir = getExternalReportsDir();
  if (!dir) return null;
  return path.join(dir, `${reportType}.json`);
}

// Auto-export report to external folder (so user can edit it externally)
function autoExportToExternal(reportType: string, data: any): void {
  try {
    const fpath = externalReportPath(reportType);
    if (!fpath) return;
    const dir = path.dirname(fpath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(fpath)) {
      // Only write if not already there — don't overwrite user's edits
      fs.writeFileSync(fpath, JSON.stringify(data, null, 2), "utf-8");
    }
  } catch { /* ignore */ }
}

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

function defaultPath(reportType: string): string {
  return path.join(DEFAULTS_DIR, `${reportType}.json`);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(fpath: string): any {
  return JSON.parse(fs.readFileSync(fpath, "utf-8"));
}

// ── List available template files ─────────────────────────────────────────────
// Returns per-business files + any defaults not yet customized (as source=default)
router.get("/template-files", requireAuth, (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const dir = businessDir(businessId);

    // Collect business-specific files
    const businessFiles: Record<string, { reportType: string; source: string; sizeBytes: number; modifiedAt: string }> = {};
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir)
        .filter(f => f.endsWith(".json") && !f.includes(".backup."))
        .forEach(f => {
          const reportType = f.replace(".json", "");
          const fpath = path.join(dir, f);
          const stat = fs.statSync(fpath);
          businessFiles[reportType] = {
            reportType,
            source: "business",
            sizeBytes: stat.size,
            modifiedAt: stat.mtime.toISOString(),
          };
        });
    }

    // Add defaults that haven't been customized yet
    const files = [...Object.values(businessFiles)];
    if (fs.existsSync(DEFAULTS_DIR)) {
      fs.readdirSync(DEFAULTS_DIR)
        .filter(f => f.endsWith(".json"))
        .forEach(f => {
          const reportType = f.replace(".json", "");
          if (!businessFiles[reportType]) {
            const fpath = path.join(DEFAULTS_DIR, f);
            const stat = fs.statSync(fpath);
            files.push({
              reportType,
              source: "default",
              sizeBytes: stat.size,
              modifiedAt: stat.mtime.toISOString(),
            });
          }
        });
    }

    res.json({
      files,
      folder: dir,
      defaultsAvailable: VALID_REPORT_TYPES,
    });
  } catch (err: any) {
    req.log.error({ err }, "list template-files failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ── Get single template file (external → business → defaults fallback) ──────────
router.get("/template-files/:reportType", requireAuth, (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const reportType = String(req.params.reportType);

    if (!/^[a-z0-9_]+$/.test(reportType)) {
      res.status(400).json({ error: "Invalid reportType" }); return;
    }

    // 1. External editable folder (bizcor-db/reports/) — desktop only, highest priority
    const extPath = externalReportPath(reportType);
    if (extPath && fs.existsSync(extPath)) {
      const data = readJson(extPath);
      res.json({ ...data, _source: "external" });
      return;
    }

    // 2. Business-specific file (app templates folder)
    const bizPath = templatePath(businessId, reportType);
    if (fs.existsSync(bizPath)) {
      const data = readJson(bizPath);
      autoExportToExternal(reportType, data);
      res.json({ ...data, _source: "business" });
      return;
    }

    // 3. Fallback to BizCor default
    const defPath = defaultPath(reportType);
    if (fs.existsSync(defPath)) {
      const data = readJson(defPath);
      autoExportToExternal(reportType, data);
      res.json({ ...data, _source: "default" });
      return;
    }

    res.status(404).json({ error: "Template nahi mila" });
  } catch (err: any) {
    req.log.error({ err }, "get template-file failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ── Get original BizCor default (never modified) ──────────────────────────────
router.get("/template-files/:reportType/default", requireAuth, (req, res) => {
  try {
    const reportType = String(req.params.reportType);

    if (!/^[a-z0-9_]+$/.test(reportType)) {
      res.status(400).json({ error: "Invalid reportType" }); return;
    }

    const defPath = defaultPath(reportType);
    if (!fs.existsSync(defPath)) {
      res.status(404).json({ error: "Default template nahi mila" }); return;
    }

    const data = readJson(defPath);
    res.json({ ...data, _source: "bizcor_default" });
  } catch (err: any) {
    req.log.error({ err }, "get default template-file failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ── Seed all defaults into business folder (first-time setup) ─────────────────
// POST /api/template-files/seed-defaults
// Copies all BizCor defaults into the business's folder (skips existing files)
router.post("/template-files/seed-defaults", requireAuth, (req, res) => {
  try {
    if (req.user!.role === "staff") {
      res.status(403).json({ error: "Sirf Admin seed kar sakta hai" }); return;
    }
    const businessId = req.user!.businessId!;
    const dir = businessDir(businessId);
    const overwrite = req.body?.overwrite === true;

    if (!fs.existsSync(DEFAULTS_DIR)) {
      res.status(503).json({ error: "BizCor defaults folder nahi mila" }); return;
    }

    ensureDir(dir);

    const results: Array<{ reportType: string; status: string }> = [];
    const defaultFiles = fs.readdirSync(DEFAULTS_DIR).filter(f => f.endsWith(".json"));

    for (const fname of defaultFiles) {
      const reportType = fname.replace(".json", "");
      const destPath = path.join(dir, fname);
      const alreadyExists = fs.existsSync(destPath);

      if (alreadyExists && !overwrite) {
        results.push({ reportType, status: "skipped" });
        continue;
      }

      const srcData = readJson(path.join(DEFAULTS_DIR, fname));
      const payload = {
        ...srcData,
        _bizcor_file_template: true,
        _seeded_from_default: true,
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(destPath, JSON.stringify(payload, null, 2), "utf-8");
      results.push({ reportType, status: alreadyExists ? "overwritten" : "seeded" });
    }

    res.json({ success: true, results });
  } catch (err: any) {
    req.log.error({ err }, "seed-defaults failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ── Save template file (backup old → save new) ────────────────────────────────
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

    // Backup existing file before overwriting
    if (fs.existsSync(fpath)) {
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const backupPath = path.join(dir, `${reportType}.backup.${ts}.json`);
      fs.copyFileSync(fpath, backupPath);
    }

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

// ── List backups for a report type ────────────────────────────────────────────
router.get("/template-files/:reportType/backups", requireAuth, (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const reportType = String(req.params.reportType);

    if (!/^[a-z0-9_]+$/.test(reportType)) {
      res.status(400).json({ error: "Invalid reportType" }); return;
    }

    const dir = businessDir(businessId);
    if (!fs.existsSync(dir)) { res.json({ backups: [] }); return; }

    const backups = fs.readdirSync(dir)
      .filter(f => f.startsWith(`${reportType}.backup.`) && f.endsWith(".json"))
      .sort()
      .reverse()
      .map(f => {
        const stat = fs.statSync(path.join(dir, f));
        return { fileName: f, sizeBytes: stat.size, modifiedAt: stat.mtime.toISOString() };
      });

    res.json({ backups });
  } catch (err: any) {
    req.log.error({ err }, "list backups failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ── Restore from backup ───────────────────────────────────────────────────────
router.post("/template-files/:reportType/restore", requireAuth, (req, res) => {
  try {
    if (req.user!.role === "staff") {
      res.status(403).json({ error: "Sirf Admin restore kar sakta hai" }); return;
    }
    const businessId = req.user!.businessId!;
    const reportType = String(req.params.reportType);
    const { fileName } = req.body;

    if (!fileName || !/^[a-z0-9_.\-]+\.json$/.test(fileName)) {
      res.status(400).json({ error: "Invalid fileName" }); return;
    }

    const dir = businessDir(businessId);
    const backupPath = path.join(dir, fileName);

    if (!fs.existsSync(backupPath)) {
      res.status(404).json({ error: "Backup file nahi mila" }); return;
    }

    // Backup current before restoring
    const mainPath = templatePath(businessId, reportType);
    if (fs.existsSync(mainPath)) {
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      fs.copyFileSync(mainPath, path.join(dir, `${reportType}.backup.${ts}.json`));
    }

    fs.copyFileSync(backupPath, mainPath);
    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "restore backup failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ── Reset to BizCor default ───────────────────────────────────────────────────
router.post("/template-files/:reportType/reset-to-default", requireAuth, (req, res) => {
  try {
    if (req.user!.role === "staff") {
      res.status(403).json({ error: "Sirf Admin reset kar sakta hai" }); return;
    }
    const businessId = req.user!.businessId!;
    const reportType = String(req.params.reportType);

    if (!/^[a-z0-9_]+$/.test(reportType)) {
      res.status(400).json({ error: "Invalid reportType" }); return;
    }

    const defPath = defaultPath(reportType);
    if (!fs.existsSync(defPath)) {
      res.status(404).json({ error: "BizCor default nahi mila" }); return;
    }

    const dir = businessDir(businessId);
    ensureDir(dir);
    const mainPath = templatePath(businessId, reportType);

    // Backup current before resetting
    if (fs.existsSync(mainPath)) {
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      fs.copyFileSync(mainPath, path.join(dir, `${reportType}.backup.${ts}.json`));
    }

    const srcData = readJson(defPath);
    const payload = {
      ...srcData,
      _bizcor_file_template: true,
      _reset_from_default: true,
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(mainPath, JSON.stringify(payload, null, 2), "utf-8");

    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "reset-to-default failed");
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
      res.status(404).json({ error: "File nahi mila (default template delete nahi hoga)" }); return;
    }

    // Move to backup instead of hard delete
    const dir = businessDir(businessId);
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    fs.renameSync(fpath, path.join(dir, `${reportType}.backup.${ts}.json`));

    res.json({ success: true, note: "File backup mein move hui — ab default template load hoga" });
  } catch (err: any) {
    req.log.error({ err }, "delete template-file failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

export default router;
