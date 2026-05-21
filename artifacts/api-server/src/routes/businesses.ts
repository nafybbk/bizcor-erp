import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { businessesTable, usersTable, unitsTable, taxRatesTable, hsnCodesTable, partiesTable, itemsTable, vouchersTable, voucherItemsTable, paymentsTable, paymentAllocationsTable, plansTable, licenseVouchersTable } from "@workspace/db";
import { eq, sql, and, desc } from "drizzle-orm";
import { requireAuth, requireBusiness, signToken, AuthUser } from "../middlewares/auth";
const router = Router();

function generateBusinessCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

router.post("/register", async (req, res) => {
  try {
    const { businessName, gstin, pan, address, city, state, stateCode, pincode, phone, businessType, adminName, adminEmail, adminPassword, planId, referredBy } = req.body;
    if (!businessName || !adminName || !adminEmail || !adminPassword) {
      res.status(400).json({ error: "Bad Request", message: "Required fields missing" });
      return;
    }

    // Max 2 businesses per email
    const emailLower = adminEmail.toLowerCase().trim();
    const existingEmailUsers = await db.select({ id: usersTable.id }).from(usersTable)
      .where(sql`LOWER(${usersTable.email}) = ${emailLower}`);
    if (existingEmailUsers.length >= 2) {
      res.status(400).json({
        error: "limit_reached",
        message: "Yeh email pehle se 2 businesses mein registered hai. Ek email se maximum 2 businesses bana sakte hain.",
      });
      return;
    }

    // Max 2 businesses per phone (if provided)
    if (phone && phone.trim()) {
      const existingPhoneUsers = await db.select({ id: businessesTable.id }).from(businessesTable)
        .where(sql`${businessesTable.phone} = ${phone.trim()}`);
      if (existingPhoneUsers.length >= 2) {
        res.status(400).json({
          error: "limit_reached",
          message: "Yeh phone number pehle se 2 businesses mein registered hai. Ek number se maximum 2 businesses bana sakte hain.",
        });
        return;
      }
    }

    let businessCode = generateBusinessCode();
    const existingCode = await db.select({ id: businessesTable.id }).from(businessesTable).where(eq(businessesTable.businessCode, businessCode)).limit(1);
    if (existingCode.length > 0) businessCode = generateBusinessCode();

    // Generate unique referral code
    let referralCode = generateReferralCode();
    const existingRef = await db.select({ id: businessesTable.id }).from(businessesTable).where(eq(businessesTable.referralCode, referralCode)).limit(1);
    if (existingRef.length > 0) referralCode = generateReferralCode();

    const now = new Date();
    const trialExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    // PG needs actual Date objects (timestamp column); SQLite needs ISO strings (text column)
    const isSQLite = !!process.env.SQLITE_PATH;
    const planStartVal = (isSQLite ? now.toISOString() : now) as unknown as Date;
    const planExpiresVal = (isSQLite ? trialExpiresAt.toISOString() : trialExpiresAt) as unknown as Date;
    let [business] = await db.insert(businessesTable).values({
      name: businessName, businessCode, gstin, pan, address, city, state, stateCode, pincode, phone, businessType,
      planId: planId || null, status: "trial",
      isTrial: true, planStartDate: planStartVal, planExpiresAt: planExpiresVal,
      referralCode,
      referredBy: referredBy ? referredBy.toUpperCase().trim() : null,
    }).returning();

    // Fallback: some SQLite builds may not return from .returning() — fetch by code
    if (!business) {
      const found = await db.query.businessesTable.findFirst({ where: eq(businessesTable.businessCode, businessCode) });
      if (!found) throw new Error("Business create nahi hua. Dobara try karein.");
      business = found;
    }

    // ── REFERRAL REWARD LOGIC ──────────────────────────────────────────────
    // Every 5 referrals → assign "Referral Plan" (max 2 rewards total)
    if (referredBy && referredBy.trim()) {
      const referrer = await db.query.businessesTable.findFirst({
        where: eq(businessesTable.referralCode, referredBy.toUpperCase().trim()),
      });
      if (referrer) {
        const newCount = (referrer.referralCount || 0) + 1;
        const rewardCount = (referrer as any).referralRewardCount || 0;
        const updates: Record<string, unknown> = { referralCount: newCount };

        const milestone = Math.floor(newCount / 5); // 5 = first reward, 10 = second
        if (milestone > rewardCount && rewardCount < 2) {
          // Find "Referral Plan" by name
          const referralPlan = await db.query.plansTable.findFirst({
            where: eq(plansTable.name, "Referral Plan"),
          });
          if (referralPlan) {
            const validityMs = (referralPlan.validityDays || 180) * 24 * 60 * 60 * 1000;
            // planExpiresAt can be Date (PG) or ISO string (SQLite) — normalize to Date
            const referrerExpiry = referrer.planExpiresAt
              ? new Date(referrer.planExpiresAt as unknown as string)
              : null;
            const baseDate = referrerExpiry && referrerExpiry > now ? referrerExpiry : now;
            updates.planId = referralPlan.id;
            updates.planExpiresAt = new Date(baseDate.getTime() + validityMs);
            updates.isTrial = false;
            updates.status = "active";
            updates.bonusDaysAdded = (referrer.bonusDaysAdded || 0) + (referralPlan.validityDays || 180);
          }
          updates.referralRewardCount = rewardCount + 1;
          // Flag for congratulations banner (timestamp so frontend knows it's new)
          updates.referralRewardedAt = now;
        }
        // Drizzle ORM update — works on both SQLite + PostgreSQL
        const setData: Record<string, unknown> = { referralCount: newCount };
        if ((updates as any).referralRewardCount !== undefined) setData.referralRewardCount = (updates as any).referralRewardCount;
        if ((updates as any).planId !== undefined) setData.planId = (updates as any).planId;
        if ((updates as any).planExpiresAt !== undefined) setData.planExpiresAt = (updates as any).planExpiresAt;
        if ((updates as any).isTrial !== undefined) setData.isTrial = (updates as any).isTrial;
        if ((updates as any).status !== undefined) setData.status = (updates as any).status;
        if ((updates as any).bonusDaysAdded !== undefined) setData.bonusDaysAdded = (updates as any).bonusDaysAdded;
        if ((updates as any).referralRewardedAt !== undefined) setData.referralRewardedAt = (updates as any).referralRewardedAt;
        await db.update(businessesTable).set(setData).where(eq(businessesTable.id, referrer.id));
      }
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    let [user] = await db.insert(usersTable).values({
      businessId: business.id, name: adminName, email: emailLower, passwordHash, role: "business_admin", permissions: [], appSource: "bizcor",
    }).returning();

    // Fallback: some SQLite builds don't support RETURNING — fetch by email
    if (!user) {
      const found = await db.query.usersTable.findFirst({
        where: and(eq(usersTable.businessId, business.id), eq(usersTable.email, emailLower)),
      });
      if (!found) throw new Error("User create nahi hua. Dobara try karein.");
      user = found as any;
    }

    await db.insert(unitsTable).values([
      { businessId: business.id, name: "Piece", symbol: "PCS" },
      { businessId: business.id, name: "Kilogram", symbol: "KG" },
      { businessId: business.id, name: "Litre", symbol: "LTR" },
      { businessId: business.id, name: "Box", symbol: "BOX" },
      { businessId: business.id, name: "Meter", symbol: "MTR" },
      { businessId: business.id, name: "Number", symbol: "NOS" },
    ]);

    await db.insert(taxRatesTable).values([
      { businessId: business.id, name: "GST 0%", rate: "0" },
      { businessId: business.id, name: "GST 5%", rate: "5" },
      { businessId: business.id, name: "GST 12%", rate: "12" },
      { businessId: business.id, name: "GST 18%", rate: "18" },
      { businessId: business.id, name: "GST 28%", rate: "28" },
    ]);

    const token = signToken({ id: user.id, email: user.email, name: user.name, role: "business_admin", businessId: business.id });
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: "business_admin", businessId: business.id },
      business: { id: business.id, name: business.name, businessCode: business.businessCode, referralCode: business.referralCode },
    });
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error", detail: err?.message || String(err) });
  }
});

