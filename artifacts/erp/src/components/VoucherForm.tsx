import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { api, fmt } from "@/lib/api";
import { Plus, Trash2, Loader2, ToggleLeft, ToggleRight } from "lucide-react";

const INDIAN_STATES = [
  { name: "Andhra Pradesh", code: "37" }, { name: "Bihar", code: "10" }, { name: "Delhi", code: "07" },
  { name: "Goa", code: "30" }, { name: "Gujarat", code: "24" }, { name: "Haryana", code: "06" },
  { name: "Karnataka", code: "29" }, { name: "Kerala", code: "32" }, { name: "Madhya Pradesh", code: "23" },
  { name: "Maharashtra", code: "27" }, { name: "Punjab", code: "03" }, { name: "Rajasthan", code: "08" },
  { name: "Tamil Nadu", code: "33" }, { name: "Telangana", code: "36" }, { name: "Uttar Pradesh", code: "09" },
  { name: "West Bengal", code: "19" }, { name: "Chhattisgarh", code: "22" }, { name: "Uttarakhand", code: "05" },
  { name: "Himachal Pradesh", code: "02" }, { name: "Jharkhand", code: "20" }, { name: "Odisha", code: "21" },
  { name: "Assam", code: "18" }, { name: "Tripura", code: "16" },
];

interface VoucherItem {
  itemId?: number;
  itemName: string;
  hsnCode: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  rateIncludesGst: boolean;
  discount: number;
  discountType: "percent" | "amount";
  taxRateId?: number;
  taxRate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  customFields?: Record<string, any>;
}

function calcItem(item: VoucherItem, isInterState: boolean): VoucherItem {
  // If rate includes GST, back-calculate rate before GST
  const baseRate = item.rateIncludesGst && item.taxRate > 0
    ? item.rate / (1 + item.taxRate / 100)
    : item.rate;

  const gross = item.quantity * baseRate;
  const discount = item.discountType === "percent" ? gross * (item.discount / 100) : item.discount;
  const taxable = gross - discount;
  const cgst = isInterState ? 0 : taxable * (item.taxRate / 2 / 100);
  const sgst = isInterState ? 0 : taxable * (item.taxRate / 2 / 100);
  const igst = isInterState ? taxable * (item.taxRate / 100) : 0;
  return { ...item, taxableAmount: taxable, cgst, sgst, igst, total: taxable + cgst + sgst + igst };
}

