// LAN → cloud sync pushes for the BizCor Connect mini app.
// Only active on LAN/desktop installs (SQLITE_PATH set). Sync must never slow
// down or break a voucher save, and must stay invisible to the supplier (no
// toasts, no status UI). The cloud endpoint upserts on (businessId,
// externalId, type), so re-pushing an edited or deleted document replaces the
// customer's copy instead of duplicating it.
//
// Durability: pushes go through a local SQLite outbox. If the shop's internet
// is down when a document is saved, the row waits and a background flusher
// retries every couple of minutes — the customer's app catches up silently as
// soon as connectivity returns. Rows are deleted once delivered.
import { db, sqlite } from "@workspace/db";
import { partiesTable, voucherItemsTable, businessesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const CLOUD_URL = () => process.env.CLOUD_API_URL || "https://erp.naewtgroup.com";
const FLUSH_INTERVAL_MS = 2 * 60 * 1000;
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 500; // ~17 hours of retries at 2min — then give up on the row

// The cloud verifies the same business JWT the EXE user logged in with.
// Tokens rotate, so remember the freshest one and use it for retries.
let latestToken = "";
let flusherStarted = false;
let flushing = false;

function ensureOutboxTable(): void {
  if (!sqlite) return;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS lan_sync_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_attempt_at TEXT
    );
  `);
}

async function flushOutbox(): Promise<void> {
  if (!sqlite || flushing || !latestToken) return;
  flushing = true;
  try {
    const rows = sqlite.prepare(
      `SELECT id, kind, payload FROM lan_sync_outbox WHERE attempts < ? ORDER BY id LIMIT ?`
    ).all(MAX_ATTEMPTS, BATCH_SIZE) as { id: number; kind: string; payload: string }[];

    for (const row of rows) {
      try {
        const resp = await fetch(`${CLOUD_URL()}/api/mini-app/lan-sync/${row.kind}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${latestToken}` },
          body: row.payload,
        });
        if (resp.ok || resp.status === 404) {
          // Delivered (404 = party/business not found on cloud — retrying won't help)
          sqlite.prepare(`DELETE FROM lan_sync_outbox WHERE id = ?`).run(row.id);
        } else if (resp.status === 401) {
          // Token stale — stop; next enqueue refreshes the token
          sqlite.prepare(`UPDATE lan_sync_outbox SET attempts = attempts + 1, last_attempt_at = datetime('now') WHERE id = ?`).run(row.id);
          break;
        } else {
          sqlite.prepare(`UPDATE lan_sync_outbox SET attempts = attempts + 1, last_attempt_at = datetime('now') WHERE id = ?`).run(row.id);
        }
      } catch {
        // Network down — mark and stop the batch; the interval will retry
        sqlite.prepare(`UPDATE lan_sync_outbox SET attempts = attempts + 1, last_attempt_at = datetime('now') WHERE id = ?`).run(row.id);
        break;
      }
    }
  } catch { /* outbox must never break anything */ }
  finally { flushing = false; }
}

function enqueue(kind: "voucher" | "payment" | "party", payload: Record<string, unknown>, token: string): void {
  if (!sqlite) return;
  try {
    ensureOutboxTable();
    if (token) latestToken = token;
    sqlite.prepare(`INSERT INTO lan_sync_outbox (kind, payload) VALUES (?, ?)`).run(kind, JSON.stringify(payload));
    if (!flusherStarted) {
      flusherStarted = true;
      // Second chance for rows that exhausted their retries — the cloud
      // rejected every push with 401 until the dual-secret fix, so old rows
      // hold real vouchers that deserve a fresh run now.
      try {
        sqlite.prepare(`UPDATE lan_sync_outbox SET attempts = 0 WHERE attempts >= ?`).run(MAX_ATTEMPTS);
      } catch { /* non-critical */ }
      setInterval(() => { void flushOutbox(); }, FLUSH_INTERVAL_MS).unref?.();
    }
    void flushOutbox(); // try immediately — instant sync when online
  } catch { /* fire-and-forget */ }
}

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

// The local business's own row id has no relationship to its id in the cloud
// Postgres database (two independent auto-increment sequences) — a LAN
// install's businessId can never be trusted to resolve the right business on
// the cloud side. businessCode is the one identifier assigned once and
// shared correctly between both, so every push resolves the cloud business
// by this instead of by raw id.
async function localBusinessCode(businessId: number | null | undefined): Promise<string | null> {
  if (!businessId) return null;
  try {
    const [biz] = await db.select({ businessCode: businessesTable.businessCode })
      .from(businessesTable).where(eq(businessesTable.id, Number(businessId))).limit(1);
    return biz?.businessCode || null;
  } catch { return null; }
}

// Party sync — must run BEFORE voucher/payment sync for the same party, since
// those look the party up on the cloud by pin and just 404 (silently dropped
// forever, see flushOutbox) if it isn't there yet. Safe in practice: a voucher
// can't be saved locally for a party that doesn't already exist locally, and
// the outbox delivers rows in the order they were enqueued.
export function pushLanSyncParty(req: any, p: {
  externalId: number;
  name: string;
  type: string;
  pin?: string | null;
  phone?: string | null;
  miniAppEnabled?: boolean;
}): void {
  if (!process.env.SQLITE_PATH) return;
  if (!p.pin) return; // nothing on the cloud side to match a connect PIN against
  const token = bearerToken(req);
  void (async () => {
    const businessCode = await localBusinessCode(req.user?.businessId);
    enqueue("party", {
      externalId: p.externalId,
      name: p.name || "",
      type: p.type,
      pin: p.pin,
      phone: p.phone || "",
      miniAppEnabled: p.miniAppEnabled !== false,
      businessCode,
    }, token);
  })();
}

// One-time (per process) catch-up for parties that were created/edited before
// this sync existed — otherwise only future creates/edits would ever reach
// the cloud, leaving every already-configured customer permanently unsynced.
let partyBackfillDone = false;
export function ensurePartyBackfill(req: any): void {
  if (!process.env.SQLITE_PATH || partyBackfillDone) return;
  const token = bearerToken(req);
  if (!token) return; // no token yet on this request — try again on the next one
  partyBackfillDone = true;
  void (async () => {
    try {
      const businessId = req.user?.businessId;
      const businessCode = await localBusinessCode(businessId);
      const rows = await db.select({
        id: partiesTable.id,
        name: partiesTable.name,
        type: partiesTable.type,
        pin: partiesTable.pin,
        phone: partiesTable.phone,
        miniAppEnabled: partiesTable.miniAppEnabled,
      }).from(partiesTable).where(eq(partiesTable.businessId, Number(businessId)));
      for (const p of rows as any[]) {
        if (!p.pin) continue;
        enqueue("party", {
          externalId: p.id,
          name: p.name || "",
          type: p.type,
          pin: p.pin,
          phone: p.phone || "",
          miniAppEnabled: p.miniAppEnabled !== false,
          businessCode,
        }, token);
      }
    } catch { partyBackfillDone = false; /* let the next request retry */ }
  })();
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

      // Line items ride along so the customer's app can open the invoice.
      // Fetched here (not passed by callers) — voucher routes stay untouched.
      let items: { name: string; qty: number; unit: string; rate: number; amount: number }[] = [];
      if (v.status !== "deleted") {
        try {
          const rows = await db.select({
            name: voucherItemsTable.itemName,
            qty: voucherItemsTable.quantity,
            unit: voucherItemsTable.unit,
            rate: voucherItemsTable.rate,
            amount: voucherItemsTable.total,
          }).from(voucherItemsTable).where(eq(voucherItemsTable.voucherId, v.externalId));
          items = rows.map((r) => ({
            name: r.name,
            qty: Number(r.qty || 0),
            unit: r.unit || "",
            rate: Number(r.rate || 0),
            amount: Number(r.amount || 0),
          }));
        } catch { /* items are best-effort — header still syncs */ }
      }

      const businessCode = await localBusinessCode(req.user?.businessId);
      enqueue("voucher", {
        partyPin: party.pin,
        partyName: party.name || "",
        externalId: v.externalId,
        voucherType: v.voucherType,
        voucherNumber: v.voucherNumber,
        date: String(v.date),
        grandTotal: String(v.grandTotal || 0),
        status: v.status,
        notes: v.notes || "",
        items,
        businessCode,
      }, bearerToken(req));
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
      const businessCode = await localBusinessCode(req.user?.businessId);
      enqueue("payment", {
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
        businessCode,
      }, bearerToken(req));
    } catch { /* fire-and-forget — errors silently ignored */ }
  })();
}
