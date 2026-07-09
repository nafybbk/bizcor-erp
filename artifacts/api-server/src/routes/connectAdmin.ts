import { Router } from "express";
import { db } from "@workspace/db";
import { connectionsTable, customersTable, partiesTable, customerChatMessagesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";
import { logActivity } from "../lib/activityLog";

// Supplier-side management of BizCor Connect (mini app) connections.
// Deliberately low-key: one Settings screen, no badges or dashboards — the
// supplier's ERP must keep feeling offline. Sharing is something the supplier
// DID (gave a PIN), and this is the one place they see and control it.
const router = Router();
router.use(requireBusiness);

// GET /connect/connections — who is connected to this business
router.get("/connections", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const rows = await db.select({
      id: connectionsTable.id,
      partyId: connectionsTable.partyId,
      partyName: partiesTable.name,
      customerMobile: customersTable.mobile,
      customerName: customersTable.name,
      permissions: connectionsTable.permissions,
      status: connectionsTable.status,
      createdAt: connectionsTable.createdAt,
    }).from(connectionsTable)
      .leftJoin(partiesTable, eq(connectionsTable.partyId, partiesTable.id))
      .leftJoin(customersTable, eq(connectionsTable.customerId, customersTable.id))
      .where(eq(connectionsTable.businessId, businessId))
      .orderBy(desc(connectionsTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /connect/connections/:id — permissions and/or status (active | blocked)
router.patch("/connections/:id", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const id = Number(req.params.id);
    const { permissions, status } = req.body || {};

    const updateData: Record<string, unknown> = {};
    if (permissions && typeof permissions === "object") {
      updateData.permissions = {
        invoice: permissions.invoice !== false,
        payment: permissions.payment !== false,
        statement: permissions.statement !== false,
        gallery: permissions.gallery === true,
      };
    }
    if (status === "active" || status === "blocked") updateData.status = status;
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "Bad Request", message: "permissions ya status bhejo" });
      return;
    }

    const [updated] = await db.update(connectionsTable).set(updateData)
      .where(and(eq(connectionsTable.id, id), eq(connectionsTable.businessId, businessId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not Found" }); return; }

    const [party] = await db.select({ name: partiesTable.name }).from(partiesTable).where(eq(partiesTable.id, updated.partyId));
    logActivity(req, {
      action: "edited", entityType: "connection", entityId: updated.id, entityLabel: party?.name || String(updated.id),
      summary: `App connection "${party?.name || updated.id}" ki ${status ? `status ${status} ki` : "permissions badli"}`,
    });
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE /connect/connections/:id — disconnect (removes chat too)
router.delete("/connections/:id", async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const id = Number(req.params.id);
    const [conn] = await db.select().from(connectionsTable)
      .where(and(eq(connectionsTable.id, id), eq(connectionsTable.businessId, businessId)));
    if (!conn) { res.status(404).json({ error: "Not Found" }); return; }

    await db.delete(customerChatMessagesTable).where(eq(customerChatMessagesTable.connectionId, id));
    await db.delete(connectionsTable).where(eq(connectionsTable.id, id));

    const [party] = await db.select({ name: partiesTable.name }).from(partiesTable).where(eq(partiesTable.id, conn.partyId));
    logActivity(req, {
      action: "deleted", entityType: "connection", entityId: id, entityLabel: party?.name || String(id),
      summary: `App connection "${party?.name || id}" disconnect kiya`,
    });
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
