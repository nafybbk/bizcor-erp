import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { api, fmt } from "@/lib/api";
import { Loader2 } from "lucide-react";
import PartySelect from "@/components/PartySelect";

interface Props {
  type: "receipt" | "payment";
  editId?: number;
  initialData?: any;
}

export default function PaymentCreate({ type, editId, initialData }: Props) {
  const [, navigate] = useLocation();
  const [parties, setParties] = useState<any[]>([]);
  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [partySearch, setPartySearch] = useState(initialData?.partyName || "");
  const [allocations, setAllocations] = useState<Array<{ voucherId: number; allocatedAmount: number }>>(
    initialData?.allocations?.map((a: any) => ({ voucherId: a.voucherId, allocatedAmount: a.allocatedAmount })) || []
  );
  const amountDrivenByAlloc = useRef(false);

  const [form, setForm] = useState({
    date: initialData?.date || fmt.today(),
    partyId: initialData?.partyId ? String(initialData.partyId) : "",
    partyName: initialData?.partyName || "",
    amount: initialData?.amount ? String(initialData.amount) : "",
    paymentMode: (initialData?.paymentMode || "cash") as "cash" | "bank" | "cheque" | "upi" | "other",
    accountId: initialData?.accountId ? String(initialData.accountId) : "",
    referenceNumber: initialData?.referenceNumber || "",
    notes: initialData?.notes || "",
    isOnAccount: initialData?.isOnAccount || false,
  });

  const partyType = type === "receipt" ? "customer" : "supplier";
  const listHref = type === "receipt" ? "/payments/receipts" : "/payments/payments";

  const searchParties = useCallback(async (q: string) => {
    const r = await api.get<any>(`/parties?type=${partyType}&search=${encodeURIComponent(q)}&limit=500`);
    setParties(r.data || []);
  }, [partyType]);

  useEffect(() => {
    searchParties("");
    api.get<any>("/cash-bank/accounts").then(r => {
      const list = Array.isArray(r) ? r : (r.data || []);
      setAccounts(list);
      if (!initialData?.accountId) {
        const def = list.find((a: any) => a.isDefault);
        if (def) setForm(f => ({ ...f, accountId: String(def.id) }));
      }
    }).catch(console.error);
    if (initialData?.partyId && !initialData?.isOnAccount) {
      const vType = type === "receipt" ? "receivable" : "payable";
      api.get<any>(`/payments/outstanding?partyId=${initialData.partyId}&type=${vType}`)
        .then(data => setOutstanding(data.bills || []))
        .catch(console.error);
    }
  }, []);

  const filteredAccounts = accounts.filter((a: any) =>
    form.paymentMode === "cash" ? a.type === "cash" : a.type === "bank"
  );

  const selectParty = async (party: any) => {
    setForm(f => ({ ...f, partyId: String(party.id), partyName: party.name }));
    setPartySearch(party.name);
    try {
      const vType = type === "receipt" ? "receivable" : "payable";
      const data = await api.get<any>(`/payments/outstanding?partyId=${party.id}&type=${vType}`);
      setOutstanding(data.bills || []);
      setAllocations([]);
    } catch (err: any) {
      console.error("Outstanding bills fetch error:", err?.message || err);
      setOutstanding([]);
      setError(`Outstanding bills load nahi ho sake: ${err?.message || "Server error"}`);
    }
  };

  const paymentAmount = Number(form.amount) || 0;
  const totalAllocated = allocations.reduce((s, a) => s + Number(a.allocatedAmount), 0);
  const remainingToAllocate = Math.max(0, paymentAmount - totalAllocated);
  const overAllocated = totalAllocated > paymentAmount + 0.001;

  const r2 = (n: number) => Math.round(n * 100) / 100;

  const toggleAllocation = (voucherId: number, balanceDue: number) => {
    setAllocations(prev => {
      const exists = prev.find(a => a.voucherId === voucherId);
      if (exists) return prev.filter(a => a.voucherId !== voucherId);
      const currentTotal = r2(prev.reduce((s, a) => s + Number(a.allocatedAmount), 0));
      const remaining = r2(Math.max(0, paymentAmount - currentTotal));
      const allocAmt = r2(Math.min(balanceDue, remaining));
      const newAllocs = [...prev, { voucherId, allocatedAmount: allocAmt }];
      if (paymentAmount === 0) {
        amountDrivenByAlloc.current = true;
        setForm(f => ({ ...f, amount: String(r2(newAllocs.reduce((s, a) => s + a.allocatedAmount, 0))) }));
      }
      return newAllocs;
    });
  };

  const updateAllocAmount = (voucherId: number, amount: number) => {
    const bill = outstanding.find(b => b.voucherId === voucherId);
    const maxForBill = bill ? bill.balanceDue : amount;
    const capped = r2(Math.min(amount, maxForBill));
    setAllocations(prev => prev.map(a => a.voucherId === voucherId ? { ...a, allocatedAmount: capped } : a));
  };

  const autoFillAllocations = () => {
    if (paymentAmount <= 0 || outstanding.length === 0) return;
    let remaining = paymentAmount;
    const newAllocs: Array<{ voucherId: number; allocatedAmount: number }> = [];
    for (const bill of outstanding) {
      if (remaining <= 0.001) break;
      const amt = r2(Math.min(bill.balanceDue, remaining));
      newAllocs.push({ voucherId: bill.voucherId, allocatedAmount: amt });
      remaining = r2(remaining - amt);
    }
    setAllocations(newAllocs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.isOnAccount && overAllocated) {
      setError(`Allocated amount (${fmt.currency(totalAllocated)}) exceeds payment amount (${fmt.currency(paymentAmount)}). Please correct allocations.`);
      return;
    }
    setLoading(true);
    try {
      const safeAllocations = allocations.map(a => ({
        voucherId: a.voucherId,
        allocatedAmount: Math.min(a.allocatedAmount, paymentAmount),
      }));
      const payload = { type, ...form, partyId: Number(form.partyId), amount: paymentAmount, accountId: form.accountId ? Number(form.accountId) : null, allocations: form.isOnAccount ? [] : safeAllocations };
      if (editId) {
        await api.patch(`/payments/${editId}`, payload);
      } else {
        await api.post("/payments", payload);
      }
      navigate(listHref);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full";
  const title = type === "receipt" ? "Receipt" : "Payment";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{editId ? "Edit" : "New"} {title}</h1>
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(listHref)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={loading || overAllocated} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} {editId ? "Update" : "Save"} {title}
          </button>
        </div>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Party *</label>
          <PartySelect
            parties={parties}
            value={partySearch}
            onSelect={p => { selectParty(p); }}
            onSearch={searchParties}
            placeholder={`Search ${partyType}...`}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" className={inputCls} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
            <select className={inputCls} value={form.paymentMode} onChange={e => {
              const mode = e.target.value as any;
              const newFiltered = accounts.filter((a: any) => mode === "cash" ? a.type === "cash" : a.type === "bank");
              const def = newFiltered.find((a: any) => a.isDefault) || newFiltered[0];
              setForm(f => ({ ...f, paymentMode: mode, accountId: def ? String(def.id) : "" }));
            }}>
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="upi">UPI</option>
              <option value="other">Other</option>
            </select>
          </div>
          {filteredAccounts.length > 0 && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {form.paymentMode === "cash" ? "💵 Cash Account" : "🏦 Bank Account"}
              </label>
              <select className={inputCls} value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
                <option value="">-- Select Account --</option>
                {filteredAccounts.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.bankName ? ` — ${a.bankName}` : ""}
                  </option>
                ))}
              </select>
              {/* Show sub-fields of selected account */}
              {(() => {
                const sel = filteredAccounts.find((a: any) => String(a.id) === form.accountId);
                if (!sel) return null;
                if (sel.type === "bank" && (sel.bankName || sel.accountNumber || sel.ifscCode)) {
                  return (
                    <div className="flex flex-wrap gap-3 mt-1 px-1">
                      {sel.bankName && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">🏦 {sel.bankName}</span>}
                      {sel.accountNumber && <span className="text-xs text-gray-600 bg-gray-50 px-2 py-0.5 rounded">A/c: {sel.accountNumber}</span>}
                      {sel.ifscCode && <span className="text-xs text-gray-600 bg-gray-50 px-2 py-0.5 rounded">IFSC: {sel.ifscCode}</span>}
                    </div>
                  );
                }
                if (sel.type === "cash") {
                  return <div className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded mt-1 w-fit">💵 Cash Account</div>;
                }
                return null;
              })()}
            </div>
          )}
          {(form.paymentMode !== "cash") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference #</label>
              <input className={inputCls} value={form.referenceNumber} onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))} placeholder="Cheque / UTR no." />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
            <input type="number" min="0" step="0.01" className={inputCls} value={form.amount}
              onFocus={e => e.target.select()}
              onChange={e => {
                setForm(f => ({ ...f, amount: e.target.value }));
                setAllocations([]);
              }} required />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={form.isOnAccount} onChange={e => setForm(f => ({ ...f, isOnAccount: e.target.checked }))} className="rounded" />
          On-account payment (not linked to specific bills)
        </label>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea className={inputCls} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>

      {!form.isOnAccount && outstanding.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm">Outstanding Bills — select to allocate</h3>
            {paymentAmount > 0 && (
              <button type="button" onClick={autoFillAllocations}
                className="text-xs px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">
                Auto-fill oldest first
              </button>
            )}
          </div>
          <div className="space-y-2">
            {outstanding.map(bill => {
              const alloc = allocations.find(a => a.voucherId === bill.voucherId);
              return (
                <div key={bill.voucherId} className={`flex items-center gap-3 p-3 rounded-lg border ${alloc ? "border-blue-200 bg-blue-50" : "border-gray-100"}`}>
                  <input type="checkbox" checked={!!alloc}
                    onChange={() => toggleAllocation(bill.voucherId, bill.balanceDue)}
                    className="w-4 h-4 rounded text-blue-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{bill.voucherNumber} — {fmt.date(bill.date)}</div>
                    <div className="text-xs text-gray-400">Outstanding: {fmt.currency(bill.balanceDue)}</div>
                  </div>
                  {alloc && (
                    <div className="flex flex-col items-end gap-1">
                      <input type="number" min="0" step="0.01" max={bill.balanceDue}
                        className={`w-28 text-right border rounded px-2 py-1 text-sm focus:outline-none ${Number(alloc.allocatedAmount) > bill.balanceDue ? "border-red-400 bg-red-50" : "border-blue-300"}`}
                        value={r2(Number(alloc.allocatedAmount))}
                        onFocus={e => e.target.select()}
                        onChange={e => updateAllocAmount(bill.voucherId, Number(e.target.value))} />
                      {Number(alloc.allocatedAmount) > bill.balanceDue && (
                        <span className="text-xs text-red-500">Max: {fmt.currency(bill.balanceDue)}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {allocations.length > 0 && (
            <div className="mt-3 pt-3 border-t space-y-1">
              <div className="text-sm flex justify-between">
                <span className="text-gray-500">Payment Amount</span>
                <span className="font-medium">{fmt.currency(paymentAmount)}</span>
              </div>
              <div className="text-sm flex justify-between">
                <span className="text-gray-500">Total Allocated</span>
                <span className={`font-semibold ${overAllocated ? "text-red-600" : "text-blue-700"}`}>{fmt.currency(totalAllocated)}</span>
              </div>
              {!overAllocated && remainingToAllocate > 0.001 && (
                <div className="text-sm flex justify-between">
                  <span className="text-gray-400">Unallocated (on-account)</span>
                  <span className="text-orange-600">{fmt.currency(remainingToAllocate)}</span>
                </div>
              )}
              {overAllocated && (
                <div className="text-sm text-red-600 font-medium bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                  Allocated ({fmt.currency(totalAllocated)}) &gt; Payment ({fmt.currency(paymentAmount)}) — please reduce allocations
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