function emptyItem(): VoucherItem {
  return { itemName: "", hsnCode: "", description: "", quantity: 1, unit: "PCS", rate: 0, rateIncludesGst: false, discount: 0, discountType: "percent", taxRate: 0, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
}

interface Props {
  voucherType: "sales/invoices" | "sales/credit-notes" | "purchases/bills" | "purchases/debit-notes";
  title: string;
  listHref: string;
  editId?: number;
  initialData?: any;
}

export default function VoucherForm({ voucherType, title, listHref, editId, initialData }: Props) {
  const [, navigate] = useLocation();
  const [parties, setParties] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [partySearch, setPartySearch] = useState("");
  const [showPartyDrop, setShowPartyDrop] = useState(false);
  const [serialMode, setSerialMode] = useState<"auto" | "manual">("auto");

  const [form, setForm] = useState({
    date: fmt.today(),
    voucherNumber: "",
    partyId: "",
    partyName: "",
    billingAddress: "",
    useShippingAddress: false,
    shippingAddress: "",
    placeOfSupply: "",
    transportCharges: 0,
    roundOff: 0,
    notes: "",
    termsAndConditions: "",
    status: "posted",
  });
  const [lineItems, setLineItems] = useState<VoucherItem[]>([emptyItem()]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set([0]));
  const [isInterState, setIsInterState] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const partyType = voucherType.startsWith("sales") ? "customer" : "supplier";
    Promise.all([
      api.get<any>(`/parties?type=${partyType}&limit=200`),
      api.get<any>("/items?limit=200"),
      api.get<any>("/masters/tax-rates"),
      api.get<any>("/masters/units"),
      api.get<any>("/businesses/current"),
    ]).then(([p, it, t, u, biz]) => {
      setParties(p.data || []);
      setItems(it.data || []);
      setTaxRates(t.data || []);
      setUnits(u.data || []);
      if (biz.serialNumberMode === "manual") setSerialMode("manual");
    }).catch(console.error);
  }, []);

  // Populate from initialData if editing
  useEffect(() => {
    if (initialData) {
      setForm(f => ({
        ...f,
        date: initialData.date || fmt.today(),
        voucherNumber: initialData.voucherNumber || "",
        partyId: String(initialData.partyId || ""),
        partyName: initialData.partyName || "",
        billingAddress: initialData.billingAddress || "",
        useShippingAddress: initialData.useShippingAddress || false,
        shippingAddress: initialData.shippingAddress || "",
        placeOfSupply: initialData.placeOfSupply || "",
        transportCharges: Number(initialData.transportCharges || 0),
        roundOff: Number(initialData.roundOff || 0),
        notes: initialData.notes || "",
        termsAndConditions: initialData.termsAndConditions || "",
        status: initialData.status || "posted",
      }));
      setPartySearch(initialData.partyName || "");
      setIsInterState(initialData.isInterState || false);
      if (initialData.items?.length) {
        const populated = initialData.items.map((i: any) => ({
          itemId: i.itemId,
          itemName: i.itemName,
          hsnCode: i.hsnCode || "",
          description: i.description || "",
          quantity: Number(i.quantity),
          unit: i.unit || "PCS",
          rate: Number(i.rate),
          rateIncludesGst: false,
          discount: Number(i.discount || 0),
          discountType: i.discountType || "percent",
          taxRateId: i.taxRateId,
          taxRate: Number(i.taxRate || 0),
          taxableAmount: Number(i.taxableAmount || 0),
          cgst: Number(i.cgst || 0),
          sgst: Number(i.sgst || 0),
          igst: Number(i.igst || 0),
          total: Number(i.total || 0),
        }));
        setLineItems(populated);
        setSelectedItems(new Set(populated.map((_: any, i: number) => i)));
      }
    }
  }, [initialData]);

  const selectParty = (party: any) => {
    setForm(f => ({ ...f, partyId: String(party.id), partyName: party.name, billingAddress: [party.address, party.city, party.state, party.pincode].filter(Boolean).join(", "), placeOfSupply: party.stateCode || "" }));
    setPartySearch(party.name);
    setShowPartyDrop(false);
    api.get<any>("/businesses/current").then(b => {
      setIsInterState(!!(party.stateCode && b.stateCode && party.stateCode !== b.stateCode));
    }).catch(() => {});
  };

  const updateItem = (idx: number, field: keyof VoucherItem, value: any) => {
    setLineItems(prev => {
      const next = [...prev];
      const updated = { ...next[idx], [field]: value };
      if (field === "itemId") {
        const found = items.find(i => i.id === Number(value));
        if (found) {
          updated.itemName = found.name;
          updated.hsnCode = found.hsnCode || "";
          updated.rate = Number(found.salePrice || found.purchasePrice || 0);
          updated.taxRateId = found.taxRateId;
          updated.unit = found.unitName || "PCS";
          const tr = taxRates.find(t => t.id === found.taxRateId);
          if (tr) updated.taxRate = Number(tr.rate);
        }
      }
      if (field === "taxRateId") {
        const tr = taxRates.find(t => t.id === Number(value));
        if (tr) updated.taxRate = Number(tr.rate);
      }
      next[idx] = calcItem(updated, isInterState);
      return next;
    });
  };

  useEffect(() => {
    setLineItems(prev => prev.map(i => calcItem(i, isInterState)));
  }, [isInterState]);

  const addRow = () => {
    const newIdx = lineItems.length;
    setLineItems(prev => [...prev, emptyItem()]);
    setSelectedItems(prev => new Set([...prev, newIdx]));
  };

  const removeRow = (idx: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
    setSelectedItems(prev => {
      const next = new Set<number>();
      prev.forEach(i => { if (i < idx) next.add(i); else if (i > idx) next.add(i - 1); });
      return next;
    });
  };

  const toggleItem = (idx: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const activeItems = lineItems.filter((_, idx) => selectedItems.has(idx));
  const subTotal = activeItems.reduce((s, i) => {
    const baseRate = i.rateIncludesGst && i.taxRate > 0 ? i.rate / (1 + i.taxRate / 100) : i.rate;
    return s + i.quantity * baseRate;
  }, 0);
  const totalDiscount = activeItems.reduce((s, i) => {
    const baseRate = i.rateIncludesGst && i.taxRate > 0 ? i.rate / (1 + i.taxRate / 100) : i.rate;
    return s + (i.discountType === "percent" ? i.quantity * baseRate * i.discount / 100 : i.discount);
  }, 0);
  const taxableAmount = activeItems.reduce((s, i) => s + i.taxableAmount, 0);
  const totalCgst = activeItems.reduce((s, i) => s + i.cgst, 0);
  const totalSgst = activeItems.reduce((s, i) => s + i.sgst, 0);
  const totalIgst = activeItems.reduce((s, i) => s + i.igst, 0);
  const totalTax = totalCgst + totalSgst + totalIgst;
  const grandTotal = taxableAmount + totalTax + (form.transportCharges || 0) + (form.roundOff || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partyId) { setError("Please select a party"); return; }
    if (activeItems.length === 0) { setError("Please add at least one item"); return; }
    setLoading(true); setError("");
    try {
      const itemsToSend = activeItems.map(i => ({
        ...i, quantity: Number(i.quantity), rate: Number(i.rate),
        discount: Number(i.discount), taxRate: Number(i.taxRate),
      }));
      const payload: any = {
        ...form, partyId: Number(form.partyId),
        items: itemsToSend,
        transportCharges: Number(form.transportCharges),
        roundOff: Number(form.roundOff),
      };
      if (serialMode === "manual" && form.voucherNumber) {
        payload.voucherNumber = form.voucherNumber;
      }
      if (editId) {
        await api.patch(`/${voucherType}/${editId}`, payload);
      } else {
        await api.post(`/${voucherType}`, payload);
      }
      navigate(listHref);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full";
  const filteredParties = parties.filter(p => p.name?.toLowerCase().includes(partySearch.toLowerCase())).slice(0, 20);

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{editId ? "Edit" : "New"} {title}</h1>
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(listHref)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {editId ? "Update" : "Save"} {title}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 gap-4">
        {/* Serial Number */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">Voucher Number</label>
            <button type="button" onClick={() => setSerialMode(m => m === "auto" ? "manual" : "auto")}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
              {serialMode === "auto" ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
              {serialMode === "auto" ? "Auto" : "Manual"}
            </button>
          </div>
          {serialMode === "auto" ? (
            <input className={inputCls + " bg-gray-50 text-gray-400"} placeholder="Auto-generated" readOnly />
          ) : (
            <input className={inputCls} value={form.voucherNumber} onChange={e => setForm(f => ({ ...f, voucherNumber: e.target.value }))} placeholder="Enter number manually" />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
          <input type="date" className={inputCls} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Party *</label>
          <div className="relative">
            <input className={inputCls} value={partySearch} onChange={e => { setPartySearch(e.target.value); setShowPartyDrop(true); }} onFocus={() => setShowPartyDrop(true)} placeholder="Search party..." />
            {showPartyDrop && filteredParties.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredParties.map(p => (
                  <div key={p.id} onClick={() => selectParty(p)} className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer text-sm">
                    <div className="font-medium">{p.name}</div>
                    {p.gstin && <div className="text-xs text-gray-400 font-mono">{p.gstin}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Place of Supply</label>
          <select className={inputCls} value={form.placeOfSupply} onChange={e => setForm(f => ({ ...f, placeOfSupply: e.target.value }))}>
            <option value="">Select State</option>
            {INDIAN_STATES.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
          </select>
          <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={isInterState} onChange={e => setIsInterState(e.target.checked)} className="rounded" />
            Inter-state supply (IGST)
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
          <textarea className={inputCls} rows={2} value={form.billingAddress} onChange={e => setForm(f => ({ ...f, billingAddress: e.target.value }))} />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mb-2">
            <input type="checkbox" checked={form.useShippingAddress} onChange={e => setForm(f => ({ ...f, useShippingAddress: e.target.checked }))} className="rounded" />
            Different shipping address
          </label>
          {form.useShippingAddress && (
            <textarea className={inputCls} rows={2} value={form.shippingAddress} onChange={e => setForm(f => ({ ...f, shippingAddress: e.target.value }))} placeholder="Shipping address..." />
          )}
        </div>
      </div>

      {/* Items table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">Items</h3>
          <span className="text-xs text-gray-400">✓ = Include · GST Inc. = Rate includes GST</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs">
              <tr>
                <th className="px-3 py-2.5 w-8">✓</th>
                <th className="px-3 py-2.5 text-left min-w-40">Item</th>
                <th className="px-3 py-2.5 text-left w-24">HSN</th>
                <th className="px-3 py-2.5 text-right w-20">Qty</th>
                <th className="px-3 py-2.5 text-left w-20">Unit</th>
                <th className="px-3 py-2.5 text-right w-28">Rate</th>
                <th className="px-3 py-2.5 text-right w-24">Discount</th>
                <th className="px-3 py-2.5 text-center w-28">Tax</th>
                <th className="px-3 py-2.5 text-right w-24">Taxable</th>
                <th className="px-3 py-2.5 text-right w-24">Tax Amt</th>
                <th className="px-3 py-2.5 text-right w-24">Total</th>
                <th className="px-3 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lineItems.map((item, idx) => {
                const selected = selectedItems.has(idx);
                return (
                  <tr key={idx} className={`${selected ? "" : "opacity-40 bg-gray-50"}`}>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={selected} onChange={() => toggleItem(idx)} className="w-4 h-4 rounded text-blue-600" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select className="border border-gray-200 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500 mb-1"
                        value={item.itemId || ""}
                        onChange={e => updateItem(idx, "itemId" as any, e.target.value)}>
                        <option value="">-- Select Item --</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                      <input className="border border-gray-200 rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Or type item name" value={item.itemName}
                        onChange={e => updateItem(idx, "itemName", e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className="border border-gray-200 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={item.hsnCode} onChange={e => updateItem(idx, "hsnCode", e.target.value)} placeholder="HSN" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min="0" step="0.001" className="border border-gray-200 rounded px-2 py-1.5 text-sm w-full text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={item.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value))} />
                    </td>
                    <td className="px-2 py-1.5">
                      <select className="border border-gray-200 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)}>
                        {units.map(u => <option key={u.id} value={u.symbol}>{u.symbol}</option>)}
                        <option value={item.unit}>{item.unit}</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min="0" step="0.01" className="border border-gray-200 rounded px-2 py-1.5 text-sm w-full text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={item.rate} onChange={e => updateItem(idx, "rate", Number(e.target.value))} />
                      <label className="flex items-center gap-1 mt-0.5 text-xs text-gray-500 cursor-pointer">
                        <input type="checkbox" checked={item.rateIncludesGst} onChange={e => updateItem(idx, "rateIncludesGst", e.target.checked)} className="rounded" />
                        GST Inc.
                        {item.rateIncludesGst && item.taxRate > 0 && (
                          <span className="text-blue-600 ml-1">
                            (Base: {fmt.number(item.rate / (1 + item.taxRate / 100))})
                          </span>
                        )}
                      </label>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <input type="number" min="0" step="0.01" className="border border-gray-200 rounded px-2 py-1.5 text-sm w-16 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={item.discount} onChange={e => updateItem(idx, "discount", Number(e.target.value))} />
                        <select className="border border-gray-200 rounded px-1 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={item.discountType} onChange={e => updateItem(idx, "discountType", e.target.value)}>
                          <option value="percent">%</option>
                          <option value="amount">₹</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <select className="border border-gray-200 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={item.taxRateId || ""}
                        onChange={e => updateItem(idx, "taxRateId" as any, e.target.value ? Number(e.target.value) : undefined)}>
                        <option value="">None</option>
                        {taxRates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs text-gray-600">{fmt.number(item.taxableAmount)}</td>
                    <td className="px-2 py-1.5 text-right text-xs">
                      {isInterState
                        ? <span className="text-orange-600">IGST: {fmt.number(item.igst)}</span>
                        : <span className="text-blue-600">{fmt.number(item.cgst + item.sgst)}</span>
                      }
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-gray-900">{fmt.number(item.total)}</td>
                    <td className="px-2 py-1.5">
                      <button type="button" onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100">
          <button type="button" onClick={addRow} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <Plus className="w-4 h-4" /> Add Item Row
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-5">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea className={inputCls + " bg-white"} rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes for customer..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
            <textarea className={inputCls + " bg-white"} rows={2} value={form.termsAndConditions} onChange={e => setForm(f => ({ ...f, termsAndConditions: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select className={inputCls + " bg-white"} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="draft">Draft</option>
              <option value="posted">Posted</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-600">Sub Total</span><span className="font-medium">{fmt.currency(subTotal)}</span></div>
          {totalDiscount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{fmt.currency(totalDiscount)}</span></div>}
          <div className="flex justify-between"><span className="text-gray-600">Taxable Amount</span><span>{fmt.currency(taxableAmount)}</span></div>
          {!isInterState && totalCgst > 0 && (
            <>
              <div className="flex justify-between text-blue-600"><span>CGST</span><span>{fmt.currency(totalCgst)}</span></div>
              <div className="flex justify-between text-blue-600"><span>SGST</span><span>{fmt.currency(totalSgst)}</span></div>
            </>
          )}
          {isInterState && totalIgst > 0 && <div className="flex justify-between text-orange-600"><span>IGST</span><span>{fmt.currency(totalIgst)}</span></div>}
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Transport Charges</span>
            <input type="number" step="0.01" className="w-28 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={form.transportCharges} onChange={e => setForm(f => ({ ...f, transportCharges: Number(e.target.value) }))} />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Round Off</span>
            <input type="number" step="0.01" className="w-28 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={form.roundOff} onChange={e => setForm(f => ({ ...f, roundOff: Number(e.target.value) }))} />
          </div>
          <div className="border-t pt-2 flex justify-between font-bold text-base">
            <span>Grand Total</span>
            <span className="text-blue-700">{fmt.currency(grandTotal)}</span>
          </div>
        </div>
      </div>
    </form>
  );
}
