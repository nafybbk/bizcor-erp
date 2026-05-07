import { Router } from "express";
import { db, pool } from "@workspace/db";
import {
  cashBankAccountsTable, expenseHeadsTable, expenseVouchersTable, contraEntriesTable,
  paymentsTable, partiesTable,
} from "@workspace/db";
import { eq, and, sql, desc, gte, lte, asc } from "drizzle-orm";
import { requireBusiness } from "../middlewares/auth";

const router = Router();
router.use(requireBusiness);

// ─── Startup migration — create tables if missing ─────────────────────────
let migrated = false;
async function ensureTables() {
  if (migrated) return;
  migrated = true;
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

    const rows = await pool.query(`
      SELECT ev.*, eh.name as expense_head_name, cb.name as account_name
      FROM expense_vouchers ev
      LEFT JOIN expense_heads eh ON ev.expense_head_id = eh.id
      LEFT JOIN cash_bank_accounts cb ON ev.account_id = cb.id
      WHERE ev.business_id = $1
      ${fromDate ? `AND ev.date >= '${String(fromDate)}'` : ""}
      ${toDate ? `AND ev.date <= '${String(toDate)}'` : ""}
      ${accountId ? `AND ev.account_id = ${Number(accountId)}` : ""}
      ${expenseHeadId ? `AND ev.expense_head_id = ${Number(expenseHeadId)}` : ""}
      ORDER BY ev.date DESC, ev.id DESC
      LIMIT ${Number(limit)} OFFSET ${(Number(page) - 1) * Number(limit)}
    `, [businessId]);

    const countRow = await pool.query(`SELECT COUNT(*) as total, COALESCE(SUM(amount),0) as total_amount FROM expense_vouchers WHERE business_id = $1 ${fromDate ? `AND date >= '${String(fromDate)}'` : ""} ${toDate ? `AND date <= '${String(toDate)}'` : ""} ${accountId ? `AND account_id = ${Number(accountId)}` : ""} ${expenseHeadId ? `AND expense_head_id = ${Number(expenseHeadId)}` : ""}`, [businessId]);

    res.json({
      data: rows.rows.map((r: any) => ({ ...r, amount: Number(r.amount) })),
      total: Number(countRow.rows[0].total),
      totalAmount: Number(countRow.rows[0].total_amount),
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
    const rows = await pool.query(
      `SELECT ev.*, eh.name as expense_head_name, cb.name as account_name
       FROM expense_vouchers ev
       LEFT JOIN expense_heads eh ON ev.expense_head_id = eh.id
       LEFT JOIN cash_bank_accounts cb ON ev.account_id = cb.id
       WHERE ev.id = $1 AND ev.business_id = $2`,
      [Number(req.params.id), businessId]
    );
    if (!rows.rows.length) { res.status(404).json({ error: "Not Found" }); return; }
    const r = rows.rows[0];
    res.json({ ...r, amount: Number(r.amount), expenseHeadId: r.expense_head_id, accountId: r.account_id, paymentMode: r.payment_mode, referenceNumber: r.reference_number });
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
router.get("/contra", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const { fromDate, toDate, page = "1", limit = "50" } = req.query;
    const rows = await pool.query(`
      SELECT ce.*, fa.name as from_account_name, ta.name as to_account_name
      FROM contra_entries ce
      LEFT JOIN cash_bank_accounts fa ON ce.from_account_id = fa.id
      LEFT JOIN cash_bank_accounts ta ON ce.to_account_id = ta.id
      WHERE ce.business_id = $1
      ${fromDate ? `AND ce.date >= '${String(fromDate)}'` : ""}
      ${toDate ? `AND ce.date <= '${String(toDate)}'` : ""}
      ORDER BY ce.date DESC, ce.id DESC
      LIMIT ${Number(limit)} OFFSET ${(Number(page) - 1) * Number(limit)}
    `, [businessId]);
    const countRow = await pool.query(`SELECT COUNT(*) as total FROM contra_entries WHERE business_id = $1 ${fromDate ? `AND date >= '${String(fromDate)}'` : ""} ${toDate ? `AND date <= '${String(toDate)}'` : ""}`, [businessId]);
    res.json({ data: rows.rows.map((r: any) => ({ ...r, amount: Number(r.amount) })), total: Number(countRow.rows[0].total) });
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
// Returns all transactions for a specific account (cash or bank)
// In: receipts/payments with accountId, expenses paid from account, contra entries
router.get("/statement", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const { accountId, fromDate, toDate } = req.query;
    if (!accountId) { res.status(400).json({ error: "accountId required" }); return; }

    const accId = Number(accountId);
    const dateFrom = fromDate ? String(fromDate) : "1900-01-01";
    const dateTo = toDate ? String(toDate) : "2999-12-31";

    // Fetch account
    const accRows = await pool.query(`SELECT * FROM cash_bank_accounts WHERE id = $1 AND business_id = $2`, [accId, businessId]);
    if (!accRows.rows.length) { res.status(404).json({ error: "Account not found" }); return; }
    const account = accRows.rows[0];

    const entries: any[] = [];

    // Opening balance
    const openingBalance = Number(account.opening_balance);

    // Receipts linked to this account
    const receipts = await pool.query(`
      SELECT p.*, pa.name as party_name FROM payments p
      LEFT JOIN parties pa ON p.party_id = pa.id
      WHERE p.business_id = $1 AND p.account_id = $2 AND p.date BETWEEN $3 AND $4
    `, [businessId, accId, dateFrom, dateTo]);
    for (const r of receipts.rows) {
      if (r.type === "receipt") {
        entries.push({ date: r.date, type: "receipt", number: r.payment_number, narration: `Receipt - ${r.party_name || ""}`, debit: Number(r.amount), credit: 0 });
      } else {
        entries.push({ date: r.date, type: "payment", number: r.payment_number, narration: `Payment - ${r.party_name || ""}`, debit: 0, credit: Number(r.amount) });
      }
    }

    // Expenses from this account
    const expenses = await pool.query(`
      SELECT ev.*, eh.name as head_name FROM expense_vouchers ev
      LEFT JOIN expense_heads eh ON ev.expense_head_id = eh.id
      WHERE ev.business_id = $1 AND ev.account_id = $2 AND ev.date BETWEEN $3 AND $4
    `, [businessId, accId, dateFrom, dateTo]);
    for (const e of expenses.rows) {
      entries.push({ date: e.date, type: "expense", number: e.expense_number, narration: `Expense - ${e.head_name || ""}`, debit: 0, credit: Number(e.amount) });
    }

    // Contra entries — from this account (outflow), to this account (inflow)
    const contraFrom = await pool.query(`
      SELECT ce.*, ta.name as other_account FROM contra_entries ce
      LEFT JOIN cash_bank_accounts ta ON ce.to_account_id = ta.id
      WHERE ce.business_id = $1 AND ce.from_account_id = $2 AND ce.date BETWEEN $3 AND $4
    `, [businessId, accId, dateFrom, dateTo]);
    for (const c of contraFrom.rows) {
      entries.push({ date: c.date, type: "contra", number: c.contra_number, narration: `Contra - Transferred to ${c.other_account}`, debit: 0, credit: Number(c.amount) });
    }

    const contraTo = await pool.query(`
      SELECT ce.*, fa.name as other_account FROM contra_entries ce
      LEFT JOIN cash_bank_accounts fa ON ce.from_account_id = fa.id
      WHERE ce.business_id = $1 AND ce.to_account_id = $2 AND ce.date BETWEEN $3 AND $4
    `, [businessId, accId, dateFrom, dateTo]);
    for (const c of contraTo.rows) {
      entries.push({ date: c.date, type: "contra", number: c.contra_number, narration: `Contra - Received from ${c.other_account}`, debit: Number(c.amount), credit: 0 });
    }

    // Sort by date
    entries.sort((a, b) => a.date.localeCompare(b.date) || 0);

    // Running balance
    let balance = openingBalance;
    const withBalance = entries.map(e => {
      balance += e.debit - e.credit;
      return { ...e, balance };
    });

    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    const closingBalance = openingBalance + totalDebit - totalCredit;

    res.json({
      account: { ...account, openingBalance },
      openingBalance,
      entries: withBalance,
      totalDebit,
      totalCredit,
      closingBalance,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── ACCOUNT BALANCE SUMMARY ──────────────────────────────────────────────
router.get("/balances", async (req, res) => {
  try {
    await ensureTables();
    const businessId = req.user!.businessId!;
    const accounts = await pool.query(`SELECT * FROM cash_bank_accounts WHERE business_id = $1 AND is_active = true ORDER BY type, name`, [businessId]);

    const result = await Promise.all(accounts.rows.map(async (acc: any) => {
      const accId = acc.id;
      const openingBalance = Number(acc.opening_balance);

      const receiptSum = await pool.query(`SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE business_id=$1 AND account_id=$2 AND type='receipt'`, [businessId, accId]);
      const paymentSum = await pool.query(`SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE business_id=$1 AND account_id=$2 AND type='payment'`, [businessId, accId]);
      const expenseSum = await pool.query(`SELECT COALESCE(SUM(amount),0) as s FROM expense_vouchers WHERE business_id=$1 AND account_id=$2`, [businessId, accId]);
      const contraOut = await pool.query(`SELECT COALESCE(SUM(amount),0) as s FROM contra_entries WHERE business_id=$1 AND from_account_id=$2`, [businessId, accId]);
      const contraIn = await pool.query(`SELECT COALESCE(SUM(amount),0) as s FROM contra_entries WHERE business_id=$1 AND to_account_id=$2`, [businessId, accId]);

      const balance = openingBalance
        + Number(receiptSum.rows[0].s)
        - Number(paymentSum.rows[0].s)
        - Number(expenseSum.rows[0].s)
        - Number(contraOut.rows[0].s)
        + Number(contraIn.rows[0].s);

      return { id: acc.id, name: acc.name, type: acc.type, bankName: acc.bank_name, accountNumber: acc.account_number, openingBalance, balance };
    }));

    res.json(result);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal Server Error" }); }
});

export default router;
