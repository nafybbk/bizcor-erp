import { Router } from "express";
import { eq, and, isNull } from "drizzle-orm";
// Note: parties & items use hard delete; only vouchers have deletedAt
import { db, partiesTable, itemsTable, vouchersTable, voucherItemsTable, taxRatesTable, unitsTable } from "@workspace/db";
import { requireSuperAdmin } from "../middlewares/auth";

const router = Router();

function excelDateToISO(val: any): string {
  if (!val) return new Date().toISOString().slice(0, 10);
  if (typeof val === "number" && val > 40000) {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(val);
  if (s.length >= 10) return s.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function normGST(v: any): number {
  const n = Number(v) || 0;
  return n > 0 && n < 1 ? Math.round(n * 100) : Math.round(n);
}

function nearestGSTRate(pct: number): number {
  return [0, 3, 5, 12, 18, 28].reduce((p, c) => Math.abs(c - pct) < Math.abs(p - pct) ? c : p);
}

router.post("/import-smarterp", requireSuperAdmin, async (req, res) => {
  try {
    const { businessId, invoices = [], qtySold = [], purchases = [] } = req.body;
    if (!businessId) return res.status(400).json({ error: "businessId required" });

    const biz = Number(businessId);
    const log: string[] = [];
    const counts = {
      partiesCreated: 0, partiesExisting: 0,
      itemsCreated: 0, itemsExisting: 0,
      salesCreated: 0, salesSkipped: 0, salesErrors: 0,
      purchasesCreated: 0, purchasesSkipped: 0, purchasesErrors: 0,
    };

    const [existingParties, existingItems, existingVouchers, taxRates, units] = await Promise.all([
      db.select({ id: partiesTable.id, name: partiesTable.name, gstin: partiesTable.gstin })
        .from(partiesTable).where(eq(partiesTable.businessId, biz)),
      db.select({ id: itemsTable.id, name: itemsTable.name })
        .from(itemsTable).where(eq(itemsTable.businessId, biz)),
      db.select({ id: vouchersTable.id, voucherNumber: vouchersTable.voucherNumber })
        .from(vouchersTable).where(and(eq(vouchersTable.businessId, biz), isNull(vouchersTable.deletedAt))),
      db.select().from(taxRatesTable).where(eq(taxRatesTable.businessId, biz)),
      db.select().from(unitsTable).where(eq(unitsTable.businessId, biz)),
    ]);

    const partyByGstin = new Map<string, number>();
    const partyByName = new Map<string, number>();
    for (const p of existingParties) {
      if (p.gstin) partyByGstin.set(p.gstin.toUpperCase().trim(), p.id);
      partyByName.set(p.name.toLowerCase().trim(), p.id);
    }

    const itemByName = new Map<string, number>();
    for (const i of existingItems) itemByName.set(i.name.toLowerCase().trim(), i.id);

    const voucherByNum = new Map<string, number>();
    for (const v of existingVouchers) voucherByNum.set(v.voucherNumber, v.id);

    const taxRateByPct = new Map<number, number>();
    for (const t of taxRates) taxRateByPct.set(Number(t.rate), t.id);

    const defaultUnit = units.find(u => ["pcs","nos","nos.","piece","pieces"].includes(u.name.toLowerCase()))?.name || "PCS";

    async function ensureParty(name: string, gstin: string, type: "customer" | "supplier"): Promise<number | null> {
      if (!name || name.trim().length < 2) return null;
      const g = gstin ? gstin.toUpperCase().trim() : "";
      if (g && partyByGstin.has(g)) { counts.partiesExisting++; return partyByGstin.get(g)!; }
      const nl = name.toLowerCase().trim();
      if (partyByName.has(nl)) { counts.partiesExisting++; return partyByName.get(nl)!; }
      try {
        const [p] = await db.insert(partiesTable).values({
          businessId: biz, name: name.trim(), gstin: g || null, type,
          stateCode: g ? g.slice(0, 2) : null,
          openingBalance: "0", openingBalanceType: "dr",
        } as any).returning({ id: partiesTable.id });
        partyByGstin.set(g, p.id);
        partyByName.set(nl, p.id);
        counts.partiesCreated++;
        return p.id;
      } catch (e: any) { log.push(`Party error: ${name} — ${e.message?.slice(0, 80)}`); return null; }
    }

    async function ensureItem(name: string, hsnCode: string, rate: number): Promise<number | null> {
      if (!name || name.trim().length < 1) return null;
      const nl = name.toLowerCase().trim();
      if (itemByName.has(nl)) { counts.itemsExisting++; return itemByName.get(nl)!; }
      try {
        const [i] = await db.insert(itemsTable).values({
          businessId: biz, name: name.trim(), type: "goods",
          hsnCode: hsnCode || null,
          salePrice: String(rate || 0), purchasePrice: "0", openingStock: "0",
        } as any).returning({ id: itemsTable.id });
        itemByName.set(nl, i.id);
        counts.itemsCreated++;
        return i.id;
      } catch (e: any) { log.push(`Item error: ${name} — ${e.message?.slice(0, 80)}`); return null; }
    }

    // Index Qty Sold by DocNo
    const linesByDoc = new Map<string, any[]>();
    const skipNames = new Set(["cgst","sgst","igst","carriage","freight","cess","discount"]);
    for (const row of qtySold) {
      const docNo = String(row.DocNo || row.docNo || "").trim();
      const name = String(row.ItemNameE || row.itemNameE || "").trim();
      if (!docNo || !name || skipNames.has(name.toLowerCase())) continue;
      if (!linesByDoc.has(docNo)) linesByDoc.set(docNo, []);
      linesByDoc.get(docNo)!.push(row);
    }

    // ── Sales Invoices ─────────────────────────────────────────────────────────
    for (const inv of invoices) {
      const docNo = String(inv.DocNo || inv.docNo || "").trim();
      if (!docNo) continue;
      if (voucherByNum.has(docNo)) { counts.salesSkipped++; continue; }

      const custName = String(inv.CustName || inv.custName || "").trim();
      const gstin = String(inv.Country || inv.country || "").trim();
      const dateStr = excelDateToISO(inv.DateG || inv.dateG);
      const txValue = Number(inv.TXvalue || inv.txValue || inv.NetTotal || 0);
      const gstPct = normGST(inv.GSTpercent || inv.gstpercent || 0);
      const isInterState = String(inv.IGSTorSGST || inv.igstOrSgst || "SGST").toUpperCase() === "IGST";
      const placeOfSupply = gstin ? gstin.slice(0, 2) : "";

      if (!custName) { counts.salesErrors++; log.push(`SI ${docNo}: Party name missing`); continue; }

      const partyId = await ensureParty(custName, gstin, "customer");
      if (!partyId) { counts.salesErrors++; continue; }

      const lines = linesByDoc.get(docNo) || [];
      let items: any[];

      if (lines.length > 0) {
        items = await Promise.all(lines.map(async row => {
          const iName = String(row.ItemNameE || row.itemNameE || "Item").trim();
          const hsn = String(row.GST || row.gst || row.ItemNameA || "").trim();
          const qty = Number(row.Qty || row.qty || 1);
          const rate = Number(row.SalesPrice || row.salesPrice || 0);
          const taxable = rate * qty;
          const cgst = isInterState ? 0 : taxable * gstPct / 200;
          const sgst = isInterState ? 0 : taxable * gstPct / 200;
          const igst = isInterState ? taxable * gstPct / 100 : 0;
          const itemId = await ensureItem(iName, hsn, rate);
          return { itemId, itemName: iName, quantity: qty.toFixed(2), unit: defaultUnit, rate: rate.toFixed(2),
            discount: "0", discountType: "percent", taxRate: gstPct.toFixed(2),
            taxRateId: taxRateByPct.get(gstPct) || null,
            taxableAmount: taxable.toFixed(2), cgst: cgst.toFixed(2), sgst: sgst.toFixed(2), igst: igst.toFixed(2),
            amount: (taxable + cgst + sgst + igst).toFixed(2), total: (taxable + cgst + sgst + igst).toFixed(2), hsnCode: hsn };
        }));
      } else {
        const taxable = txValue;
        const cgst = isInterState ? 0 : taxable * gstPct / 200;
        const sgst = isInterState ? 0 : taxable * gstPct / 200;
        const igst = isInterState ? taxable * gstPct / 100 : 0;
        items = [{ itemId: null, itemName: "Imported Items", quantity: "1", unit: defaultUnit, rate: taxable.toFixed(2),
          discount: "0", discountType: "percent", taxRate: gstPct.toFixed(2),
          taxRateId: taxRateByPct.get(gstPct) || null,
          taxableAmount: taxable.toFixed(2), cgst: cgst.toFixed(2), sgst: sgst.toFixed(2), igst: igst.toFixed(2),
          amount: (taxable + cgst + sgst + igst).toFixed(2), total: (taxable + cgst + sgst + igst).toFixed(2), hsnCode: null }];
      }

      const totTaxable = items.reduce((s, i) => s + Number(i.taxableAmount), 0);
      const totCgst = items.reduce((s, i) => s + Number(i.cgst), 0);
      const totSgst = items.reduce((s, i) => s + Number(i.sgst), 0);
      const totIgst = items.reduce((s, i) => s + Number(i.igst), 0);
      const grand = totTaxable + totCgst + totSgst + totIgst;

      try {
        const [v] = await db.insert(vouchersTable).values({
          businessId: biz, voucherType: "sales_invoice", voucherNumber: docNo, date: dateStr, partyId,
          grandTotal: grand.toFixed(2), taxableAmount: totTaxable.toFixed(2),
          cgst: totCgst.toFixed(2), sgst: totSgst.toFixed(2), igst: totIgst.toFixed(2),
          isInterState, placeOfSupply: placeOfSupply || null, transportCharges: "0",
          status: "posted", notes: "Imported from SmartERP",
        } as any).returning({ id: vouchersTable.id });
        await db.insert(voucherItemsTable).values(items.map(i => ({ ...i, voucherId: v.id, businessId: biz })));
        voucherByNum.set(docNo, v.id);
        counts.salesCreated++;
      } catch (e: any) {
        counts.salesErrors++;
        log.push(`SI ${docNo}: ${e.message?.slice(0, 100)}`);
      }
    }

    // ── Purchase Bills ─────────────────────────────────────────────────────────
    for (const pur of purchases) {
      const docNo = String(pur.DocNo || pur.docNo || "").trim();
      if (!docNo) continue;
      if (voucherByNum.has(docNo)) { counts.purchasesSkipped++; continue; }

      const supName = String(pur.SupName || pur.supName || "").trim();
      const gstin = String(pur.GSTIN || pur.gstin || "").trim();
      const dateStr = excelDateToISO(pur.DateG || pur.dateG);
      const totalVal = Number(pur.TotalVal || pur.totalVal || 0);
      const txValue = Number(pur.TxValue || pur.txValue || totalVal);
      const gstType = String(pur.GST || pur.gst || "SGST").toUpperCase();
      const isInterState = gstType === "IGST";
      const placeOfSupply = gstin ? gstin.slice(0, 2) : "";
      const gstAmt = totalVal - txValue;
      const rawPct = txValue > 0 ? Math.round(gstAmt / txValue * 100) : 5;
      const gstPct = nearestGSTRate(rawPct);
      const remarks = String(pur.Remarks || pur.remarks || "").trim();

      if (!supName) { counts.purchasesErrors++; log.push(`PB ${docNo}: Supplier name missing`); continue; }
      const partyId = await ensureParty(supName, gstin, "supplier");
      if (!partyId) { counts.purchasesErrors++; continue; }

      const taxable = txValue;
      const cgst = isInterState ? 0 : taxable * gstPct / 200;
      const sgst = isInterState ? 0 : taxable * gstPct / 200;
      const igst = isInterState ? taxable * gstPct / 100 : 0;

      try {
        const [v] = await db.insert(vouchersTable).values({
          businessId: biz, voucherType: "purchase_bill", voucherNumber: docNo, date: dateStr, partyId,
          grandTotal: totalVal.toFixed(2), taxableAmount: taxable.toFixed(2),
          cgst: cgst.toFixed(2), sgst: sgst.toFixed(2), igst: igst.toFixed(2),
          isInterState, placeOfSupply: placeOfSupply || null, transportCharges: "0",
          status: "posted", notes: remarks ? `${remarks} | Imported` : "Imported from SmartERP",
        } as any).returning({ id: vouchersTable.id });
        await db.insert(voucherItemsTable).values({
          voucherId: v.id, businessId: biz, itemId: null, itemName: "Imported Purchase",
          quantity: "1", unit: defaultUnit, rate: taxable.toFixed(2),
          discount: "0", discountType: "percent", taxRate: gstPct.toFixed(2),
          taxRateId: taxRateByPct.get(gstPct) || null,
          taxableAmount: taxable.toFixed(2), cgst: cgst.toFixed(2), sgst: sgst.toFixed(2), igst: igst.toFixed(2),
          amount: totalVal.toFixed(2), total: totalVal.toFixed(2), hsnCode: null,
        } as any);
        voucherByNum.set(docNo, v.id);
        counts.purchasesCreated++;
      } catch (e: any) {
        counts.purchasesErrors++;
        log.push(`PB ${docNo}: ${e.message?.slice(0, 100)}`);
      }
    }

    return res.json({ ok: true, counts, log: log.slice(0, 50) });
  } catch (e: any) {
    req.log.error(e);
    return res.status(500).json({ error: e.message });
  }
});

export default router;
