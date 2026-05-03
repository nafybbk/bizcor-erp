import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Loader2, Save, Download, Wifi, WifiOff, Database } from "lucide-react";

const INDIAN_STATES = [
  { name: "Andhra Pradesh", code: "37" }, { name: "Bihar", code: "10" }, { name: "Delhi", code: "07" },
  { name: "Goa", code: "30" }, { name: "Gujarat", code: "24" }, { name: "Haryana", code: "06" },
  { name: "Karnataka", code: "29" }, { name: "Kerala", code: "32" }, { name: "Madhya Pradesh", code: "23" },
  { name: "Maharashtra", code: "27" }, { name: "Punjab", code: "03" }, { name: "Rajasthan", code: "08" },
  { name: "Tamil Nadu", code: "33" }, { name: "Telangana", code: "36" }, { name: "Uttar Pradesh", code: "09" },
  { name: "West Bengal", code: "19" }, { name: "Chhattisgarh", code: "22" }, { name: "Uttarakhand", code: "05" },
  { name: "Himachal Pradesh", code: "02" }, { name: "Jharkhand", code: "20" }, { name: "Odisha", code: "21" },
];

const BUSINESS_TYPES = [
  { value: "", label: "General / Trading" },
  { value: "pharmacy", label: "Pharmacy / Medical Store" },
  { value: "electronics", label: "Electronics / Mobile Shop" },
  { value: "fabric", label: "Fabric / Textile / Wholesale" },
  { value: "restaurant", label: "Restaurant / Hotel / Dhaba" },
  { value: "auto_parts", label: "Auto Parts / Garage" },
  { value: "jewellery", label: "Jewellery / Gold Shop" },
  { value: "construction", label: "Construction / Contractor" },
  { value: "grocery", label: "Grocery / Kirana / FMCG" },
  { value: "hardware", label: "Hardware / Electrical / Plumbing" },
  { value: "books", label: "Books / Stationery" },
  { value: "furniture", label: "Furniture / Wood Works" },
  { value: "chemical", label: "Chemical / Pesticide / Fertilizer" },
  { value: "transport", label: "Transport / Logistics" },
];

const TYPE_INFO: Record<string, string> = {
  pharmacy: "Invoice mein Drug License, Batch No, Expiry Date, MRP fields aayenge",
  electronics: "Invoice mein Serial No, Model No, Brand, Warranty fields aayenge",
  fabric: "Invoice mein Color, Design, Width, Composition fields aayenge",
  restaurant: "Invoice mein Table No, Cover Count, Waiter Name fields aayenge",
  auto_parts: "Invoice mein Vehicle Reg No, Vehicle Model, Part No fields aayenge",
  jewellery: "Invoice mein Hallmark No, Purity, Weight, Making Charges fields aayenge",
  construction: "Invoice mein Project Name, Work Order No, Site fields aayenge",
  grocery: "Invoice mein Batch No, Expiry Date fields aayenge",
  hardware: "Invoice mein Brand, Model No fields aayenge",
};

export default function BusinessSettings() {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [dbMode, setDbMode] = useState<"cloud" | "local">(
    (localStorage.getItem("erp_db_mode") as any) || "cloud"
  );

  useEffect(() => {
    api.get<any>("/businesses/current").then(b => setForm(b)).catch(console.error).finally(() => setLoading(false));
    api.get("/healthz").then(() => setIsOnline(true)).catch(() => setIsOnline(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/businesses/current", form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } finally { setSaving(false); }
  };

  const downloadBackup = async () => {
    setBackupLoading(true);
    try {
      const token = localStorage.getItem("erp_token");
      const res = await fetch(`${import.meta.env.BASE_URL}api/businesses/backup`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${form.businessCode || "business"}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setBackupLoading(false); }
  };

  const toggleDbMode = () => {
    const newMode = dbMode === "cloud" ? "local" : "cloud";
    setDbMode(newMode);
    localStorage.setItem("erp_db_mode", newMode);
  };

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  return (
    <form onSubmit={save} className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Business Settings</h1>
        <div className="flex gap-3">
          <button type="button" onClick={downloadBackup} disabled={backupLoading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {backupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Backup Data
          </button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">Settings saved successfully!</div>}

      {/* Basic Info */}
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

      {/* Business Type */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Business Type & Industry</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
          <select className={inputCls} value={form.businessType || ""} onChange={e => setForm((f: any) => ({ ...f, businessType: e.target.value }))}>
            {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {form.businessType && TYPE_INFO[form.businessType] && (
            <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              ✓ {TYPE_INFO[form.businessType]}
            </div>
          )}
          {!form.businessType && (
            <p className="text-xs text-gray-400 mt-1">Apna business type choose karo — invoice mein relevant fields automatically aayenge</p>
          )}
        </div>
      </div>

      {/* Address */}
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

      {/* Invoice Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Invoice Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label><input className={inputCls} value={form.invoicePrefix || "SI"} onChange={e => setForm((f: any) => ({ ...f, invoicePrefix: e.target.value }))} placeholder="SI" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Credit Note Prefix</label><input className={inputCls} value={form.creditNotePrefix || "CN"} onChange={e => setForm((f: any) => ({ ...f, creditNotePrefix: e.target.value }))} placeholder="CN" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Bill Prefix</label><input className={inputCls} value={form.billPrefix || "PB"} onChange={e => setForm((f: any) => ({ ...f, billPrefix: e.target.value }))} placeholder="PB" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Debit Note Prefix</label><input className={inputCls} value={form.debitNotePrefix || "DN"} onChange={e => setForm((f: any) => ({ ...f, debitNotePrefix: e.target.value }))} placeholder="DN" /></div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number Mode</label>
            <select className={inputCls} value={form.serialNumberMode || "auto"} onChange={e => setForm((f: any) => ({ ...f, serialNumberMode: e.target.value }))}>
              <option value="auto">Auto (system generates)</option>
              <option value="manual">Manual (enter manually)</option>
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Financial Year Start (MM-DD)</label>
            <input className={inputCls} value={form.financialYearStart || "04-01"} onChange={e => setForm((f: any) => ({ ...f, financialYearStart: e.target.value }))} placeholder="04-01" />
          </div>
        </div>
      </div>

      {/* Connection & Backup */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2 flex items-center gap-2">
          <Database className="w-4 h-4" /> Connection & Backup
        </h3>
        <div className="flex items-center justify-between py-3 border-b border-gray-50">
          <div>
            <div className="text-sm font-medium text-gray-700">Server Connection</div>
            <div className={`text-xs mt-0.5 ${isOnline ? "text-green-600" : "text-red-500"}`}>
              {isOnline ? "● Connected to server" : "● Server unreachable"}
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${isOnline ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {isOnline ? "Online" : "Offline"}
          </div>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-gray-50">
          <div>
            <div className="text-sm font-medium text-gray-700">Offline Support</div>
            <div className="text-xs text-gray-500 mt-0.5">App shell cached — internet se hi data save/load hota hai</div>
          </div>
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full">Data: Cloud Only</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <div className="text-sm font-medium text-gray-700">Download Business Backup</div>
            <div className="text-xs text-gray-500 mt-0.5">Export all your data as JSON (parties, items, invoices, payments)</div>
          </div>
          <button type="button" onClick={downloadBackup} disabled={backupLoading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {backupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download
          </button>
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Business Code (Read-only)</label>
          <input className={inputCls + " bg-gray-50 text-gray-400 font-mono"} value={form.businessCode || ""} readOnly />
        </div>
      </div>
    </form>
  );
}