// Referral status — aapka code, count, reward info
// Returns the voucher code this business activated (for "forgot my code" UX)
router.get("/my-voucher", requireBusiness, async (req, res) => {
  try {
    const bizId = req.user!.businessId!;
    const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, bizId) });
    if (!business) { res.json({ code: null, redeemedAt: null }); return; }

    // Use stored activeVoucherId to find the exact active voucher
    const activeId = (business as any).activeVoucherId;
    if (activeId) {
      const [v] = await db.select({ code: licenseVouchersTable.code, redeemedAt: licenseVouchersTable.redeemedAt })
        .from(licenseVouchersTable).where(eq(licenseVouchersTable.id, activeId)).limit(1);
      if (v) { res.json({ code: v.code, redeemedAt: v.redeemedAt }); return; }
    }

    // Fallback: most recently redeemed voucher (DESC = newest first)
    const [latest] = await db.select({ code: licenseVouchersTable.code, redeemedAt: licenseVouchersTable.redeemedAt })
      .from(licenseVouchersTable)
      .where(eq(licenseVouchersTable.redeemedByBusinessId, bizId))
      .orderBy(desc(licenseVouchersTable.redeemedAt))
      .limit(1);
    res.json({ code: latest?.code || null, redeemedAt: latest?.redeemedAt || null });
  } catch { res.json({ code: null, redeemedAt: null }); }
});

