import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import { db } from "@workspace/db";
import {
  customersTable,
  connectionsTable,
  customerChatMessagesTable,
  businessesTable,
  partiesTable,
  vouchersTable,
  voucherItemsTable,
  paymentsTable,
  appSettingsTable,
  lanSyncVouchersTable,
  lanSyncPaymentsTable,
  galleryImagesTable,
  gallerySharesTable,
} from "@workspace/db";
import { eq, and, gt, asc, desc, isNull, sql, inArray } from "drizzle-orm";
import { hasActiveModule, activatePendingPatches } from "../lib/modulePatches";

const router = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "erp-secret-key";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
const AVATAR_CLOUDINARY_FOLDER = "bizcor-customer-avatars";
const AVATAR_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: AVATAR_MAX_FILE_SIZE } });

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
    const { mobile, pin, deviceId } = req.body || {};
    if (!mobile?.trim() || !pin?.trim()) {
      res.status(400).json({ error: "Mobile number aur PIN dono zaroori hain" });
      return;
    }
    const mobileNorm = mobile.trim();
    const deviceIdNorm = typeof deviceId === "string" ? deviceId.trim().slice(0, 100) : null;

    if (isRateLimited(`login:${mobileNorm}`, 8, 15 * 60 * 1000)) {
      res.status(429).json({ error: "Bahut zyada attempts. Kuch der baad try karein." });
      return;
    }

    let [customer] = await db.select().from(customersTable).where(eq(customersTable.mobile, mobileNorm)).limit(1);
    let isNewCustomer = false;

    if (!customer) {
      let customerId = generateCustomerId();
      const existing = await db.select({ id: customersTable.id }).from(customersTable).where(eq(customersTable.customerId, customerId)).limit(1);
      if (existing.length > 0) customerId = generateCustomerId();
      [customer] = await db.insert(customersTable).values({
        customerId,
        mobile: mobileNorm,
        pin: "1234",
      }).returning();
      isNewCustomer = true;
    }

    if (customer.pin !== pin.trim()) {
      res.status(401).json({ error: "Galat PIN" });
      return;
    }

    // Flag (to whoever is logging in right now, not a push alert to the
    // original device — see schema comment) when this mobile number's
    // account was last active on a DIFFERENT device. Doesn't apply to a
    // brand-new account or when the app didn't send a device id at all.
    const newDeviceWarning =
      !isNewCustomer && !!deviceIdNorm && !!customer.lastDeviceId && customer.lastDeviceId !== deviceIdNorm;

    if (deviceIdNorm && customer.lastDeviceId !== deviceIdNorm) {
      await db.update(customersTable)
        .set({ lastDeviceId: deviceIdNorm, lastDeviceSeenAt: new Date() })
        .where(eq(customersTable.id, customer.id));
    }

    const token = jwt.sign(
      { type: "customer", customerDbId: customer.id, customerId: customer.customerId, mobile: customer.mobile } satisfies CustomerAuthPayload,
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      token,
      newDeviceWarning,
      customer: {
        customerId: customer.customerId,
        mobile: customer.mobile,
        name: customer.name,
        businessName: customer.businessName,
        showSupplierRealName: customer.showSupplierRealName,
        avatarUrl: customer.avatarUrl,
      },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Everything under /mini-app needs a customer token — EXCEPT /mini-app/lan-sync,
// which EXEs call with a business JWT and which does its own verification.
// Without this exemption every lan-sync push died here with 401 before ever
// reaching verifyBusinessJwt.
router.use("/mini-app", (req, res, next) => {
  if (req.path.startsWith("/lan-sync")) { next(); return; }
  requireCustomerAuth(req, res, next);
});

// GET /mini-app/customer/profile — own profile details (name, business name, prefs)
router.get("/mini-app/customer/profile", async (req, res) => {
  try {
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, req.customer!.customerDbId)).limit(1);
    if (!customer) { res.status(404).json({ error: "Customer nahi mila" }); return; }
    res.json({
      customerId: customer.customerId,
      mobile: customer.mobile,
      name: customer.name,
      businessName: customer.businessName,
      showSupplierRealName: customer.showSupplierRealName,
      avatarUrl: customer.avatarUrl,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /mini-app/customer/profile — update own name/business name/privacy pref
router.patch("/mini-app/customer/profile", async (req, res) => {
  try {
    const { name, businessName, showSupplierRealName } = req.body || {};
    const updates: Partial<typeof customersTable.$inferInsert> = {};
    if (typeof name === "string") updates.name = name.trim().slice(0, 100) || null;
    if (typeof businessName === "string") updates.businessName = businessName.trim().slice(0, 150) || null;
    if (typeof showSupplierRealName === "boolean") updates.showSupplierRealName = showSupplierRealName;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Kuch bhi update nahi kiya gaya" });
      return;
    }

    const [updated] = await db.update(customersTable).set(updates)
      .where(eq(customersTable.id, req.customer!.customerDbId)).returning();
    res.json({
      customerId: updated.customerId,
      mobile: updated.mobile,
      name: updated.name,
      businessName: updated.businessName,
      showSupplierRealName: updated.showSupplierRealName,
      avatarUrl: updated.avatarUrl,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /mini-app/customer/profile/avatar — upload/replace own profile picture
router.post("/mini-app/customer/profile/avatar", avatarUpload.single("image"), async (req, res) => {
  try {
    const file = (req as any).file as { buffer: Buffer } | undefined;
    if (!file) { res.status(400).json({ error: "image file required" }); return; }

    const customerDbId = req.customer!.customerDbId;
    const url = await new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: AVATAR_CLOUDINARY_FOLDER, resource_type: "image", public_id: `customer_${customerDbId}`, overwrite: true, invalidate: true },
        (err, result) => {
          if (err || !result) return reject(err || new Error("Cloudinary upload failed"));
          resolve(result.secure_url.replace("/upload/", "/upload/c_fill,w_300,h_300,q_auto/"));
        }
      );
      Readable.from(file.buffer).pipe(stream);
    });

    const [updated] = await db.update(customersTable).set({ avatarUrl: url })
      .where(eq(customersTable.id, customerDbId)).returning();
    res.json({ avatarUrl: updated.avatarUrl });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /mini-app/customer/pin — change own PIN (must know the current one).
// This is the SAME pin used for login — the app also caches it locally on
// the device for offline unlock, so any change here must be entered while
// online; the freshly-changed PIN then replaces the cached one client-side.
router.patch("/mini-app/customer/pin", async (req, res) => {
  try {
    const customerDbId = req.customer!.customerDbId;
    const { oldPin, newPin } = req.body || {};
    if (!oldPin?.trim() || !newPin?.trim()) {
      res.status(400).json({ error: "Purana aur naya PIN dono zaroori hain" });
      return;
    }
    if (newPin.trim().length < 4) {
      res.status(400).json({ error: "Naya PIN kam se kam 4 digit ka hona chahiye" });
      return;
    }
    if (isRateLimited(`pinchange:${customerDbId}`, 8, 15 * 60 * 1000)) {
      res.status(429).json({ error: "Bahut zyada attempts. Kuch der baad try karein." });
      return;
    }

    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerDbId)).limit(1);
    if (!customer || customer.pin !== oldPin.trim()) {
      res.status(401).json({ error: "Purana PIN galat hai" });
      return;
    }

    await db.update(customersTable).set({ pin: newPin.trim() }).where(eq(customersTable.id, customerDbId));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

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
        partyName: party.name,
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
      businessId: connectionsTable.businessId,
      partyId: connectionsTable.partyId,
      permissions: connectionsTable.permissions,
      status: connectionsTable.status,
      customerPaused: connectionsTable.customerPaused,
      customLabel: connectionsTable.customLabel,
      businessName: businessesTable.name,
      businessCode: businessesTable.businessCode,
      businessLogo: businessesTable.logo,
      // Supplier's own name for this customer (their Party master entry) —
      // tells a 2-business customer WHICH of their accounts this card is
      partyName: partiesTable.name,
      createdAt: connectionsTable.createdAt,
    }).from(connectionsTable)
      .innerJoin(businessesTable, eq(connectionsTable.businessId, businessesTable.id))
      .leftJoin(partiesTable, eq(connectionsTable.partyId, partiesTable.id))
      .where(eq(connectionsTable.customerId, customerDbId))
      .orderBy(desc(connectionsTable.createdAt));

    // Per-card document counts + latest doc date, so the app can show
    // "12 invoices · 5 receipts", flag empty cards, and badge new activity.
    // 4 grouped queries total, regardless of how many connections.
    const bizIds = [...new Set(rows.map(r => r.businessId))] as number[];
    const partyIds = [...new Set(rows.map(r => r.partyId))] as number[];
    const statMaps = { inv: new Map<string, { n: number; last: string }>(), pay: new Map<string, { n: number; last: string }>() };
    if (rows.length > 0) {
      const key = (b: number, p: number | null) => `${b}|${p}`;
      const addStats = (map: Map<string, { n: number; last: string }>, list: { businessId: number; partyId: number | null; n: number; last: string | null }[]) => {
        for (const s of list) {
          const k = key(s.businessId, s.partyId);
          const e = map.get(k) || { n: 0, last: "" };
          e.n += Number(s.n);
          if (s.last && s.last > e.last) e.last = s.last;
          map.set(k, e);
        }
      };
      const [cloudInv, lanInv, cloudPay, lanPay] = await Promise.all([
        db.select({ businessId: vouchersTable.businessId, partyId: vouchersTable.partyId, n: sql<number>`count(*)`, last: sql<string | null>`max(${vouchersTable.date})` })
          .from(vouchersTable)
          .where(and(inArray(vouchersTable.businessId, bizIds), inArray(vouchersTable.partyId, partyIds), eq(vouchersTable.voucherType, "sales_invoice"), isNull(vouchersTable.deletedAt)))
          .groupBy(vouchersTable.businessId, vouchersTable.partyId),
        db.select({ businessId: lanSyncVouchersTable.businessId, partyId: lanSyncVouchersTable.partyId, n: sql<number>`count(*)`, last: sql<string | null>`max(${lanSyncVouchersTable.date})` })
          .from(lanSyncVouchersTable)
          .where(and(inArray(lanSyncVouchersTable.businessId, bizIds), inArray(lanSyncVouchersTable.partyId, partyIds), eq(lanSyncVouchersTable.voucherType, "sales_invoice"), sql`${lanSyncVouchersTable.status} IS DISTINCT FROM 'deleted'`))
          .groupBy(lanSyncVouchersTable.businessId, lanSyncVouchersTable.partyId),
        db.select({ businessId: paymentsTable.businessId, partyId: paymentsTable.partyId, n: sql<number>`count(*)`, last: sql<string | null>`max(${paymentsTable.date})` })
          .from(paymentsTable)
          .where(and(inArray(paymentsTable.businessId, bizIds), inArray(paymentsTable.partyId, partyIds), eq(paymentsTable.type, "receipt"), isNull(paymentsTable.deletedAt)))
          .groupBy(paymentsTable.businessId, paymentsTable.partyId),
        db.select({ businessId: lanSyncPaymentsTable.businessId, partyId: lanSyncPaymentsTable.partyId, n: sql<number>`count(*)`, last: sql<string | null>`max(${lanSyncPaymentsTable.date})` })
          .from(lanSyncPaymentsTable)
          .where(and(inArray(lanSyncPaymentsTable.businessId, bizIds), inArray(lanSyncPaymentsTable.partyId, partyIds), eq(lanSyncPaymentsTable.paymentType, "receipt"), sql`${lanSyncPaymentsTable.status} IS DISTINCT FROM 'deleted'`))
          .groupBy(lanSyncPaymentsTable.businessId, lanSyncPaymentsTable.partyId),
      ]);
      addStats(statMaps.inv, cloudInv as any);
      addStats(statMaps.inv, lanInv as any);
      addStats(statMaps.pay, cloudPay as any);
      addStats(statMaps.pay, lanPay as any);
    }

    res.json(rows.map(r => {
      const k = `${r.businessId}|${r.partyId}`;
      const inv = statMaps.inv.get(k);
      const pay = statMaps.pay.get(k);
      const lastDocDate = [inv?.last, pay?.last].filter(Boolean).sort().pop() || null;
      return { ...r, invoiceCount: inv?.n || 0, paymentCount: pay?.n || 0, lastDocDate };
    }));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /mini-app/connections/:id — customer-side pause/resume, or set a
// private label for this supplier (shown instead of their real name when
// the customer's showSupplierRealName preference is off)
router.patch("/mini-app/connections/:id", async (req, res) => {
  try {
    const customerDbId = req.customer!.customerDbId;
    const { paused, customLabel } = req.body || {};
    const updates: { customerPaused?: boolean; customLabel?: string | null } = {};
    if (typeof paused === "boolean") updates.customerPaused = paused;
    if (typeof customLabel === "string") updates.customLabel = customLabel.trim().slice(0, 60) || null;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "paused ya customLabel mein se kam se kam ek zaroori hai" });
      return;
    }
    const [updated] = await db.update(connectionsTable)
      .set(updates)
      .where(and(
        eq(connectionsTable.id, Number(req.params.id)),
        eq(connectionsTable.customerId, customerDbId)
      )).returning();
    if (!updated) { res.status(404).json({ error: "Connection nahi mili" }); return; }
    res.json({ success: true, customerPaused: updated.customerPaused, customLabel: updated.customLabel });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /mini-app/connections/:id — customer removes the supplier from their
// app (chat bhi delete). Works even if the supplier blocked the connection —
// removing is always the customer's right.
router.delete("/mini-app/connections/:id", async (req, res) => {
  try {
    const customerDbId = req.customer!.customerDbId;
    const [connection] = await db.select().from(connectionsTable).where(and(
      eq(connectionsTable.id, Number(req.params.id)),
      eq(connectionsTable.customerId, customerDbId)
    )).limit(1);
    if (!connection) { res.status(404).json({ error: "Connection nahi mili" }); return; }

    await db.delete(customerChatMessagesTable).where(eq(customerChatMessagesTable.connectionId, connection.id));
    await db.delete(connectionsTable).where(eq(connectionsTable.id, connection.id));
    res.json({ success: true });
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
      ...cloudPayRows.map(r => ({ ...r, amount: Number(r.amount), source: "cloud" as const })),
      ...lanPayRows.map(r => ({ ...r, amount: Number(r.amount), source: "lan" as const })),
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
      ...cloudRows.map(r => ({ ...r, grandTotal: Number(r.grandTotal), source: "cloud" as const })),
      ...lanRows.map(r => ({ ...r, grandTotal: Number(r.grandTotal), source: "lan" as const })),
    ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

    res.json(merged);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /mini-app/connections/:id/gallery — the supplier's ENTIRE common
// gallery (not just images shared with this customer) — being connected is
// the only gate (no separate per-feature toggle; see ConnectCustomers.tsx).
// Each row is flagged `shared` (+ tick trail) when a share row exists for
// this party, so the app can split "shared with you" from "more from this
// supplier". First fetch of an existing share stamps deliveredAt (double
// tick); rows with no share yet have nothing to stamp.
router.get("/mini-app/connections/:id/gallery", async (req, res) => {
  try {
    const connection = await getOwnedConnection(req.customer!.customerDbId, Number(req.params.id));
    if (!connection) { res.status(404).json({ error: "Connection nahi mili" }); return; }

    const rows = await db.select({
      imageId: galleryImagesTable.id,
      thumbnailUrl: galleryImagesTable.thumbnailUrl,
      uploadedAt: galleryImagesTable.uploadedAt,
      shareId: gallerySharesTable.id,
      sharedAt: gallerySharesTable.sharedAt,
      deliveredAt: gallerySharesTable.deliveredAt,
      viewedAt: gallerySharesTable.viewedAt,
    }).from(galleryImagesTable)
      .leftJoin(gallerySharesTable, and(
        eq(gallerySharesTable.imageId, galleryImagesTable.id),
        eq(gallerySharesTable.partyId, connection.partyId),
      ))
      .where(and(eq(galleryImagesTable.businessId, connection.businessId), isNull(galleryImagesTable.archivedAt)))
      .orderBy(desc(sql`coalesce(${gallerySharesTable.sharedAt}, ${galleryImagesTable.uploadedAt})`));

    const undeliveredShareIds = rows.filter(r => r.shareId && !r.deliveredAt).map(r => r.shareId!);
    if (undeliveredShareIds.length) {
      await db.update(gallerySharesTable).set({ deliveredAt: new Date() }).where(inArray(gallerySharesTable.id, undeliveredShareIds));
    }

    res.json(rows.map(r => ({
      imageId: r.imageId,
      thumbnailUrl: r.thumbnailUrl,
      shared: r.shareId != null,
      sharedAt: r.sharedAt,
      deliveredAt: r.deliveredAt,
      viewedAt: r.viewedAt,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /mini-app/connections/:id/gallery/:imageId/full — full-size image, only
// fetched on tap. Keyed by imageId (not shareId) since an image is now
// browsable even before it's been explicitly shared. Stamps viewedAt (blue
// tick) on the matching share row the first time, only if one exists.
router.get("/mini-app/connections/:id/gallery/:imageId/full", async (req, res) => {
  try {
    const connection = await getOwnedConnection(req.customer!.customerDbId, Number(req.params.id));
    if (!connection) { res.status(404).json({ error: "Connection nahi mili" }); return; }

    const imageId = Number(req.params.imageId);
    const [image] = await db.select({ url: galleryImagesTable.url }).from(galleryImagesTable)
      .where(and(eq(galleryImagesTable.id, imageId), eq(galleryImagesTable.businessId, connection.businessId), isNull(galleryImagesTable.archivedAt))).limit(1);
    if (!image) { res.status(404).json({ error: "Image nahi mili" }); return; }

    const [share] = await db.select({ id: gallerySharesTable.id, viewedAt: gallerySharesTable.viewedAt })
      .from(gallerySharesTable)
      .where(and(eq(gallerySharesTable.imageId, imageId), eq(gallerySharesTable.partyId, connection.partyId))).limit(1);
    if (share && !share.viewedAt) {
      await db.update(gallerySharesTable).set({ viewedAt: new Date() }).where(eq(gallerySharesTable.id, share.id));
    }

    res.json({ url: image.url });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /mini-app/connections/:id/invoices/:source/:invoiceId — full invoice
// with line items. `source` says which table the row came from (cloud ERP
// vouchers vs LAN-synced copies) because their ids are separate sequences.
router.get("/mini-app/connections/:id/invoices/:source/:invoiceId", async (req, res) => {
  try {
    const connection = await getOwnedConnection(req.customer!.customerDbId, Number(req.params.id));
    if (!connection) { res.status(404).json({ error: "Connection nahi mili" }); return; }

    const invoiceId = Number(req.params.invoiceId);
    const source = req.params.source;

    if (source === "cloud") {
      const [voucher] = await db.select().from(vouchersTable).where(and(
        eq(vouchersTable.id, invoiceId),
        eq(vouchersTable.businessId, connection.businessId),
        eq(vouchersTable.partyId, connection.partyId),
        eq(vouchersTable.voucherType, "sales_invoice"),
        isNull(vouchersTable.deletedAt),
      )).limit(1);
      if (!voucher) { res.status(404).json({ error: "Invoice nahi mili" }); return; }

      const itemRows = await db.select().from(voucherItemsTable)
        .where(eq(voucherItemsTable.voucherId, voucher.id));
      res.json({
        voucherNumber: voucher.voucherNumber,
        date: voucher.date,
        status: voucher.status,
        notes: voucher.notes,
        grandTotal: Number(voucher.grandTotal),
        items: itemRows.map((r) => ({
          name: r.itemName,
          qty: Number(r.quantity || 0),
          unit: r.unit || "",
          rate: Number(r.rate || 0),
          amount: Number(r.total || 0),
        })),
      });
      return;
    }

    if (source === "lan") {
      const [voucher] = await db.select().from(lanSyncVouchersTable).where(and(
        eq(lanSyncVouchersTable.id, invoiceId),
        eq(lanSyncVouchersTable.businessId, connection.businessId),
        eq(lanSyncVouchersTable.partyId, connection.partyId),
        sql`${lanSyncVouchersTable.status} IS DISTINCT FROM 'deleted'`,
      )).limit(1);
      if (!voucher) { res.status(404).json({ error: "Invoice nahi mili" }); return; }

      res.json({
        voucherNumber: voucher.voucherNumber,
        date: voucher.date,
        status: voucher.status,
        notes: voucher.notes,
        grandTotal: Number(voucher.grandTotal),
        // null = pushed by an older EXE before items rode along
        items: Array.isArray(voucher.items) ? voucher.items : null,
      });
      return;
    }

    res.status(400).json({ error: "Invalid source" });
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
  businessId?: number;
  businessCode?: string;
  role?: string;
}

// Desktop EXEs sign their JWTs with a baked-in secret (server-manager.js sets
// SESSION_SECRET) which differs from the cloud's SESSION_SECRET — so lan-sync
// pushes from every fielded EXE were 401ing. Accept both secrets here.
// TODO: replace with per-business sync tokens issued by the cloud.
const LAN_DESKTOP_SECRET = "BizCorDesktop2025!SecretKey#LAN";

function verifyBusinessJwt(authHeader: string | undefined): BusinessJwtPayload | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  for (const secret of [JWT_SECRET, LAN_DESKTOP_SECRET]) {
    try {
      return jwt.verify(token, secret) as BusinessJwtPayload;
    } catch { /* try next secret */ }
  }
  return null;
}

// The token forwarded here is just the LAN admin's own regular login JWT
// (signToken() in auth.ts) — it carries `businessId`, never `businessCode`
// (that field only exists on this interface for a future per-sync token that
// was never actually issued). That businessId is also useless on its own: a
// LAN install's local SQLite row id has no relationship to this same
// business's row id in the cloud Postgres database (two independent
// auto-increment sequences) — resolving by it can silently match the wrong
// business or nothing at all. lanSync.ts now looks up the LAN business's own
// businessCode locally and sends it explicitly in every push payload — use
// that (authoritative, shared between both sides), falling back to the JWT's
// businessCode/businessId only for older EXEs that predate this field.
async function resolveLanSyncBusiness(payload: BusinessJwtPayload | null, bodyBusinessCode?: string): Promise<{ id: number } | null> {
  if (!payload) return null;
  const code = bodyBusinessCode || payload.businessCode;
  if (code) {
    const [business] = await db.select({ id: businessesTable.id })
      .from(businessesTable).where(eq(businessesTable.businessCode, code.toUpperCase())).limit(1);
    return business || null;
  }
  if (payload.businessId) {
    const [business] = await db.select({ id: businessesTable.id })
      .from(businessesTable).where(eq(businessesTable.id, payload.businessId)).limit(1);
    return business || null;
  }
  return null;
}

// LAN business pushes a mirror of a mini-app-enabled party here so the cloud
// `parties` row (which /mini-app/connect and the voucher/payment lan-sync
// handlers below both look up by pin) actually exists. Without this, a
// customer of a pure-LAN/desktop supplier could never connect at all — the
// cloud partiesTable had no row for them regardless of code/PIN correctness.
router.post("/mini-app/lan-sync/party", async (req, res) => {
  try {
    const payload = verifyBusinessJwt(req.headers.authorization);
    const business = await resolveLanSyncBusiness(payload, req.body?.businessCode);
    if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!business) { res.status(404).json({ error: "Business not found" }); return; }

    const { externalId, name, type, pin, phone, miniAppEnabled } = req.body;
    if (!externalId || !pin) { res.status(400).json({ error: "externalId and pin required" }); return; }
    const partyType = (type === "supplier" || type === "both") ? type : "customer";

    await db.insert(partiesTable).values({
      businessId: business.id,
      externalId: Number(externalId),
      name: String(name || "Customer"),
      type: partyType,
      pin: String(pin),
      phone: phone ? String(phone) : null,
      miniAppEnabled: miniAppEnabled !== false,
    }).onConflictDoUpdate({
      target: [partiesTable.businessId, partiesTable.externalId],
      set: {
        name: String(name || "Customer"),
        pin: String(pin),
        phone: phone ? String(phone) : null,
        miniAppEnabled: miniAppEnabled !== false,
      },
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/mini-app/lan-sync/voucher", async (req, res) => {
  try {
    const payload = verifyBusinessJwt(req.headers.authorization);
    const business = await resolveLanSyncBusiness(payload, req.body?.businessCode);
    if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!business) { res.status(404).json({ error: "Business not found" }); return; }

    const { partyPin, partyName, externalId, voucherType, voucherNumber, date, grandTotal, status, notes, items } = req.body;
    const safeItems = Array.isArray(items) ? items.slice(0, 500) : null;

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
      items: safeItems,
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
        ...(safeItems ? { items: safeItems } : {}),
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
    const business = await resolveLanSyncBusiness(payload, req.body?.businessCode);
    if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
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
