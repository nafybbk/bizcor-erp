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
import { partiesTable } from "@workspace/db";
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

function enqueue(kind: "voucher" | "payment", payload: Record<string, unknown>, token: string): void {
  if (!sqlite) return;
  try {
    ensureOutboxTable();
    if (token) latestToken = token;
    sqlite.prepare(`INSERT INTO lan_sync_outbox (kind, payload) VALUES (?, ?)`).run(kind, JSON.stringify(payload));
    if (!flusherStarted) {
      flusherStarted = true;
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
      }, bearerToken(req));
    } catch { /* fire-and-forget — errors silently ignored */ }
  })();
}