// ─── My Subscriptions ────────────────────────────────────────────────────────
router.get("/my-subscriptions", requireBusiness, async (req, res) => {
  try {
    const bizId = req.user!.businessId!;

    // Auto-delete vouchers expired > 30 days for this business
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const allVouchers = await db.select({
      id: licenseVouchersTable.id,
      code: licenseVouchersTable.code,
      planId: licenseVouchersTable.planId,
      validityDays: licenseVouchersTable.validityDays,
      redeemedAt: licenseVouchersTable.redeemedAt,
      status: licenseVouchersTable.status,
    }).from(licenseVouchersTable)
      .where(eq(licenseVouchersTable.redeemedByBusinessId, bizId));

    // Auto-delete expired > 30 days (soft: just filter from response; actually delete)
    const toDelete: number[] = [];
    const visible: any[] = [];
    const now = Date.now();
    for (const v of allVouchers) {
      const redeemedAt = v.redeemedAt ? new Date(v.redeemedAt).getTime() : null;
      const expiresAt = redeemedAt ? redeemedAt + (v.validityDays * 86400000) : null;
      const expiredMs = expiresAt ? now - expiresAt : null;
      if (expiredMs !== null && expiredMs > 30 * 86400000) {
        toDelete.push(v.id); // expired > 30 days — auto-delete
      } else {
        visible.push({ ...v, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null });
      }
    }
    // Auto-delete stale entries
    if (toDelete.length > 0) {
      for (const id of toDelete) {
        await db.delete(licenseVouchersTable).where(eq(licenseVouchersTable.id, id)).catch(() => {});
      }
    }

    // Enrich with plan details
    const plans = await db.select().from(plansTable);
    const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, bizId) });

    // Use stored activeVoucherId — exact, reliable, no expiry-matching guesswork
    const storedActiveId = (business as any)?.activeVoucherId ?? null;
    const bizExpiresMs = business?.planExpiresAt ? new Date(business.planExpiresAt).getTime() : null;
    const planStillValid = bizExpiresMs ? bizExpiresMs > now : false;

    const subscriptions = visible.map(v => {
      const plan = plans.find(p => p.id === v.planId);
      const isActive = storedActiveId !== null
        ? v.id === storedActiveId && planStillValid
        : false;
      return {
        id: v.id,
        code: v.code,
        planId: v.planId,
        planName: plan?.name || "Unknown Plan",
        maxUsers: plan?.maxUsers || null,
        validityDays: v.validityDays,
        redeemedAt: v.redeemedAt,
        expiresAt: v.expiresAt,
        isExpired: v.expiresAt ? new Date(v.expiresAt).getTime() < now : false,
        isActive: !!isActive,
      };
    }).sort((a, b) => new Date(b.redeemedAt ?? 0).getTime() - new Date(a.redeemedAt ?? 0).getTime());

    res.json({ data: subscriptions });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// Activate a specific subscribed plan (switch plan)
