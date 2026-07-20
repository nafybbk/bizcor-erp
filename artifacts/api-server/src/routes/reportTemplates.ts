import { Router } from "express";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// SI01/SI02/... (editable working reports) and SIT01/SIT02/... (frozen,
// "Save As Template" snapshots) are auto-named server-side — the client never
// picks a name, so there's never a naming collision or confusion about which
// is which. Prefix is per reportType; unlisted types fall back to initials.
const REPORT_PREFIX: Record<string, string> = {
  sales_invoice: "SI", purchase_bill: "PB", credit_note: "CN", debit_note: "DN",
  receipt: "RC", payment: "PY", quotation: "QT", delivery_challan: "DC",
};
function prefixFor(reportType: string): string {
  return REPORT_PREFIX[reportType] || reportType.split("_").map(w => w[0]?.toUpperCase() || "").join("").slice(0, 3) || "RT";
}

async function nextName(db: any, reportTemplatesTable: any, and: any, eq: any, businessId: number, reportType: string, asTemplate: boolean): Promise<string> {
  const prefix = prefixFor(reportType) + (asTemplate ? "T" : "");
  const rows = await db.select({ name: reportTemplatesTable.name }).from(reportTemplatesTable)
    .where(and(eq(reportTemplatesTable.businessId, businessId), eq(reportTemplatesTable.reportType, reportType)));
  const re = new RegExp(`^${prefix}(\\d{2})$`);
  let max = 0;
  for (const r of rows as { name: string }[]) {
    const m = re.exec(r.name);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

// ─── List templates for business ──────────────────────────────────────────────
router.get("/report-templates", requireAuth, async (req, res) => {
  try {
    const { db, reportTemplatesTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");
    const businessId = req.user!.businessId!;
    const reportType = req.query.report_type as string | undefined;

    const conditions = [eq(reportTemplatesTable.businessId, businessId)];
    if (reportType) conditions.push(eq(reportTemplatesTable.reportType, String(reportType)));

    const templates = await db
      .select()
      .from(reportTemplatesTable)
      .where(and(...conditions))
      .orderBy(reportTemplatesTable.reportType, reportTemplatesTable.name);

    res.json(templates);
  } catch (err: any) {
    req.log.error({ err }, "list report-templates failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ─── Get single template ───────────────────────────────────────────────────────
router.get("/report-templates/:id", requireAuth, async (req, res) => {
  try {
    const { db, reportTemplatesTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");
    const businessId = req.user!.businessId!;
    const id = parseInt(String(req.params.id));

    const [tmpl] = await db
      .select()
      .from(reportTemplatesTable)
      .where(and(eq(reportTemplatesTable.id, id), eq(reportTemplatesTable.businessId, businessId)))
      .limit(1);

    if (!tmpl) { res.status(404).json({ error: "Template nahi mila" }); return; }
    res.json(tmpl);
  } catch (err: any) {
    req.log.error({ err }, "get report-template failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ─── Create template (Admin only) ─────────────────────────────────────────────
router.post("/report-templates", requireAuth, async (req, res) => {
  try {
    if (req.user!.role === "staff") {
      res.status(403).json({ error: "Sirf Admin template bana sakta hai" });
      return;
    }
    const { db, reportTemplatesTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");
    const businessId = req.user!.businessId!;
    // `name` is intentionally NOT accepted from the client — every template is
    // auto-named SI{nn}/SIT{nn} server-side so there's a single source of
    // truth for numbering. `asTemplate`/`isSystemDefault` control naming+lock.
    const { reportType, paperSize, orientation, isDefault, layoutJson, asTemplate, isSystemDefault } = req.body;

    if (!reportType) {
      res.status(400).json({ error: "reportType required hai" });
      return;
    }

    // If setting as default, unset others for this reportType
    if (isDefault) {
      await db
        .update(reportTemplatesTable)
        .set({ isDefault: false })
        .where(and(eq(reportTemplatesTable.businessId, businessId), eq(reportTemplatesTable.reportType, reportType)));
    }

    const name = isSystemDefault ? "Default" : await nextName(db, reportTemplatesTable, and, eq, businessId, reportType, !!asTemplate);

    const [created] = await db
      .insert(reportTemplatesTable)
      .values({
        businessId,
        name,
        reportType,
        paperSize: paperSize || "A4",
        orientation: orientation || "portrait",
        version: 1,
        isDefault: !!isDefault,
        locked: !!asTemplate || !!isSystemDefault,
        layoutJson: layoutJson || null,
        createdByUserId: req.user!.id,
      })
      .returning();

    res.status(201).json(created);
  } catch (err: any) {
    req.log.error({ err }, "create report-template failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ─── Update template (Admin only) — bumps version ─────────────────────────────
router.put("/report-templates/:id", requireAuth, async (req, res) => {
  try {
    if (req.user!.role === "staff") {
      res.status(403).json({ error: "Sirf Admin template edit kar sakta hai" });
      return;
    }
    const { db, reportTemplatesTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");
    const businessId = req.user!.businessId!;
    const id = parseInt(String(req.params.id));

    const [existing] = await db
      .select()
      .from(reportTemplatesTable)
      .where(and(eq(reportTemplatesTable.id, id), eq(reportTemplatesTable.businessId, businessId)))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "Template nahi mila" }); return; }
    if (existing.locked) {
      res.status(403).json({ error: "Yeh template locked hai — isse edit nahi kar sakte. 'Use as New' se ek naya editable copy bana lo." });
      return;
    }

    const { paperSize, orientation, isDefault, layoutJson } = req.body;

    // If setting as default, unset others for this reportType
    if (isDefault) {
      await db
        .update(reportTemplatesTable)
        .set({ isDefault: false })
        .where(and(eq(reportTemplatesTable.businessId, businessId), eq(reportTemplatesTable.reportType, existing.reportType)));
    }

    const [updated] = await db
      .update(reportTemplatesTable)
      .set({
        paperSize: paperSize ?? existing.paperSize,
        orientation: orientation ?? existing.orientation,
        isDefault: isDefault !== undefined ? !!isDefault : existing.isDefault,
        layoutJson: layoutJson !== undefined ? layoutJson : existing.layoutJson,
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(reportTemplatesTable.id, id), eq(reportTemplatesTable.businessId, businessId)))
      .returning();

    res.json(updated);
  } catch (err: any) {
    req.log.error({ err }, "update report-template failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ─── Delete template (Admin only) ─────────────────────────────────────────────
router.delete("/report-templates/:id", requireAuth, async (req, res) => {
  try {
    if (req.user!.role === "staff") {
      res.status(403).json({ error: "Sirf Admin template delete kar sakta hai" });
      return;
    }
    const { db, reportTemplatesTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");
    const businessId = req.user!.businessId!;
    const id = parseInt(String(req.params.id));

    const [existing] = await db
      .select({ id: reportTemplatesTable.id })
      .from(reportTemplatesTable)
      .where(and(eq(reportTemplatesTable.id, id), eq(reportTemplatesTable.businessId, businessId)))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "Template nahi mila" }); return; }

    await db
      .delete(reportTemplatesTable)
      .where(and(eq(reportTemplatesTable.id, id), eq(reportTemplatesTable.businessId, businessId)));

    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "delete report-template failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ─── Set default (Admin only) ──────────────────────────────────────────────────
router.post("/report-templates/:id/set-default", requireAuth, async (req, res) => {
  try {
    if (req.user!.role === "staff") {
      res.status(403).json({ error: "Sirf Admin default set kar sakta hai" });
      return;
    }
    const { db, reportTemplatesTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");
    const businessId = req.user!.businessId!;
    const id = parseInt(String(req.params.id));

    const [existing] = await db
      .select()
      .from(reportTemplatesTable)
      .where(and(eq(reportTemplatesTable.id, id), eq(reportTemplatesTable.businessId, businessId)))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "Template nahi mila" }); return; }

    // Unset all defaults for this reportType
    await db
      .update(reportTemplatesTable)
      .set({ isDefault: false })
      .where(and(eq(reportTemplatesTable.businessId, businessId), eq(reportTemplatesTable.reportType, existing.reportType)));

    // Set this one as default
    await db
      .update(reportTemplatesTable)
      .set({ isDefault: true })
      .where(eq(reportTemplatesTable.id, id));

    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "set-default report-template failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ─── Duplicate / "Use as New" (Admin only) — forks ANY row (SI, SIT, or the
// system Default) into a brand-new, unlocked, auto-named SI so it can be
// freely edited — the source row itself is never touched. ────────────────────
router.post("/report-templates/:id/duplicate", requireAuth, async (req, res) => {
  try {
    if (req.user!.role === "staff") {
      res.status(403).json({ error: "Sirf Admin template duplicate kar sakta hai" });
      return;
    }
    const { db, reportTemplatesTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");
    const businessId = req.user!.businessId!;
    const id = parseInt(String(req.params.id));

    const [existing] = await db
      .select()
      .from(reportTemplatesTable)
      .where(and(eq(reportTemplatesTable.id, id), eq(reportTemplatesTable.businessId, businessId)))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "Template nahi mila" }); return; }

    const name = await nextName(db, reportTemplatesTable, and, eq, businessId, existing.reportType, false);
    const [copy] = await db
      .insert(reportTemplatesTable)
      .values({
        businessId,
        name,
        reportType: existing.reportType,
        paperSize: existing.paperSize,
        orientation: existing.orientation,
        version: 1,
        isDefault: false,
        locked: false,
        layoutJson: existing.layoutJson,
        createdByUserId: req.user!.id,
      })
      .returning();

    res.status(201).json(copy);
  } catch (err: any) {
    req.log.error({ err }, "duplicate report-template failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ─── Export template as JSON ───────────────────────────────────────────────────
router.get("/report-templates/:id/export", requireAuth, async (req, res) => {
  try {
    const { db, reportTemplatesTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");
    const businessId = req.user!.businessId!;
    const id = parseInt(String(req.params.id));

    const [tmpl] = await db
      .select()
      .from(reportTemplatesTable)
      .where(and(eq(reportTemplatesTable.id, id), eq(reportTemplatesTable.businessId, businessId)))
      .limit(1);

    if (!tmpl) { res.status(404).json({ error: "Template nahi mila" }); return; }

    const exportData = {
      _bizcor_template_export: true,
      exportedAt: new Date().toISOString(),
      name: tmpl.name,
      reportType: tmpl.reportType,
      paperSize: tmpl.paperSize,
      orientation: tmpl.orientation,
      version: tmpl.version,
      layoutJson: tmpl.layoutJson,
    };

    res.setHeader("Content-Disposition", `attachment; filename="${tmpl.name.replace(/[^a-z0-9]/gi, "_")}_v${tmpl.version}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(exportData);
  } catch (err: any) {
    req.log.error({ err }, "export report-template failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

// ─── Import template from JSON (Admin only) ────────────────────────────────────
router.post("/report-templates/import", requireAuth, async (req, res) => {
  try {
    if (req.user!.role === "staff") {
      res.status(403).json({ error: "Sirf Admin template import kar sakta hai" });
      return;
    }
    const { db, reportTemplatesTable } = await import("@workspace/db");
    const businessId = req.user!.businessId!;
    const data = req.body;

    if (!data._bizcor_template_export) {
      res.status(400).json({ error: "Yeh valid BizCor template file nahi hai" });
      return;
    }

    const { name, reportType, paperSize, orientation, layoutJson } = data;
    if (!name || !reportType) {
      res.status(400).json({ error: "Template file incomplete hai" });
      return;
    }

    const [imported] = await db
      .insert(reportTemplatesTable)
      .values({
        businessId,
        name: `${name} (Imported)`,
        reportType,
        paperSize: paperSize || "A4",
        orientation: orientation || "portrait",
        version: 1,
        isDefault: false,
        layoutJson: layoutJson || null,
        createdByUserId: req.user!.id,
      })
      .returning();

    res.status(201).json(imported);
  } catch (err: any) {
    req.log.error({ err }, "import report-template failed");
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

export default router;
