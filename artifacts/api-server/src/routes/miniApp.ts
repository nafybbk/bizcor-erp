import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import {
  customersTable,
  connectionsTable,
  customerChatMessagesTable,
  businessesTable,
  partiesTable,
  vouchersTable,
  paymentsTable,
  appSettingsTable,
  lanSyncVouchersTable,
  lanSyncPaymentsTable,
} from "@workspace/db";
import { eq, and, gt, asc, desc, isNull, sql } from "drizzle-orm";
import { hasActiveModule, activatePendingPatches } from "../lib/modulePatches";

const router = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "erp-secret-key";

// ─── Simple in-memory rate limiter (per key, sliding window) ─────────────────
// Test-pass scope: PINs (login + connect) are short & persistent, so throttle
// brute-force attempts. Not distributed-safe — fine for single-instance API.
const attemptLog = new Map<string, number[]>();
function isRateLimited(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (attemptLog.get(key) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  attemptLog.set(key, hits);
  return hits.length > maxAttempts;
}

function generateCustomerId(): string {
  return "CN" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

interface CustomerAuthPayload {
  type: "customer";
  customerDbId: number;
  customerId: string;
  mobile: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      customer?: CustomerAuthPayload;
    }
  }
}

function requireCustomerAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Missing token" });
    return;
  }
  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as CustomerAuthPayload;
    if (decoded.type !== "customer") {
      res.status(401).json({ error: "Unauthorized", message: "Invalid token type" });
      return;
    }
    req.customer = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
  }
}

// GET /mini-app/settings — public branding info for the login screen (no auth).
// Phone is only returned if the tech panel has explicitly turned it on
// (supportPhoneVisible) — showing the platform owner's own number by default
// could put off suppliers whose customers would see it instead of the
// supplier's own contact details.
router.get("/mini-app/settings", async (req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value || "";
    const showPhone = settings.supportPhoneVisible === "true";
    res.json({
      softwareName: settings.softwareName || "BizCor",
      supportEmail: settings.supportEmail || "info@naewtgroup.com",
      supportPhone: showPhone ? settings.supportPhone || "" : "",
    });
  } catch (err) {
    req.log.error(err);
    res.json({ softwareName: "BizCor", supportEmail: "info@naewtgroup.com", supportPhone: "" });
  }
});

