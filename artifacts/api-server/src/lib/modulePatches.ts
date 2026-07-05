import { db } from "@workspace/db";
import { modulePatchesTable, businessesTable, plansTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export type PatchModule = "chat" | "gallery" | "customer_network";

const MODULE_FEATURE_LABEL: Record<PatchModule, string> = {
  chat: "Chat",
  gallery: "Gallery",
  customer_network: "Customer Network",
};

/**
 * Activates any "pending" module patches for a business. Called from the
 * regular business login flow — this is the moment a business's app (cloud
 * or LAN-synced) actually talks to the server, so validity should count from
 * here, not from whenever the tech admin happened to create the patch.
 */
export async function activatePendingPatches(businessId: number): Promise<void> {
  const pending = await db.select().from(modulePatchesTable).where(and(
    eq(modulePatchesTable.businessId, businessId),
    eq(modulePatchesTable.status, "pending")
  ));
  for (const patch of pending) {
    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt.getTime() + patch.validityDays * 24 * 60 * 60 * 1000);
    await db.update(modulePatchesTable)
      .set({ status: "active", activatedAt, expiresAt })
      .where(eq(modulePatchesTable.id, patch.id));
  }
}

/**
 * True if the business's plan already includes this module, OR it has an
 * active, non-expired module patch granting it. Expired active patches are
 * treated as not-included (lazily marked "expired" on read).
 */
export async function hasActiveModule(businessId: number, module: PatchModule): Promise<boolean> {
  const [business] = await db.select().from(businessesTable).where(eq(businessesTable.id, businessId)).limit(1);
  if (!business) return false;

  if (business.planId) {
    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, business.planId)).limit(1);
    if (plan?.features?.some((f) => f.toLowerCase().includes(MODULE_FEATURE_LABEL[module].toLowerCase()))) {
      return true;
    }
  }

  const [patch] = await db.select().from(modulePatchesTable).where(and(
    eq(modulePatchesTable.businessId, businessId),
    eq(modulePatchesTable.module, module),
    eq(modulePatchesTable.status, "active")
  )).limit(1);

  if (!patch) return false;
  if (patch.expiresAt && new Date(patch.expiresAt) < new Date()) {
    await db.update(modulePatchesTable).set({ status: "expired" }).where(eq(modulePatchesTable.id, patch.id));
    return false;
  }
  return true;
}
