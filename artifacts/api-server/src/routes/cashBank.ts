import { Router } from "express";
import { db } from "@workspace/db";
import {
  cashBankAccountsTable, expenseHeadsTable, expenseVouchersTable, contraEntriesTable,
  paymentsTable, partiesTable,
} from "@workspace/db";
import { eq, and, sql, desc, gte, lte, asc } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

// ─── Startup migration — only runs in PG mode (SQLite tables created in runSqliteInit) ────
const isSQLite = !!process.env.SQLITE_PATH;
let migrated = false;
async function ensureTables() {
  if (migrated) return;
  migrated = true;
  if (isSQLite) return; // SQLite tables already created in index.ts runSqliteInit
  // PG-only migration
  const { pool } = await import("@workspace/db");
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
        CREATE TYPE account_type AS ENUM ('cash', 'bank');
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS cash_bank_accounts (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      type account_type NOT NULL DEFAULT 'cash',
      bank_name TEXT,
      account_number TEXT,
      ifsc_code TEXT,
      opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
      is_default BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS expense_heads (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS expense_vouchers (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      expense_number TEXT NOT NULL,
      date TEXT NOT NULL,
      expense_head_id INTEGER REFERENCES expense_heads(id),
      account_id INTEGER REFERENCES cash_bank_accounts(id),
      amount NUMERIC(15,2) NOT NULL,
      payment_mode TEXT NOT NULL DEFAULT 'cash',
      reference_number TEXT,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contra_entries (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      contra_number TEXT NOT NULL,
      date TEXT NOT NULL,
      from_account_id INTEGER NOT NULL REFERENCES cash_bank_accounts(id),
      to_account_id INTEGER NOT NULL REFERENCES cash_bank_accounts(id),
      amount NUMERIC(15,2) NOT NULL,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE payments ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES cash_bank_accounts(id);
  `);
}

// ─── ACCOUNTS ─────────────────────────────────────────────────────────────
router.get("/accounts", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const accounts = await db.select().from(cashBankAccountsTable)
      .where(and(eq(cashBankAccountsTable.businessId, businessId), eq(cashBankAccountsTable.isActive, true)))
      .orderBy(asc(cashBankAccountsTable.createdAt));
    res.json(accounts.map(a => ({ ...a, openingBalance: Number(a.openingBalance) })));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/accounts", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const { name, type, bankName, accountNumber, ifscCode, openingBalance, isDefault } = req.body;
    if (isDefault) {
      await db.update(cashBankAccountsTable).set({ isDefault: false }).where(eq(cashBankAccountsTable.businessId, businessId));
    }
    const [acc] = await db.insert(cashBankAccountsTable).values({
      businessId, name, type, bankName, accountNumber, ifscCode,
      openingBalance: String(openingBalance || 0), isDefault: !!isDefault,
    }).returning();
    res.status(201).json({ ...acc, openingBalance: Number(acc.openingBalance) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch("/accounts/:id", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const { name, type, bankName, accountNumber, ifscCode, openingBalance, isDefault } = req.body;
    if (isDefault) {
      await db.update(cashBankAccountsTable).set({ isDefault: false }).where(eq(cashBankAccountsTable.businessId, businessId));
    }
    const [acc] = await db.update(cashBankAccountsTable).set({
      name, type, bankName, accountNumber, ifscCode,
      openingBalance: String(openingBalance || 0), isDefault: !!isDefault,
    }).where(and(eq(cashBankAccountsTable.id, Number(req.params.id)), eq(cashBankAccountsTable.businessId, businessId)))
      .returning();
    if (!acc) { res.status(404).json({ error: "Not Found" }); return; }
    res.json({ ...acc, openingBalance: Number(acc.openingBalance) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.delete("/accounts/:id", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    await db.update(cashBankAccountsTable).set({ isActive: false })
      .where(and(eq(cashBankAccountsTable.id, Number(req.params.id)), eq(cashBankAccountsTable.businessId, businessId)));
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── EXPENSE HEADS ────────────────────────────────────────────────────────
router.get("/expense-heads", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const heads = await db.select().from(expenseHeadsTable)
      .where(and(eq(expenseHeadsTable.businessId, businessId), eq(expenseHeadsTable.isActive, true)))
      .orderBy(asc(expenseHeadsTable.name));
    res.json(heads);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/expense-heads", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const { name } = req.body;
    const [head] = await db.insert(expenseHeadsTable).values({ businessId, name }).returning();
    res.status(201).json(head);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch("/expense-heads/:id", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const { name } = req.body;
    const [head] = await db.update(expenseHeadsTable).set({ name })
      .where(and(eq(expenseHeadsTable.id, Number(req.params.id)), eq(expenseHeadsTable.businessId, businessId)))
      .returning();
    if (!head) { res.status(404).json({ error: "Not Found" }); return; }
    res.json(head);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.delete("/expense-heads/:id", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    await db.update(expenseHeadsTable).set({ isActive: false })
      .where(and(eq(expenseHeadsTable.id, Number(req.params.id)), eq(expenseHeadsTable.businessId, businessId)));
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── EXPENSES ─────────────────────────────────────────────────────────────
router.get("/expenses", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const { fromDate, toDate, accountId, expenseHeadId, page = "1", limit = "50" } = req.query;
    const conditions: any[] = [eq(expenseVouchersTable.businessId, businessId)];
    if (fromDate) conditions.push(gte(expenseVouchersTable.date, String(fromDate)));
    if (toDate) conditions.push(lte(expenseVouchersTable.date, String(toDate)));
    if (accountId) conditions.push(eq(expenseVouchersTable.accountId, Number(accountId)));
    if (expenseHeadId) conditions.push(eq(expenseVouchersTable.expenseHeadId, Number(expenseHeadId)));

    const rows = await db.select({
      id: expenseVouchersTable.id,
      businessId: expenseVouchersTable.businessId,
      expenseNumber: expenseVouchersTable.expenseNumber,
      date: expenseVouchersTable.date,
      expenseHeadId: expenseVouchersTable.expenseHeadId,
      accountId: expenseVouchersTable.accountId,
      amount: expenseVouchersTable.amount,
      paymentMode: expenseVouchersTable.paymentMode,
      referenceNumber: expenseVouchersTable.referenceNumber,
      notes: expenseVouchersTable.notes,
      createdAt: expenseVouchersTable.createdAt,
      expenseHeadName: expenseHeadsTable.name,
      accountName: cashBankAccountsTable.name,
    }).from(expenseVouchersTable)
      .leftJoin(expenseHeadsTable, eq(expenseVouchersTable.expenseHeadId, expenseHeadsTable.id))
      .leftJoin(cashBankAccountsTable, eq(expenseVouchersTable.accountId, cashBankAccountsTable.id))
      .where(and(...conditions))
      .orderBy(desc(expenseVouchersTable.date), desc(expenseVouchersTable.id))
      .limit(Number(limit))
      .offset((Number(page) - 1) * Number(limit));

    const [{ total, totalAmount }] = await db.select({
      total: sql<number>`count(*)`,
      totalAmount: sql<number>`coalesce(sum(${expenseVouchersTable.amount}), 0)`,
    }).from(expenseVouchersTable).where(and(...conditions));

    res.json({
      data: rows.map(r => ({ ...r, amount: Number(r.amount) })),
      total: Number(total),
      totalAmount: Number(totalAmount),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/expenses", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const { date, expenseHeadId, accountId, amount, paymentMode, referenceNumber, notes } = req.body;
    const [{ cnt }] = await db.select({ cnt: sql<number>`count(*)` }).from(expenseVouchersTable).where(eq(expenseVouchersTable.businessId, businessId));
    const expenseNumber = `EXP-${String(Number(cnt) + 1).padStart(4, "0")}`;
    const [exp] = await db.insert(expenseVouchersTable).values({
      businessId, expenseNumber, date,
      expenseHeadId: expenseHeadId ? Number(expenseHeadId) : null,
      accountId: accountId ? Number(accountId) : null,
      amount: String(amount), paymentMode, referenceNumber, notes,
    }).returning();
    res.status(201).json({ ...exp, amount: Number(exp.amount) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/expenses/:id", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const rows = await db.select({
      id: expenseVouchersTable.id,
      businessId: expenseVouchersTable.businessId,
      expenseNumber: expenseVouchersTable.expenseNumber,
      date: expenseVouchersTable.date,
      expenseHeadId: expenseVouchersTable.expenseHeadId,
      accountId: expenseVouchersTable.accountId,
      amount: expenseVouchersTable.amount,
      paymentMode: expenseVouchersTable.paymentMode,
      referenceNumber: expenseVouchersTable.referenceNumber,
      notes: expenseVouchersTable.notes,
      createdAt: expenseVouchersTable.createdAt,
      expenseHeadName: expenseHeadsTable.name,
      accountName: cashBankAccountsTable.name,
    }).from(expenseVouchersTable)
      .leftJoin(expenseHeadsTable, eq(expenseVouchersTable.expenseHeadId, expenseHeadsTable.id))
      .leftJoin(cashBankAccountsTable, eq(expenseVouchersTable.accountId, cashBankAccountsTable.id))
      .where(and(eq(expenseVouchersTable.id, Number(req.params.id)), eq(expenseVouchersTable.businessId, businessId)));
    if (!rows.length) { res.status(404).json({ error: "Not Found" }); return; }
    const r = rows[0];
    res.json({ ...r, amount: Number(r.amount) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch("/expenses/:id", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const { date, expenseHeadId, accountId, amount, paymentMode, referenceNumber, notes } = req.body;
    const [exp] = await db.update(expenseVouchersTable).set({
      date,
      expenseHeadId: expenseHeadId ? Number(expenseHeadId) : null,
      accountId: accountId ? Number(accountId) : null,
      amount: String(amount), paymentMode, referenceNumber, notes,
    }).where(and(eq(expenseVouchersTable.id, Number(req.params.id)), eq(expenseVouchersTable.businessId, businessId)))
      .returning();
    if (!exp) { res.status(404).json({ error: "Not Found" }); return; }
    res.json({ ...exp, amount: Number(exp.amount) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.delete("/expenses/:id", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    await db.delete(expenseVouchersTable)
      .where(and(eq(expenseVouchersTable.id, Number(req.params.id)), eq(expenseVouchersTable.businessId, businessId)));
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── CONTRA ENTRIES ───────────────────────────────────────────────────────
const fromAcct = { id: cashBankAccountsTable.id, name: cashBankAccountsTable.name };

router.get("/contra", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const { fromDate, toDate, page = "1", limit = "50" } = req.query;
    const conditions: any[] = [eq(contraEntriesTable.businessId, businessId)];
    if (fromDate) conditions.push(gte(contraEntriesTable.date, String(fromDate)));
    if (toDate) conditions.push(lte(contraEntriesTable.date, String(toDate)));

    // Use sqlite-compatible query — alias tables for from/to join
    const fromAccountsTable = { ...cashBankAccountsTable } as typeof cashBankAccountsTable;
    const toAccountsTable = { ...cashBankAccountsTable } as typeof cashBankAccountsTable;

    // Fetch raw contra entries with businessId filter
    const entries = await db.select().from(contraEntriesTable)
      .where(and(...conditions))
      .orderBy(desc(contraEntriesTable.date), desc(contraEntriesTable.id))
      .limit(Number(limit))
      .offset((Number(page) - 1) * Number(limit));

    // Fetch all needed account names in one query
    const accountIds = [...new Set(entries.flatMap(e => [e.fromAccountId, e.toAccountId]).filter(Boolean))] as number[];
    let accountMap: Record<number, string> = {};
    if (accountIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      const accs = await db.select({ id: cashBankAccountsTable.id, name: cashBankAccountsTable.name })
        .from(cashBankAccountsTable).where(inArray(cashBankAccountsTable.id, accountIds));
      for (const a of accs) accountMap[a.id] = a.name;
    }

    const [{ total }] = await db.select({ total: sql<number>`count(*)` })
      .from(contraEntriesTable).where(and(...conditions));

    res.json({
      data: entries.map(e => ({
        ...e,
        amount: Number(e.amount),
        fromAccountName: accountMap[e.fromAccountId] || "",
        toAccountName: accountMap[e.toAccountId] || "",
      })),
      total: Number(total),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/contra", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const { date, fromAccountId, toAccountId, amount, notes } = req.body;
    if (fromAccountId === toAccountId) { res.status(400).json({ error: "From and To accounts must be different" }); return; }
    const [{ cnt }] = await db.select({ cnt: sql<number>`count(*)` }).from(contraEntriesTable).where(eq(contraEntriesTable.businessId, businessId));
    const contraNumber = `CON-${String(Number(cnt) + 1).padStart(4, "0")}`;
    const [entry] = await db.insert(contraEntriesTable).values({
      businessId, contraNumber, date,
      fromAccountId: Number(fromAccountId), toAccountId: Number(toAccountId),
      amount: String(amount), notes,
    }).returning();
    res.status(201).json({ ...entry, amount: Number(entry.amount) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

router.delete("/contra/:id", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    await db.delete(contraEntriesTable)
      .where(and(eq(contraEntriesTable.id, Number(req.params.id)), eq(contraEntriesTable.businessId, businessId)));
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── CASH BOOK / BANK STATEMENT ───────────────────────────────────────────
router.get("/statement", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const { accountId, fromDate, toDate } = req.query;
    if (!accountId) { res.status(400).json({ error: "accountId required" }); return; }

    const accId = Number(accountId);
    const dateFrom = fromDate ? String(fromDate) : "1900-01-01";
    const dateTo = toDate ? String(toDate) : "2999-12-31";

    const [account] = await db.select().from(cashBankAccountsTable)
      .where(and(eq(cashBankAccountsTable.id, accId), eq(cashBankAccountsTable.businessId, businessId)));
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }

    const openingBalance = Number(account.openingBalance);
    const isCashAccount = account.type === "cash";
    const entries: any[] = [];

    // Receipts/Payments linked to this account
    const pmtConditions: any[] = [
      eq(paymentsTable.businessId, businessId),
      gte(paymentsTable.date, dateFrom),
      lte(paymentsTable.date, dateTo),
    ];
    const allPayments = await db.select({
      id: paymentsTable.id,
      date: paymentsTable.date,
      type: paymentsTable.type,
      paymentNumber: paymentsTable.paymentNumber,
      amount: paymentsTable.amount,
      accountId: paymentsTable.accountId,
      paymentMode: paymentsTable.paymentMode,
      partyName: partiesTable.name,
    }).from(paymentsTable)
      .leftJoin(partiesTable, eq(paymentsTable.partyId, partiesTable.id))
      .where(and(...pmtConditions));

    for (const p of allPayments) {
      const linked = p.accountId === accId || (isCashAccount && p.accountId === null && p.paymentMode === "cash");
      if (!linked) continue;
      if (p.type === "receipt") {
        entries.push({ date: p.date, type: "receipt", number: p.paymentNumber, narration: `Receipt - ${p.partyName || ""}`, debit: Number(p.amount), credit: 0 });
      } else {
        entries.push({ date: p.date, type: "payment", number: p.paymentNumber, narration: `Payment - ${p.partyName || ""}`, debit: 0, credit: Number(p.amount) });
      }
    }

    // Expenses from this account
    const expRows = await db.select({
      date: expenseVouchersTable.date,
      expenseNumber: expenseVouchersTable.expenseNumber,
      amount: expenseVouchersTable.amount,
      headName: expenseHeadsTable.name,
    }).from(expenseVouchersTable)
      .leftJoin(expenseHeadsTable, eq(expenseVouchersTable.expenseHeadId, expenseHeadsTable.id))
      .where(and(
        eq(expenseVouchersTable.businessId, businessId),
        eq(expenseVouchersTable.accountId, accId),
        gte(expenseVouchersTable.date, dateFrom),
        lte(expenseVouchersTable.date, dateTo),
      ));
    for (const e of expRows) {
      entries.push({ date: e.date, type: "expense", number: e.expenseNumber, narration: `Expense - ${e.headName || ""}`, debit: 0, credit: Number(e.amount) });
    }

    // Contra: outflow from this account
    const contraOutRows = await db.select({
      date: contraEntriesTable.date,
      contraNumber: contraEntriesTable.contraNumber,
      amount: contraEntriesTable.amount,
      otherAccount: cashBankAccountsTable.name,
    }).from(contraEntriesTable)
      .leftJoin(cashBankAccountsTable, eq(contraEntriesTable.toAccountId, cashBankAccountsTable.id))
      .where(and(
        eq(contraEntriesTable.businessId, businessId),
        eq(contraEntriesTable.fromAccountId, accId),
        gte(contraEntriesTable.date, dateFrom),
        lte(contraEntriesTable.date, dateTo),
      ));
    for (const c of contraOutRows) {
      entries.push({ date: c.date, type: "contra", number: c.contraNumber, narration: `Contra - Transferred to ${c.otherAccount || ""}`, debit: 0, credit: Number(c.amount) });
    }

    // Contra: inflow to this account
    const contraInRows = await db.select({
      date: contraEntriesTable.date,
      contraNumber: contraEntriesTable.contraNumber,
      amount: contraEntriesTable.amount,
      otherAccount: cashBankAccountsTable.name,
    }).from(contraEntriesTable)
      .leftJoin(cashBankAccountsTable, eq(contraEntriesTable.fromAccountId, cashBankAccountsTable.id))
      .where(and(
        eq(contraEntriesTable.businessId, businessId),
        eq(contraEntriesTable.toAccountId, accId),
        gte(contraEntriesTable.date, dateFrom),
        lte(contraEntriesTable.date, dateTo),
      ));
    for (const c of contraInRows) {
      entries.push({ date: c.date, type: "contra", number: c.contraNumber, narration: `Contra - Received from ${c.otherAccount || ""}`, debit: Number(c.amount), credit: 0 });
    }

    entries.sort((a, b) => a.date.localeCompare(b.date));

    let balance = openingBalance;
    const withBalance = entries.map(e => {
      balance += e.debit - e.credit;
      return { ...e, balance };
    });

    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

    res.json({
      account: { ...account, openingBalance },
      openingBalance,
      entries: withBalance,
      totalDebit,
      totalCredit,
      closingBalance: openingBalance + totalDebit - totalCredit,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── ACCOUNT BALANCE SUMMARY ──────────────────────────────────────────────
router.get("/balances", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const accounts = await db.select().from(cashBankAccountsTable)
      .where(and(eq(cashBankAccountsTable.businessId, businessId), eq(cashBankAccountsTable.isActive, true)))
      .orderBy(asc(cashBankAccountsTable.name));

    const result = await Promise.all(accounts.map(async (acc) => {
      const accId = acc.id;
      const openingBalance = Number(acc.openingBalance);

      const [receiptRow] = await db.select({ s: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)` })
        .from(paymentsTable).where(and(eq(paymentsTable.businessId, businessId), eq(paymentsTable.accountId, accId), eq(paymentsTable.type, "receipt")));
      const [paymentRow] = await db.select({ s: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)` })
        .from(paymentsTable).where(and(eq(paymentsTable.businessId, businessId), eq(paymentsTable.accountId, accId), eq(paymentsTable.type, "payment")));
      const [expenseRow] = await db.select({ s: sql<number>`coalesce(sum(${expenseVouchersTable.amount}), 0)` })
        .from(expenseVouchersTable).where(and(eq(expenseVouchersTable.businessId, businessId), eq(expenseVouchersTable.accountId, accId)));
      const [contraOutRow] = await db.select({ s: sql<number>`coalesce(sum(${contraEntriesTable.amount}), 0)` })
        .from(contraEntriesTable).where(and(eq(contraEntriesTable.businessId, businessId), eq(contraEntriesTable.fromAccountId, accId)));
      const [contraInRow] = await db.select({ s: sql<number>`coalesce(sum(${contraEntriesTable.amount}), 0)` })
        .from(contraEntriesTable).where(and(eq(contraEntriesTable.businessId, businessId), eq(contraEntriesTable.toAccountId, accId)));

      const balance = openingBalance
        + Number(receiptRow.s) - Number(paymentRow.s)
        - Number(expenseRow.s)
        - Number(contraOutRow.s) + Number(contraInRow.s);

      return {
        id: acc.id, name: acc.name, type: acc.type,
        bankName: acc.bankName, accountNumber: acc.accountNumber,
        openingBalance, balance,
      };
    }));

    res.json(result);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

export default router;