// POST /mini-app/login — mobile + PIN. Auto-creates account on first login (default PIN 1234).
router.post("/mini-app/login", async (req, res) => {
  try {
    const { mobile, pin } = req.body || {};
    if (!mobile?.trim() || !pin?.trim()) {
      res.status(400).json({ error: "Mobile number aur PIN dono zaroori hain" });
      return;
    }
    const mobileNorm = mobile.trim();

    if (isRateLimited(`login:${mobileNorm}`, 8, 15 * 60 * 1000)) {
      res.status(429).json({ error: "Bahut zyada attempts. Kuch der baad try karein." });
      return;
    }

    let [customer] = await db.select().from(customersTable).where(eq(customersTable.mobile, mobileNorm)).limit(1);

    if (!customer) {
      let customerId = generateCustomerId();
      const existing = await db.select({ id: customersTable.id }).from(customersTable).where(eq(customersTable.customerId, customerId)).limit(1);
      if (existing.length > 0) customerId = generateCustomerId();
      [customer] = await db.insert(customersTable).values({
        customerId,
        mobile: mobileNorm,
        pin: "1234",
      }).returning();
    }

    if (customer.pin !== pin.trim()) {
      res.status(401).json({ error: "Galat PIN" });
      return;
    }

    const token = jwt.sign(
      { type: "customer", customerDbId: customer.id, customerId: customer.customerId, mobile: customer.mobile } satisfies CustomerAuthPayload,
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({ token, customer: { customerId: customer.customerId, mobile: customer.mobile, name: customer.name } });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.use("/mini-app", requireCustomerAuth);

// POST /mini-app/connect — businessCode + per-customer PIN (from supplier's Party master)
router.post("/mini-app/connect", async (req, res) => {
  try {
    const { businessCode, pin } = req.body || {};
    if (!businessCode?.trim() || !pin?.trim()) {
      res.status(400).json({ error: "Business code aur PIN dono zaroori hain" });
      return;
    }
    const customerDbId = req.customer!.customerDbId;

    if (isRateLimited(`connect:${customerDbId}`, 10, 15 * 60 * 1000)) {
      res.status(429).json({ error: "Bahut zyada attempts. Kuch der baad try karein." });
      return;
    }

    const [business] = await db.select().from(businessesTable).where(eq(businessesTable.businessCode, businessCode.trim().toUpperCase())).limit(1);
    if (!business) {
      res.status(404).json({ error: "Business code nahi mila" });
      return;
    }

    // LAN-only businesses log into their local EXE, never the cloud, so a
    // tech-panel patch can sit "pending" forever — a customer connecting is
    // this module's real first use, so activate here too.
    try {
      await activatePendingPatches(business.id);
    } catch { /* non-critical */ }

    if (!(await hasActiveModule(business.id, "customer_network"))) {
      res.status(403).json({ error: "Yeh business abhi Customer Network module use nahi kar raha" });
      return;
    }

    const [party] = await db.select().from(partiesTable).where(and(
      eq(partiesTable.businessId, business.id),
      eq(partiesTable.pin, pin.trim())
    )).limit(1);
    if (!party) {
      res.status(401).json({ error: "Galat PIN" });
      return;
    }
    if (party.miniAppEnabled === false) {
      res.status(403).json({ error: "Is customer ki app connectivity supplier ne band kar di hai" });
      return;
    }

    const [existing] = await db.select().from(connectionsTable).where(and(
      eq(connectionsTable.customerId, customerDbId),
      eq(connectionsTable.businessId, business.id),
      eq(connectionsTable.partyId, party.id)
    )).limit(1);

    const connection = existing || (await db.insert(connectionsTable).values({
      customerId: customerDbId,
      businessId: business.id,
      partyId: party.id,
    }).returning())[0];

    res.json({
      connection: {
        id: connection.id,
        businessName: business.name,
        businessLogo: business.logo,
        permissions: connection.permissions,
        status: connection.status,
      },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /mini-app/connections — list all connected suppliers
router.get("/mini-app/connections", async (req, res) => {
  try {
    const customerDbId = req.customer!.customerDbId;
    const rows = await db.select({
      id: connectionsTable.id,
      permissions: connectionsTable.permissions,
      status: connectionsTable.status,
      businessName: businessesTable.name,
      businessLogo: businessesTable.logo,
      createdAt: connectionsTable.createdAt,
    }).from(connectionsTable)
      .innerJoin(businessesTable, eq(connectionsTable.businessId, businessesTable.id))
      .where(eq(connectionsTable.customerId, customerDbId))
      .orderBy(desc(connectionsTable.createdAt));

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

async function getOwnedConnection(customerDbId: number, connectionId: number) {
  const [connection] = await db.select().from(connectionsTable).where(and(
    eq(connectionsTable.id, connectionId),
    eq(connectionsTable.customerId, customerDbId)
  )).limit(1);
  // Blocked by the supplier → behave as if the connection doesn't exist
  if (connection?.status === "blocked") return undefined;
  return connection;
}

// GET /mini-app/connections/:id/messages/recent — last 50 (initial load)
router.get("/mini-app/connections/:id/messages/recent", async (req, res) => {
  try {
    const connection = await getOwnedConnection(req.customer!.customerDbId, Number(req.params.id));
    if (!connection) { res.status(404).json({ error: "Connection nahi mili" }); return; }

    const rows = await db.select().from(customerChatMessagesTable)
      .where(eq(customerChatMessagesTable.connectionId, connection.id))
      .orderBy(desc(customerChatMessagesTable.id))
      .limit(50);
    res.json(rows.reverse());
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /mini-app/connections/:id/messages?since=<id> — poll for new messages
router.get("/mini-app/connections/:id/messages", async (req, res) => {
  try {
    const connection = await getOwnedConnection(req.customer!.customerDbId, Number(req.params.id));
    if (!connection) { res.status(404).json({ error: "Connection nahi mili" }); return; }
    const sinceId = parseInt(req.query.since as string) || 0;

    const rows = await db.select().from(customerChatMessagesTable)
      .where(sinceId > 0
        ? and(eq(customerChatMessagesTable.connectionId, connection.id), gt(customerChatMessagesTable.id, sinceId))
        : eq(customerChatMessagesTable.connectionId, connection.id)
      )
      .orderBy(asc(customerChatMessagesTable.id))
      .limit(100);
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /mini-app/connections/:id/messages — send text message (test chat)
router.post("/mini-app/connections/:id/messages", async (req, res) => {
  try {
    const connection = await getOwnedConnection(req.customer!.customerDbId, Number(req.params.id));
    if (!connection) { res.status(404).json({ error: "Connection nahi mili" }); return; }
    const { message } = req.body || {};
    if (!message?.trim()) { res.status(400).json({ error: "Message zaroori hai" }); return; }

    const [row] = await db.insert(customerChatMessagesTable).values({
      connectionId: connection.id,
      senderType: "customer",
      senderName: req.customer!.mobile,
      message: message.trim(),
    }).returning();
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /mini-app/connections/:id/payments — receipts from the supplier for this party
router.get("/mini-app/connections/:id/payments", async (req, res) => {
  try {
    const connection = await getOwnedConnection(req.customer!.customerDbId, Number(req.params.id));
    if (!connection) { res.status(404).json({ error: "Connection nahi mili" }); return; }

    const permissions = (connection.permissions as { payment?: boolean } | null) || {};
    if (permissions.payment === false) {
      res.status(403).json({ error: "Payment dekhne ki permission nahi hai" });
      return;
    }

    const cloudPayRows = await db.select({
      id: paymentsTable.id,
      paymentNumber: paymentsTable.paymentNumber,
      date: paymentsTable.date,
      amount: paymentsTable.amount,
      paymentMode: paymentsTable.paymentMode,
      notes: paymentsTable.notes,
    }).from(paymentsTable)
      .where(and(
        eq(paymentsTable.businessId, connection.businessId),
        eq(paymentsTable.partyId, connection.partyId),
        eq(paymentsTable.type, "receipt"),
        isNull(paymentsTable.deletedAt),
      ))
      .orderBy(desc(paymentsTable.date));

    const lanPayRows = await db.select({
      id: lanSyncPaymentsTable.id,
      paymentNumber: lanSyncPaymentsTable.paymentNumber,
      date: lanSyncPaymentsTable.date,
      amount: lanSyncPaymentsTable.amount,
      paymentMode: lanSyncPaymentsTable.paymentMode,
      notes: lanSyncPaymentsTable.notes,
    }).from(lanSyncPaymentsTable)
      .where(and(
        eq(lanSyncPaymentsTable.businessId, connection.businessId),
        eq(lanSyncPaymentsTable.partyId, connection.partyId),
        eq(lanSyncPaymentsTable.paymentType, "receipt"),
        sql`${lanSyncPaymentsTable.status} IS DISTINCT FROM 'deleted'`,
      ))
      .orderBy(desc(lanSyncPaymentsTable.date));

    const mergedPay = [
      ...cloudPayRows.map(r => ({ ...r, amount: Number(r.amount) })),
      ...lanPayRows.map(r => ({ ...r, amount: Number(r.amount) })),
    ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

    res.json(mergedPay);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /mini-app/connections/:id/statement — running balance ledger (invoices + receipts)
router.get("/mini-app/connections/:id/statement", async (req, res) => {
  try {
    const connection = await getOwnedConnection(req.customer!.customerDbId, Number(req.params.id));
    if (!connection) { res.status(404).json({ error: "Connection nahi mili" }); return; }

    const permissions = (connection.permissions as { statement?: boolean } | null) || {};
    if (permissions.statement === false) {
      res.status(403).json({ error: "Statement dekhne ki permission nahi hai" });
      return;
    }

    const invoices = await db.select({
      id: vouchersTable.id,
      ref: vouchersTable.voucherNumber,
      date: vouchersTable.date,
      amount: vouchersTable.grandTotal,
    }).from(vouchersTable)
      .where(and(
        eq(vouchersTable.businessId, connection.businessId),
        eq(vouchersTable.partyId, connection.partyId),
        eq(vouchersTable.voucherType, "sales_invoice"),
        isNull(vouchersTable.deletedAt),
      ));

    const lanInvoices = await db.select({
      id: lanSyncVouchersTable.id,
      ref: lanSyncVouchersTable.voucherNumber,
      date: lanSyncVouchersTable.date,
      amount: lanSyncVouchersTable.grandTotal,
    }).from(lanSyncVouchersTable)
      .where(and(
        eq(lanSyncVouchersTable.businessId, connection.businessId),
        eq(lanSyncVouchersTable.partyId, connection.partyId),
        eq(lanSyncVouchersTable.voucherType, "sales_invoice"),
        sql`${lanSyncVouchersTable.status} IS DISTINCT FROM 'deleted'`,
      ));

    const receipts = await db.select({
      id: paymentsTable.id,
      ref: paymentsTable.paymentNumber,
      date: paymentsTable.date,
      amount: paymentsTable.amount,
    }).from(paymentsTable)
      .where(and(
        eq(paymentsTable.businessId, connection.businessId),
        eq(paymentsTable.partyId, connection.partyId),
        eq(paymentsTable.type, "receipt"),
        isNull(paymentsTable.deletedAt),
      ));

    const lanReceipts = await db.select({
      id: lanSyncPaymentsTable.id,
      ref: lanSyncPaymentsTable.paymentNumber,
      date: lanSyncPaymentsTable.date,
      amount: lanSyncPaymentsTable.amount,
    }).from(lanSyncPaymentsTable)
      .where(and(
        eq(lanSyncPaymentsTable.businessId, connection.businessId),
        eq(lanSyncPaymentsTable.partyId, connection.partyId),
        eq(lanSyncPaymentsTable.paymentType, "receipt"),
      ));

    type RawEntry = { id: number; type: "invoice" | "payment"; ref: string; date: string; debit: number; credit: number };
    const combined: RawEntry[] = [
      ...invoices.map(v => ({ id: v.id, type: "invoice" as const, ref: v.ref, date: v.date, debit: Number(v.amount), credit: 0 })),
      ...lanInvoices.map(v => ({ id: v.id, type: "invoice" as const, ref: v.ref, date: v.date, debit: Number(v.amount), credit: 0 })),
      ...receipts.map(p => ({ id: p.id, type: "payment" as const, ref: p.ref, date: p.date, debit: 0, credit: Number(p.amount) })),
      ...lanReceipts.map(p => ({ id: p.id, type: "payment" as const, ref: p.ref, date: p.date, debit: 0, credit: Number(p.amount) })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

    let balance = 0;
    const entries = combined.map(e => {
      balance += e.debit - e.credit;
      return { ...e, balance };
    });

    res.json({ entries, closingBalance: balance });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /mini-app/connections/:id/invoices — read-only sales invoices from the connected supplier
router.get("/mini-app/connections/:id/invoices", async (req, res) => {
  try {
    const connection = await getOwnedConnection(req.customer!.customerDbId, Number(req.params.id));
    if (!connection) { res.status(404).json({ error: "Connection nahi mili" }); return; }

    const permissions = (connection.permissions as { invoice?: boolean } | null) || {};
    if (permissions.invoice === false) {
      res.status(403).json({ error: "Invoice dekhne ki permission nahi hai" });
      return;
    }

    const cloudRows = await db.select({
      id: vouchersTable.id,
      voucherNumber: vouchersTable.voucherNumber,
      date: vouchersTable.date,
      grandTotal: vouchersTable.grandTotal,
    }).from(vouchersTable)
      .where(and(
        eq(vouchersTable.businessId, connection.businessId),
        eq(vouchersTable.partyId, connection.partyId),
        eq(vouchersTable.voucherType, "sales_invoice"),
        isNull(vouchersTable.deletedAt),
      ))
      .orderBy(desc(vouchersTable.date));

    const lanRows = await db.select({
      id: lanSyncVouchersTable.id,
      voucherNumber: lanSyncVouchersTable.voucherNumber,
      date: lanSyncVouchersTable.date,
      grandTotal: lanSyncVouchersTable.grandTotal,
    }).from(lanSyncVouchersTable)
      .where(and(
        eq(lanSyncVouchersTable.businessId, connection.businessId),
        eq(lanSyncVouchersTable.partyId, connection.partyId),
        eq(lanSyncVouchersTable.voucherType, "sales_invoice"),
        sql`${lanSyncVouchersTable.status} IS DISTINCT FROM 'deleted'`,
      ))
      .orderBy(desc(lanSyncVouchersTable.date));

    const merged = [
      ...cloudRows.map(r => ({ ...r, grandTotal: Number(r.grandTotal) })),
      ...lanRows.map(r => ({ ...r, grandTotal: Number(r.grandTotal) })),
    ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

    res.json(merged);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── LAN Sync endpoint (business JWT auth) ────────────────────────────────────
// LAN servers call this after saving a voucher/payment for a mini-app enabled party.
// The business JWT is verified, businessCode is used to find the cloud business,
// and partyPin is used to find the cloud partyId, then the record is upserted.

interface BusinessJwtPayload {
  id?: number;
  businessCode?: string;
  role?: string;
}

function verifyBusinessJwt(authHeader: string | undefined): BusinessJwtPayload | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.slice(7), JWT_SECRET) as BusinessJwtPayload;
  } catch {
    return null;
  }
}

router.post("/mini-app/lan-sync/voucher", async (req, res) => {
  try {
    const payload = verifyBusinessJwt(req.headers.authorization);
    if (!payload?.businessCode) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [business] = await db.select({ id: businessesTable.id })
      .from(businessesTable)
      .where(eq(businessesTable.businessCode, payload.businessCode.toUpperCase()))
      .limit(1);
    if (!business) { res.status(404).json({ error: "Business not found" }); return; }

    const { partyPin, partyName, externalId, voucherType, voucherNumber, date, grandTotal, status, notes } = req.body;

    const [party] = await db.select({ id: partiesTable.id })
      .from(partiesTable)
      .where(and(eq(partiesTable.businessId, business.id), eq(partiesTable.pin, partyPin)))
      .limit(1);
    if (!party) { res.status(404).json({ error: "Party not found by pin" }); return; }

    // Upsert — a re-push (edit/cancel/delete in the LAN ERP) replaces the previous copy
    await db.insert(lanSyncVouchersTable).values({
      businessId: business.id,
      partyId: party.id,
      externalId: Number(externalId),
      voucherType: String(voucherType),
      voucherNumber: String(voucherNumber),
      date: String(date),
      partyName: String(partyName || ""),
      grandTotal: String(grandTotal || 0),
      status: String(status || "posted"),
      notes: notes ? String(notes) : null,
    }).onConflictDoUpdate({
      target: [lanSyncVouchersTable.businessId, lanSyncVouchersTable.externalId, lanSyncVouchersTable.voucherType],
      set: {
        partyId: party.id,
        voucherNumber: String(voucherNumber),
        date: String(date),
        partyName: String(partyName || ""),
        grandTotal: String(grandTotal || 0),
        status: String(status || "posted"),
        notes: notes ? String(notes) : null,
        syncedAt: new Date(),
      },
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/mini-app/lan-sync/payment", async (req, res) => {
  try {
    const payload = verifyBusinessJwt(req.headers.authorization);
    if (!payload?.businessCode) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [business] = await db.select({ id: businessesTable.id })
      .from(businessesTable)
      .where(eq(businessesTable.businessCode, payload.businessCode.toUpperCase()))
      .limit(1);
    if (!business) { res.status(404).json({ error: "Business not found" }); return; }

    const { partyPin, partyName, externalId, paymentType, paymentNumber, date, amount, paymentMode, notes } = req.body;

    const [party] = await db.select({ id: partiesTable.id })
      .from(partiesTable)
      .where(and(eq(partiesTable.businessId, business.id), eq(partiesTable.pin, partyPin)))
      .limit(1);
    if (!party) { res.status(404).json({ error: "Party not found by pin" }); return; }

    const payStatus = String((req.body.status as string) || "posted");
    await db.insert(lanSyncPaymentsTable).values({
      businessId: business.id,
      partyId: party.id,
      externalId: Number(externalId),
      paymentType: String(paymentType),
      paymentNumber: String(paymentNumber),
      date: String(date),
      partyName: String(partyName || ""),
      amount: String(amount || 0),
      paymentMode: String(paymentMode || "cash"),
      status: payStatus,
      notes: notes ? String(notes) : null,
    }).onConflictDoUpdate({
      target: [lanSyncPaymentsTable.businessId, lanSyncPaymentsTable.externalId, lanSyncPaymentsTable.paymentType],
      set: {
        partyId: party.id,
        paymentNumber: String(paymentNumber),
        date: String(date),
        partyName: String(partyName || ""),
        amount: String(amount || 0),
        paymentMode: String(paymentMode || "cash"),
        status: payStatus,
        notes: notes ? String(notes) : null,
        syncedAt: new Date(),
      },
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