router.post("/activate-plan/:voucherId", requireBusiness, async (req, res) => {
  try {
    const bizId = req.user!.businessId!;
    const voucherId = Number(req.params.voucherId);

    const [voucher] = await db.select().from(licenseVouchersTable)
      .where(and(eq(licenseVouchersTable.id, voucherId), eq(licenseVouchersTable.redeemedByBusinessId, bizId)))
      .limit(1);
    if (!voucher) { res.status(404).json({ error: "Voucher nahi mila" }); return; }

    const redeemedAt = voucher.redeemedAt ? new Date(voucher.redeemedAt).getTime() : Date.now();
    const expiresAt = new Date(redeemedAt + voucher.validityDays * 86400000);
    if (expiresAt.getTime() < Date.now()) {
      res.status(400).json({ error: "Ye voucher expire ho chuka hai — activate nahi ho sakta" }); return;
    }

    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, voucher.planId)).limit(1);

    await db.update(businessesTable).set({
      planId: voucher.planId,
      activeVoucherId: voucher.id,
      planExpiresAt: expiresAt,
      isTrial: false,
    }).where(eq(businessesTable.id, bizId));

    // Return fresh token with updated plan info — correct planExpiresAt + isTrial
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.user!.id) });
    const token = signToken(
      { id: user!.id, email: user!.email, name: user!.name, role: user!.role as AuthUser["role"], businessId: bizId },
      expiresAt,
      false
    );

    res.json({
      success: true,
      message: `${plan?.name || "Plan"} activate ho gaya! Validity: ${voucher.validityDays} din`,
      token,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/referral-status", requireBusiness, async (req, res) => {
  try {
    // Drizzle ORM query — works on both SQLite + PostgreSQL
    const b = await db.query.businessesTable.findFirst({
      where: eq(businessesTable.id, req.user!.businessId!),
    });
    if (!b) { res.status(404).json({ error: "Not Found" }); return; }

    const rewardCount = Number((b as any).referralRewardCount || 0);
    const referralCount = Number((b as any).referralCount || 0);
    const nextMilestone = (rewardCount + 1) * 5;
    const progressToNext = rewardCount < 2 ? referralCount % 5 : 5;
    const maxRewardsReached = rewardCount >= 2;

    const rewardedAt = (b as any).referralRewardedAt ? new Date((b as any).referralRewardedAt) : null;
    const showCongrats = rewardedAt && (Date.now() - rewardedAt.getTime() < 24 * 60 * 60 * 1000);

    res.json({
      referralCode: (b as any).referralCode,
      referralCount,
      rewardCount,
      progressToNext,
      nextMilestone,
      maxRewardsReached,
      showCongrats: !!showCongrats,
      rewardedAt: rewardedAt?.toISOString() || null,
      bonusDaysAdded: Number((b as any).bonusDaysAdded || 0),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/current", requireBusiness, async (req, res) => {
  try {
    const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, req.user!.businessId!) });
    if (!business) { res.status(404).json({ error: "Not Found" }); return; }
    res.json(business);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch("/current", requireBusiness, async (req, res) => {
  try {
    const allowed = ["name", "gstin", "pan", "address", "city", "state", "stateCode", "pincode", "phone", "email", "logo", "financialYearStart", "invoicePrefix", "creditNotePrefix", "billPrefix", "debitNotePrefix", "serialNumberMode", "numberSeries", "numberDigits", "numberSeparator", "businessType", "bankName", "bankAccount", "bankIfsc", "bankBranch", "signatoryName", "invoiceFooter", "siStartNumber", "cnStartNumber", "pbStartNumber", "dnStartNumber", "printShowPrefix", "printShowSeries", "printShowZeros"];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) if (req.body[key] !== undefined) updateData[key] = req.body[key];
    const [updated] = await db.update(businessesTable).set(updateData).where(eq(businessesTable.id, req.user!.businessId!)).returning();
    res.json(updated);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/backup", requireBusiness, async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const [business] = await db.select().from(businessesTable).where(eq(businessesTable.id, businessId)).limit(1);
    const users = await db.select().from(usersTable).where(eq(usersTable.businessId, businessId));
    const parties = await db.select().from(partiesTable).where(eq(partiesTable.businessId, businessId));
    const items = await db.select().from(itemsTable).where(eq(itemsTable.businessId, businessId));
    const vouchers = await db.select().from(vouchersTable).where(eq(vouchersTable.businessId, businessId));
    const voucherIds = vouchers.map(v => v.id);
    let voucherItems: any[] = [];
    if (voucherIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      voucherItems = await db.select().from(voucherItemsTable).where(inArray(voucherItemsTable.voucherId, voucherIds));
    }
    const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.businessId, businessId));
    const paymentIds = payments.map(p => p.id);
    let paymentAllocations: any[] = [];
    if (paymentIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      paymentAllocations = await db.select().from(paymentAllocationsTable).where(inArray(paymentAllocationsTable.paymentId, paymentIds));
    }

    const units = await db.select().from(unitsTable).where(eq(unitsTable.businessId, businessId));
    const taxRates = await db.select().from(taxRatesTable).where(eq(taxRatesTable.businessId, businessId));
    const hsnCodes = await db.select().from(hsnCodesTable).where(eq(hsnCodesTable.businessId, businessId));

    const filename = `bizcor-backup-${business?.businessCode || businessId}-${new Date().toISOString().split("T")[0]}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.json({
      exportedAt: new Date().toISOString(),
      version: "2.1",
      business,
      users: users.map(u => ({ ...u, passwordHash: undefined })),
      units,
      taxRates,
      hsnCodes,
      parties,
      items,
      vouchers,
      voucherItems,
      payments,
      paymentAllocations,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// Restore from JSON backup — imports parties, items, vouchers, payments (additive, skips existing)
router.post("/restore", requireBusiness, async (req, res) => {
  try {
    const businessId = req.user!.businessId!;
    const { units = [], taxRates = [], hsnCodes = [], parties = [], items = [], vouchers = [], voucherItems = [], payments = [], paymentAllocations = [] } = req.body;
    const { inArray } = await import("drizzle-orm");

    let imported = { units: 0, taxRates: 0, hsnCodes: 0, parties: 0, items: 0, vouchers: 0, payments: 0 };

    // Restore units — skip if same name already exists
    const existingUnits = await db.select().from(unitsTable).where(eq(unitsTable.businessId, businessId));
    const existingUnitNames = new Set(existingUnits.map((u: any) => u.name?.toLowerCase()));
    const unitIdMap: Record<number, number> = {};
    for (const unit of units) {
      const existing = existingUnits.find((e: any) => e.name?.toLowerCase() === unit.name?.toLowerCase());
      if (existing) { unitIdMap[unit.id] = existing.id; continue; }
      const { id: oldId, businessId: _bid, createdAt, ...rest } = unit;
      const [inserted] = await db.insert(unitsTable).values({ ...rest, businessId }).returning({ id: unitsTable.id });
      if (inserted) { unitIdMap[oldId] = inserted.id; imported.units++; }
    }

    // Restore tax rates — skip if same name already exists
    const existingTaxRates = await db.select().from(taxRatesTable).where(eq(taxRatesTable.businessId, businessId));
    const existingTaxNames = new Set(existingTaxRates.map((t: any) => t.name?.toLowerCase()));
    const taxRateIdMap: Record<number, number> = {};
    for (const tr of taxRates) {
      const existing = existingTaxRates.find((e: any) => e.name?.toLowerCase() === tr.name?.toLowerCase());
      if (existing) { taxRateIdMap[tr.id] = existing.id; continue; }
      const { id: oldId, businessId: _bid, createdAt, ...rest } = tr;
      const [inserted] = await db.insert(taxRatesTable).values({ ...rest, businessId }).returning({ id: taxRatesTable.id });
      if (inserted) { taxRateIdMap[oldId] = inserted.id; imported.taxRates++; }
    }

    // Restore HSN codes — skip if same code already exists
    const existingHsn = await db.select().from(hsnCodesTable).where(eq(hsnCodesTable.businessId, businessId));
    const existingHsnCodes = new Set(existingHsn.map((h: any) => h.code?.toLowerCase()));
    for (const hsn of hsnCodes) {
      if (existingHsnCodes.has(hsn.code?.toLowerCase())) continue;
      const { id: _id, businessId: _bid, createdAt, ...rest } = hsn;
      await db.insert(hsnCodesTable).values({ ...rest, businessId }).catch(() => {});
      imported.hsnCodes++;
    }

    // Restore parties — skip if same businessId+name already exists
    const existingParties = await db.select().from(partiesTable).where(eq(partiesTable.businessId, businessId));
    const existingPartyNames = new Set(existingParties.map((p: any) => p.name?.toLowerCase()));
    const newParties = parties.filter((p: any) => !existingPartyNames.has(p.name?.toLowerCase()));
    const partyIdMap: Record<number, number> = {};
    for (const party of newParties) {
      const { id: oldId, businessId: _bid, createdAt, ...rest } = party;
      const [inserted] = await db.insert(partiesTable).values({ ...rest, businessId }).returning({ id: partiesTable.id });
      if (inserted) partyIdMap[oldId] = inserted.id;
      imported.parties++;
    }
    // Keep old party id → existing id mapping too
    for (const p of parties) {
      const existing = existingParties.find((e: any) => e.name?.toLowerCase() === p.name?.toLowerCase());
      if (existing && !partyIdMap[p.id]) partyIdMap[p.id] = existing.id;
    }

    // Restore items — skip if same businessId+name already exists
    const existingItems = await db.select().from(itemsTable).where(eq(itemsTable.businessId, businessId));
    const existingItemNames = new Set(existingItems.map((i: any) => i.name?.toLowerCase()));
    const newItems = items.filter((i: any) => !existingItemNames.has(i.name?.toLowerCase()));
    const itemIdMap: Record<number, number> = {};
    for (const item of newItems) {
      const { id: oldId, businessId: _bid, createdAt, ...rest } = item;
      const [inserted] = await db.insert(itemsTable).values({ ...rest, businessId }).returning({ id: itemsTable.id });
      if (inserted) itemIdMap[oldId] = inserted.id;
      imported.items++;
    }
    for (const i of items) {
      const existing = existingItems.find((e: any) => e.name?.toLowerCase() === i.name?.toLowerCase());
      if (existing && !itemIdMap[i.id]) itemIdMap[i.id] = existing.id;
    }

    // Restore vouchers — skip if same voucherNumber already exists for this business
    const existingVouchers = await db.select().from(vouchersTable).where(eq(vouchersTable.businessId, businessId));
    const existingVoucherNums = new Set(existingVouchers.map((v: any) => v.voucherNumber));
    const voucherIdMap: Record<number, number> = {};
    for (const voucher of vouchers) {
      if (existingVoucherNums.has(voucher.voucherNumber)) {
        const existing = existingVouchers.find((e: any) => e.voucherNumber === voucher.voucherNumber);
        if (existing) voucherIdMap[voucher.id] = existing.id;
        continue;
      }
      const { id: oldId, businessId: _bid, partyId, createdAt, ...rest } = voucher;
      const newPartyId = partyId ? (partyIdMap[partyId] || partyId) : null;
      const [inserted] = await db.insert(vouchersTable).values({ ...rest, businessId, partyId: newPartyId }).returning({ id: vouchersTable.id });
      if (inserted) {
        voucherIdMap[oldId] = inserted.id;
        imported.vouchers++;
        // Insert voucher items for this voucher
        const relatedItems = voucherItems.filter((vi: any) => vi.voucherId === oldId);
        for (const vi of relatedItems) {
          const { id: _viId, voucherId: _vid, itemId, ...viRest } = vi;
          const newItemId = itemId ? (itemIdMap[itemId] || itemId) : null;
          await db.insert(voucherItemsTable).values({ ...viRest, voucherId: inserted.id, itemId: newItemId }).catch(() => {});
        }
      }
    }

    // Restore payments — skip duplicates
    const existingPayments = await db.select().from(paymentsTable).where(eq(paymentsTable.businessId, businessId));
    const existingPaymentNums = new Set(existingPayments.map((p: any) => p.receiptNumber || p.paymentNumber));
    const paymentIdMap: Record<number, number> = {};
    for (const payment of payments) {
      const num = payment.receiptNumber || payment.paymentNumber;
      if (num && existingPaymentNums.has(num)) {
        const existing = existingPayments.find((e: any) => (e.receiptNumber || e.paymentNumber) === num);
        if (existing) paymentIdMap[payment.id] = existing.id;
        continue;
      }
      const { id: oldId, businessId: _bid, partyId, createdAt, ...rest } = payment;
      const newPartyId = partyId ? (partyIdMap[partyId] || partyId) : null;
      const [inserted] = await db.insert(paymentsTable).values({ ...rest, businessId, partyId: newPartyId }).returning({ id: paymentsTable.id });
      if (inserted) {
        paymentIdMap[oldId] = inserted.id;
        imported.payments++;
        // Insert payment allocations
        const relatedAllocs = paymentAllocations.filter((a: any) => a.paymentId === oldId);
        for (const alloc of relatedAllocs) {
          const { id: _aid, paymentId: _pid, voucherId, ...allocRest } = alloc;
          const newVoucherId = voucherId ? (voucherIdMap[voucherId] || voucherId) : null;
          await db.insert(paymentAllocationsTable).values({ ...allocRest, paymentId: inserted.id, voucherId: newVoucherId }).catch(() => {});
        }
      }
    }

    res.json({
      success: true,
      message: `Restore complete! ${imported.units} units, ${imported.taxRates} tax rates, ${imported.hsnCodes} HSN codes, ${imported.parties} parties, ${imported.items} items, ${imported.vouchers} vouchers, ${imported.payments} payments imported.`,
      imported,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

export default router;
