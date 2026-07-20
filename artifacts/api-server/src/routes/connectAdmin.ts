import { Router } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { connectionsTable, customersTable, partiesTable, customerChatMessagesTable, businessesTable } from "@workspace/db";
import { eq, and, desc, isNotNull, ne } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";

// Supplier-side management of BizCor Connect (mini app) connections.
// Deliberately low-key: one Settings screen, no badges or dashboards — the
// supplier's ERP must keep feeling offline. Sharing is something the supplier
// DID (gave a PIN), and this is the one place they see and control it.
//
// Connect data (like Gallery) only ever lives in the CLOUD Postgres DB — a
// desktop/LAN business's own local businessId has no relation to its cloud
// id, so trusting req.user.businessId here silently returns nothing for
// every LAN business (this was the actual cause of a connected customer
// like "Aashu Collection" never showing up in this screen even though their
// invoice was visible in their own Connect app). Resolve by businessCode
// instead, same dual-secret JWT pattern as routes/gallery.ts.
const JWT_SECRET = process.env.SESSION_SECRET || "erp-secret-key";
const LAN_DESKTOP_SECRET = "BizCorDesktop2025!SecretKey#LAN";

function verifyBusinessToken(authHeader: string | undefined): { businessId?: number; businessCode?: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  for (const secret of [JWT_SECRET, LAN_DESKTOP_SECRET]) {
    try { return jwt.verify(token, secret) as { businessId?: number; businessCode?: string }; } catch { /* try next */ }
  }
  return null;
}

async function requireConnectBusiness(req: any, res: any, next: any): Promise<void> {
  const payload = verifyBusinessToken(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  const code = (req.body?.businessCode || req.query?.businessCode) as string | undefined;
  let business: { id: number } | null = null;
  if (code) {
    const [row] = await db.select({ id: businessesTable.id }).from(businessesTable)
      .where(eq(businessesTable.businessCode, code.toUpperCase())).limit(1);
    business = row || null;
  } else if (payload.businessId) {
    const [row] = await db.select({ id: businessesTable.id }).from(businessesTable)
      .where(eq(businessesTable.id, payload.businessId)).limit(1);
    business = row || null;
  }
  if (!business) { res.status(404).json({ error: "Business not found" }); return; }
  req.connectBusinessId = business.id;
  next();
}

const router = Router();
router.use(requireConnectBusiness);

// GET /connect/connections — who is connected to this business
router.get("/connections", async (req, res) => {
  try {
    const businessId = (req as any).connectBusinessId as number;
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

// GET /connect/invited — parties the supplier gave a PIN to (mini-app access
// granted), each flagged with whether they've actually connected yet. Without
// this the supplier can only see who connected, not who they invited.
router.get("/invited", async (req, res) => {
  try {
    const businessId = (req as any).connectBusinessId as number;
    const parties = await db.select({
      partyId: partiesTable.id,
      name: partiesTable.name,
      phone: partiesTable.phone,
      pin: partiesTable.pin,
      miniAppEnabled: partiesTable.miniAppEnabled,
    }).from(partiesTable)
      .where(and(
        eq(partiesTable.businessId, businessId),
        isNotNull(partiesTable.pin),
        ne(partiesTable.pin, "")
      ))
      .orderBy(partiesTable.name);

    const conns = await db.select({ partyId: connectionsTable.partyId }).from(connectionsTable)
      .where(eq(connectionsTable.businessId, businessId));
    const connectedIds = new Set(conns.map((c) => c.partyId));

    res.json(parties.map((p) => ({ ...p, connected: connectedIds.has(p.partyId) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /connect/connections/:id — permissions and/or status (active | blocked)
router.patch("/connections/:id", async (req, res) => {
  try {
    const businessId = (req as any).connectBusinessId as number;
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
    const businessId = (req as any).connectBusinessId as number;
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
