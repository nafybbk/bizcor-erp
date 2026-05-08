import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { businessesTable, usersTable, unitsTable, taxRatesTable, partiesTable, itemsTable, vouchersTable, paymentsTable, plansTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireBusiness, signToken } from "../middlewares/auth";
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
    const existing = await db.query.businessesTable.findFirst({ where: eq(businessesTable.businessCode, businessCode) });
    if (existing) businessCode = generateBusinessCode();

    // Generate unique referral code
    let referralCode = generateReferralCode();
    const refExisting = await db.query.businessesTable.findFirst({ where: eq(businessesTable.referralCode, referralCode) });
    if (refExisting) referralCode = generateReferralCode();

    const now = new Date();
    const trialExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    // Use ISO strings — works for both PostgreSQL (parsed as timestamp) and SQLite (stored as text)
    const nowStr = now.toISOString();
    const trialExpiresStr = trialExpiresAt.toISOString();
    const [business] = await db.insert(businessesTable).values({
      name: businessName, businessCode, gstin, pan, address, city, state, stateCode, pincode, phone, businessType,
      planId: planId || null, status: "trial",
      isTrial: true, planStartDate: nowStr as unknown as Date, planExpiresAt: trialExpiresStr as unknown as Date,
      referralCode,
      referredBy: referredBy ? referredBy.toUpperCase().trim() : null,
    }).returning();

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
            const baseDate = referrer.planExpiresAt && referrer.planExpiresAt > now ? referrer.planExpiresAt : now;
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
        await db.execute(sql`
          UPDATE businesses SET
            referral_count = ${newCount},
            referral_reward_count = COALESCE(${(updates as any).referralRewardCount ?? null}, referral_reward_count),
            plan_id = COALESCE(${(updates as any).planId ?? null}, plan_id),
            plan_expires_at = COALESCE(${(updates as any).planExpiresAt ?? null}, plan_expires_at),
            is_trial = COALESCE(${(updates as any).isTrial ?? null}, is_trial),
            status = COALESCE(${(updates as any).status ?? null}, status),
            bonus_days_added = COALESCE(${(updates as any).bonusDaysAdded ?? null}, bonus_days_added),
            referral_rewarded_at = COALESCE(${(updates as any).referralRewardedAt ?? null}, referral_rewarded_at)
          WHERE id = ${referrer.id}
        `);
      }
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const [user] = await db.insert(usersTable).values({
      businessId: business.id, name: adminName, email: emailLower, passwordHash, role: "business_admin", permissions: [],
    }).returning();

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
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Referral status — aapka code, count, reward info
router.get("/referral-status", requireBusiness, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT referral_code, referral_count, referral_reward_count, referral_rewarded_at, bonus_days_added,
             plan_id, plan_expires_at, is_trial
      FROM businesses WHERE id = ${req.user!.businessId!}
    `);
    const rows = (result as any).rows ?? result;
    const b = rows[0];
    if (!b) { res.status(404).json({ error: "Not Found" }); return; }

    const rewardCount = Number(b.referral_reward_count || 0);
    const referralCount = Number(b.referral_count || 0);
    const nextMilestone = (rewardCount + 1) * 5;
    const progressToNext = rewardCount < 2 ? referralCount % 5 : 5;
    const maxRewardsReached = rewardCount >= 2;

    // Congratulations flag — reward happened within last 24 hrs
    const rewardedAt = b.referral_rewarded_at ? new Date(b.referral_rewarded_at) : null;
    const showCongrats = rewardedAt && (Date.now() - rewardedAt.getTime() < 24 * 60 * 60 * 1000);

    res.json({
      referralCode: b.referral_code,
      referralCount,
      rewardCount,
      progressToNext,
      nextMilestone,
      maxRewardsReached,
      showCongrats: !!showCongrats,
      rewardedAt: rewardedAt?.toISOString() || null,
      bonusDaysAdded: Number(b.bonus_days_added || 0),
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
    const business = await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) });
    const users = await db.select().from(usersTable).where(eq(usersTable.businessId, businessId));
    const parties = await db.select().from(partiesTable).where(eq(partiesTable.businessId, businessId));
    const items = await db.select().from(itemsTable).where(eq(itemsTable.businessId, businessId));
    const vouchers = await db.select().from(vouchersTable).where(eq(vouchersTable.businessId, businessId));
    const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.businessId, businessId));

    const filename = `backup-${business?.businessCode || businessId}-${Date.now()}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.json({
      exportedAt: new Date().toISOString(),
      version: "1.0",
      business,
      users: users.map(u => ({ ...u, passwordHash: undefined })),
      parties, items, vouchers, payments,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

export default router;
