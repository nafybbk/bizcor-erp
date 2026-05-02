import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Loader2, Save } from "lucide-react";

const INDIAN_STATES = [
  { name: "Andhra Pradesh", code: "37" }, { name: "Bihar", code: "10" }, { name: "Delhi", code: "07" },
  { name: "Goa", code: "30" }, { name: "Gujarat", code: "24" }, { name: "Haryana", code: "06" },
  { name: "Karnataka", code: "29" }, { name: "Kerala", code: "32" }, { name: "Madhya Pradesh", code: "23" },
  { name: "Maharashtra", code: "27" }, { name: "Punjab", code: "03" }, { name: "Rajasthan", code: "08" },
  { name: "Tamil Nadu", code: "33" }, { name: "Telangana", code: "36" }, { name: "Uttar Pradesh", code: "09" },
  { name: "West Bengal", code: "19" },
];

export default function BusinessSettings() {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get<any>("/businesses/current").then(b => setForm(b)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await api.patch("/businesses/current", form);
    setSaving(false); setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  return (
    <form onSubmit={save} className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Business Settings</h1>
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">Settings saved successfully!</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Basic Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label><input className={inputCls} value={form.name || ""} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label><input className={inputCls} value={form.gstin || ""} onChange={e => setForm((f: any) => ({ ...f, gstin: e.target.value.toUpperCase() }))} maxLength={15} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">PAN</label><input className={inputCls} value={form.pan || ""} onChange={e => setForm((f: any) => ({ ...f, pan: e.target.value.toUpperCase() }))} maxLength={10} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input className={inputCls} value={form.phone || ""} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" className={inputCls} value={form.email || ""} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Address</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label><input className={inputCls} value={form.address || ""} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">City</label><input className={inputCls} value={form.city || ""} onChange={e => setForm((f: any) => ({ ...f, city: e.target.value }))} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <select className={inputCls} value={form.state || ""} onChange={e => {
              const st = INDIAN_STATES.find(s => s.name === e.target.value);
              setForm((f: any) => ({ ...f, state: e.target.value, stateCode: st?.code || "" }));
            }}>
              <option value="">Select State</option>
              {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label><input className={inputCls} value={form.pincode || ""} onChange={e => setForm((f: any) => ({ ...f, pincode: e.target.value }))} maxLength={6} /></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Other</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Financial Year Start (MM-DD)</label>
            <input className={inputCls} value={form.financialYearStart || "04-01"} onChange={e => setForm((f: any) => ({ ...f, financialYearStart: e.target.value }))} placeholder="04-01" />
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Business Code (Read-only)</label>
            <input className={inputCls + " bg-gray-50 text-gray-400 font-mono"} value={form.businessCode || ""} readOnly />
          </div>
        </div>
      </div>
    </form>
  );
}
