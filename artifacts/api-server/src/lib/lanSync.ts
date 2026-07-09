// LAN → cloud sync pushes for the BizCor Connect mini app.
// Only active on LAN/desktop installs (SQLITE_PATH set). Fire-and-forget by
// design — sync must never slow down or break a voucher save, and must stay
// invisible to the supplier (no toasts, no status UI). The cloud endpoint
// upserts on (businessId, externalId, type), so re-pushing an edited or
// deleted document replaces the customer's copy instead of duplicating it.
import { db } from "@workspace/db";
import { partiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const CLOUD_URL = () => process.env.CLOUD_API_URL || "https://erp.naewtgroup.com";

function bearerToken(req: { headers: Record<string, unknown> }): string {
  return String(req.headers.authorization || "").replace("Bearer ", "");
}

async function miniAppParty(partyId: number | null | undefined) {
  if (!partyId) return null;
  const [party] = await db.select({ miniAppEnabled: partiesTable.miniAppEnabled, pin: partiesTable.pin, name: partiesTable.name })
    .from(partiesTable).where(eq(partiesTable.id, Number(partyId))).limit(1);
  if (!(party as any)?.miniAppEnabled || !(party as any)?.pin) return null;
  return party as { miniAppEnabled: boolean; pin: string; name: string | null };
}

export function pushLanSyncVoucher(req: any, v: {
  partyId: number | null | undefined;
  externalId: number;
  voucherType: string;
  voucherNumber: string;
  date: string;
  grandTotal: string | number;
  status: string;
  notes?: string | null;
}): void {
  if (!process.env.SQLITE_PATH) return;
  void (async () => {
    try {
      const party = await miniAppParty(v.partyId);
      if (!party) return;
      await fetch(`${CLOUD_URL()}/api/mini-app/lan-sync/voucher`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${bearerToken(req)}` },
        body: JSON.stringify({
          partyPin: party.pin,
          partyName: party.name || "",
          externalId: v.externalId,
          voucherType: v.voucherType,
          voucherNumber: v.voucherNumber,
          date: String(v.date),
          grandTotal: String(v.grandTotal || 0),
          status: v.status,
          notes: v.notes || "",
        }),
      });
    } catch { /* fire-and-forget — errors silently ignored */ }
  })();
}

export function pushLanSyncPayment(req: any, p: {
  partyId: number | null | undefined;
  externalId: number;
  paymentType: string;
  paymentNumber: string;
  date: string;
  amount: string | number;
  paymentMode?: string | null;
  status: string;
  notes?: string | null;
}): void {
  if (!process.env.SQLITE_PATH) return;
  void (async () => {
    try {
      const party = await miniAppParty(p.partyId);
      if (!party) return;
      await fetch(`${CLOUD_URL()}/api/mini-app/lan-sync/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${bearerToken(req)}` },
        body: JSON.stringify({
          partyPin: party.pin,
          partyName: party.name || "",
          externalId: p.externalId,
          paymentType: p.paymentType,
          paymentNumber: p.paymentNumber,
          date: String(p.date),
          amount: String(p.amount || 0),
          paymentMode: p.paymentMode || "cash",
          status: p.status,
          notes: p.notes || "",
        }),
      });
    } catch { /* fire-and-forget — errors silently ignored */ }
  })();
}
