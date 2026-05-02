import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { api, fmt } from "@/lib/api";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface Props { type: "receipt" | "payment" }

export default function PaymentCreate({ type }: Props) {
  const [, navigate] = useLocation();
  const [parties, setParties] = useState<any[]>([]);
  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [partySearch, setPartySearch] = useState("");
  const [showPartyDrop, setShowPartyDrop] = useState(false);
  const [allocations, setAllocations] = useState<Array<{ voucherId: number; allocatedAmount: number }>>([]);

  const [form, setForm] = useState({
    date: fmt.today(),
    partyId: "",
    partyName: "",
    amount: "",
    paymentMode: "cash" as "cash" | "bank" | "cheque" | "upi" | "other",
    referenceNumber: "",
    notes: "",
    isOnAccount: false,
  });

  const partyType = type === "receipt" ? "customer" : "supplier";
  const listHref = type === "receipt" ? "/payments/receipts" : "/payments/payments";

  useEffect(() => {
    api.get<any>(`/parties?type=${partyType}&limit=200`).then(r => setParties(r.data || [])).catch(console.error);
  }, []);

  const selectParty = async (party: any) => {
    setForm(f => ({ ...f, partyId: String(party.id), partyName: party.name }));
    setPartySearch(party.name);
    setShowPartyDrop(false);
    try {
      const vType = type === "receipt" ? "receivable" : "payable";
      const data = await api.get<any>(`/payments/outstanding?partyId=${party.id}&type=${vType}`);
      setOutstanding(data.bills || []);
      setAllocations([]);
    } catch {}
  };

  const toggleAllocation = (voucherId: number, balanceDue: number) => {
    setAllocations(prev => {
      const exists = prev.find(a => a.voucherId === voucherId);
      if (exists) return prev.filter(a => a.voucherId !== voucherId);
      return [...prev, { voucherId, allocatedAmount: balanceDue }];
    });
  };

  const updateAllocAmount = (voucherId: number, amount: number) => {
    setAllocations(prev => prev.map(a => a.voucherId === voucherId ? { ...a, allocatedAmount: amount } : a));
  };

  const totalAllocated = allocations.reduce((s, a) => s + Number(a.allocatedAmount), 0);

  useEffect(() => {
    if (!form.isOnAccount) {
      setForm(f => ({ ...f, amount: String(totalAllocated) }));
    }
  }, [totalAllocated, form.isOnAccount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/payments", {
        type, ...form, partyId: Number(form.partyId), amount: Number(form.amount),
        allocations: form.isOnAccount ? [] : allocations,
      });
      navigate(listHref);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full";
  const filteredParties = parties.filter(p => p.name?.toLowerCase().includes(partySearch.toLowerCase())).slice(0, 20);
  const title = type === "receipt" ? "Receipt" : "Payment";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">New {title}</h1>
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(listHref)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Save {title}
          </button>
        </div>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Party *</label>
          <input className={inputCls} value={partySearch} onChange={e => { setPartySearch(e.target.value); setShowPartyDrop(true); }} onFocus={() => setShowPartyDrop(true)} placeholder="Search party..." required />
          {showPartyDrop && filteredParties.length > 0 && (
            <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredParties.map(p => (
                <div key={p.id} onClick={() => selectParty(p)} className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer text-sm font-medium">{p.name}</div>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" className={inputCls} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
            <select className={inputCls} value={form.paymentMode} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value as any }))}>
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="upi">UPI</option>
              <option value="other">Other</option>
            </select>
          </div>
          {(form.paymentMode !== "cash") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference #</label>
              <input className={inputCls} value={form.referenceNumber} onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))} placeholder="Cheque / UTR no." />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
            <input type="number" min="0" step="0.01" className={inputCls} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
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
          <h3 className="font-semibold text-gray-800 mb-3 text-sm">Outstanding Bills — select to allocate</h3>
          <div className="space-y-2">
            {outstanding.map(bill => {
              const alloc = allocations.find(a => a.voucherId === bill.voucherId);
              return (
                <div key={bill.voucherId} className={`flex items-center gap-3 p-3 rounded-lg border ${alloc ? "border-blue-200 bg-blue-50" : "border-gray-100"}`}>
                  <input type="checkbox" checked={!!alloc} onChange={() => toggleAllocation(bill.voucherId, bill.balanceDue)} className="w-4 h-4 rounded text-blue-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{bill.voucherNumber} — {fmt.date(bill.date)}</div>
                    <div className="text-xs text-gray-400">Balance: {fmt.currency(bill.balanceDue)}</div>
                  </div>
                  {alloc && (
                    <input type="number" min="0" step="0.01" max={bill.balanceDue}
                      className="w-28 text-right border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none"
                      value={alloc.allocatedAmount}
                      onChange={e => updateAllocAmount(bill.voucherId, Number(e.target.value))} />
                  )}
                </div>
              );
            })}
          </div>
          {allocations.length > 0 && (
            <div className="mt-3 pt-3 border-t text-sm flex justify-between font-semibold">
              <span>Total Allocated</span>
              <span className="text-blue-700">{fmt.currency(totalAllocated)}</span>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
