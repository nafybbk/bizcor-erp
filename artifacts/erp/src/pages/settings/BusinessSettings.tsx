import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Loader2, Save, Download, Wifi, WifiOff, Database, Upload, X, Ticket, CheckCircle2, FolderOpen, FolderX } from "lucide-react";
import { pickDataFolder, clearDataFolder, getDataFolderName, isFileSystemSupported } from "@/lib/localDataFolder";

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

function OfflineDataFolderSection() {
  const [folderName, setFolderName] = useState<string | null>(getDataFolderName());
  const [picking, setPicking] = useState(false);

  const handlePick = async () => {
    setPicking(true);
    try {
      const result = await pickDataFolder();
      if (result) setFolderName(result.name);
    } finally { setPicking(false); }
  };

  const handleClear = async () => {
    await clearDataFolder();
    setFolderName(null);
  };

  if (!isFileSystemSupported()) {
    return (
      <div className="py-2 text-xs text-gray-400">
        <FolderOpen className="w-3.5 h-3.5 inline mr-1" />
        Offline folder save sirf Chrome/Edge desktop par kaam karta hai. Mobile par drafts localStorage mein save hote hain.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2 border-t border-gray-50 mt-1">
      <div>
        <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <FolderOpen className="w-4 h-4 text-blue-500" /> Offline Data Folder
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {folderName
            ? <span className="text-blue-600 font-medium">📁 {folderName}</span>
            : "Offline drafts is folder mein JSON file ke roop mein save honge"}
        </div>
      </div>
      <div className="flex gap-2">
        {folderName && (
          <button type="button" onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors">
            <FolderX className="w-3.5 h-3.5" /> Hatao
          </button>
        )}
        <button type="button" onClick={handlePick} disabled={picking}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-60 transition-colors">
          {picking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
          {folderName ? "Badlo" : "Folder Chuno"}
        </button>
      </div>
    </div>
  );
}

export default function BusinessSettings() {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ success: boolean; message: string } | null>(null);

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

  const redeemVoucher = async () => {
    if (!voucherCode.trim()) return;
    setRedeemLoading(true);
    setRedeemResult(null);
    try {
      const res = await api.post<any>("/redeem-voucher", { code: voucherCode.trim() });
      setRedeemResult({ success: true, message: res.message });
      setVoucherCode("");
      api.get<any>("/businesses/current").then(b => setForm(b)).catch(() => null);
    } catch (err: any) {
      setRedeemResult({ success: false, message: err.message || "Voucher redeem nahi hua" });
    } finally { setRedeemLoading(false); }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert("Logo 500KB se chhota hona chahiye"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f: any) => ({ ...f, logo: ev.target?.result as string }));
    reader.readAsDataURL(file);
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
            Backup
          </button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">Settings save ho gayi!</div>}

      {/* Logo + Basic Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Firm Identity (Invoice par dikhega)</h3>

        {/* Logo Upload */}
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center bg-gray-50 overflow-hidden relative">
              {form.logo ? (
                <>
                  <img src={form.logo} alt="Logo" className="w-full h-full object-contain p-1" />
                  <button type="button"
                    onClick={() => setForm((f: any) => ({ ...f, logo: null }))}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <div className="text-center text-gray-400">
                  <Upload className="w-6 h-6 mx-auto mb-1" />
                  <span className="text-xs">Logo</span>
                </div>
              )}
            </div>
            <button type="button" onClick={() => logoInputRef.current?.click()}
              className="mt-2 w-24 text-center text-xs text-blue-600 hover:text-blue-700 font-medium">
              {form.logo ? "Logo Badlo" : "Logo Upload"}
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <p className="text-xs text-gray-400 text-center mt-0.5">PNG/JPG, max 500KB</p>
          </div>

          <div className="flex-1 space-y-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Firm / Business Name *</label>
              <input className={inputCls} value={form.name || ""} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                <input className={inputCls} value={form.gstin || ""} onChange={e => setForm((f: any) => ({ ...f, gstin: e.target.value.toUpperCase() }))} maxLength={15} placeholder="22AAAAA0000A1Z5" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">PAN</label>
                <input className={inputCls} value={form.pan || ""} onChange={e => setForm((f: any) => ({ ...f, pan: e.target.value.toUpperCase() }))} maxLength={10} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input className={inputCls} value={form.phone || ""} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className={inputCls} value={form.email || ""} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
            </div>
          </div>
        </div>
      </div>

      {/* Business Type */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Business Type</h3>
        <div>
          <select className={inputCls} value={form.businessType || ""} onChange={e => setForm((f: any) => ({ ...f, businessType: e.target.value }))}>
            {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {form.businessType && TYPE_INFO[form.businessType] && (
            <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              ✓ {TYPE_INFO[form.businessType]}
            </div>
          )}
        </div>
      </div>

      {/* Address */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Business Address</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
            <textarea className={inputCls} rows={2} value={form.address || ""} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input className={inputCls} value={form.city || ""} onChange={e => setForm((f: any) => ({ ...f, city: e.target.value }))} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <select className={inputCls} value={form.state || ""} onChange={e => {
              const st = INDIAN_STATES.find(s => s.name === e.target.value);
              setForm((f: any) => ({ ...f, state: e.target.value, stateCode: st?.code || "" }));
            }}>
              <option value="">Select State</option>
              {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
            <input className={inputCls} value={form.pincode || ""} onChange={e => setForm((f: any) => ({ ...f, pincode: e.target.value }))} maxLength={6} /></div>
        </div>
      </div>

      {/* Bank Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Bank Details (Invoice par print hoga)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
            <input className={inputCls} value={form.bankName || ""} onChange={e => setForm((f: any) => ({ ...f, bankName: e.target.value }))} placeholder="State Bank of India" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
            <input className={inputCls} value={form.bankAccount || ""} onChange={e => setForm((f: any) => ({ ...f, bankAccount: e.target.value }))} placeholder="123456789012" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
            <input className={inputCls} value={form.bankIfsc || ""} onChange={e => setForm((f: any) => ({ ...f, bankIfsc: e.target.value.toUpperCase() }))} placeholder="SBIN0001234" maxLength={11} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
            <input className={inputCls} value={form.bankBranch || ""} onChange={e => setForm((f: any) => ({ ...f, bankBranch: e.target.value }))} placeholder="Main Branch, Mumbai" /></div>
        </div>
      </div>

      {/* Signatory + Footer */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Invoice Footer</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Authorized Signatory Name</label>
            <input className={inputCls} value={form.signatoryName || ""} onChange={e => setForm((f: any) => ({ ...f, signatoryName: e.target.value }))} placeholder="Proprietor ka naam" /></div>
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Invoice Footer / Terms (sab invoices par)</label>
          <textarea className={inputCls} rows={3} value={form.invoiceFooter || ""} onChange={e => setForm((f: any) => ({ ...f, invoiceFooter: e.target.value }))}
            placeholder="e.g. Goods once sold will not be taken back. Subject to Mumbai jurisdiction." /></div>
      </div>

      {/* Invoice Number Series Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2">Invoice Number Series</h3>

        {/* Preview */}
        {(() => {
          const pfx = form.invoicePrefix || "SI";
          const sep = form.numberSeparator ?? "-";
          const series = form.numberSeries ?? 1;
          const digits = Number(form.numberDigits ?? 4);
          const screenNum = `${pfx}${sep}${series}${sep}${String(1).padStart(digits, "0")}`;
          const printNum = `${series}${String(1).padStart(digits, "0")}`;
          return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-4 space-y-3">
              <div>
                <div className="text-xs text-blue-600 font-medium mb-1">Screen par dikhega (document list + form):</div>
                <div className="font-mono text-blue-800 font-bold text-xl tracking-wider">{screenNum}</div>
                <div className="text-xs text-blue-500 mt-1">
                  Credit Note: {(form.creditNotePrefix || "CN")}{sep}{series}{sep}{String(1).padStart(digits, "0")} &nbsp;·&nbsp;
                  Bill: {(form.billPrefix || "PB")}{sep}{series}{sep}{String(1).padStart(digits, "0")} &nbsp;·&nbsp;
                  Debit Note: {(form.debitNotePrefix || "DN")}{sep}{series}{sep}{String(1).padStart(digits, "0")}
                </div>
              </div>
              <div className="border-t border-blue-200 pt-3">
                <div className="text-xs text-orange-600 font-medium mb-1">Print/PDF par dikhega (sirf numbers, koi alphabet/separator nahi):</div>
                <div className="font-mono text-orange-800 font-bold text-xl tracking-wider">{printNum}</div>
                <div className="text-xs text-orange-500 mt-1">= Series ({series}) + Serial ({String(1).padStart(digits, "0")})</div>
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-2 gap-4">
          {/* Series Number — highlighted prominently */}
          <div className="col-span-2 bg-amber-50 border border-amber-300 rounded-xl p-4">
            <label className="block text-sm font-bold text-amber-800 mb-1">
              Series Number <span className="font-normal text-amber-600">(Print mein pehla digit)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number" min="1" max="9"
                className="w-24 border-2 border-amber-400 rounded-lg px-3 py-2 text-lg font-bold text-amber-900 text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={form.numberSeries ?? 1}
                onChange={e => setForm((f: any) => ({ ...f, numberSeries: Number(e.target.value) }))}
              />
              <div className="text-sm text-amber-700">
                <p className="font-medium">Abhi series: <span className="font-mono text-xl">{form.numberSeries ?? 1}</span></p>
                <p className="text-xs text-amber-600 mt-0.5">Naya financial year ya book change par badlein — 1 se 9 tak</p>
              </div>
            </div>
            <div className="mt-2 px-3 py-2 bg-amber-100 rounded-lg text-xs text-amber-700">
              ⚠️ Series badalne par naye documents ka number change ho jayega. Purane documents waise hi rahenge.
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
            <input className={inputCls} value={form.invoicePrefix || "SI"} onChange={e => setForm((f: any) => ({ ...f, invoicePrefix: e.target.value.toUpperCase() }))} placeholder="SI" maxLength={10} />
            <p className="text-xs text-gray-400 mt-1">Sales Invoice ke liye</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Credit Note Prefix</label>
            <input className={inputCls} value={form.creditNotePrefix || "CN"} onChange={e => setForm((f: any) => ({ ...f, creditNotePrefix: e.target.value.toUpperCase() }))} placeholder="CN" maxLength={10} />
            <p className="text-xs text-gray-400 mt-1">Sales Return ke liye</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Bill Prefix</label>
            <input className={inputCls} value={form.billPrefix || "PB"} onChange={e => setForm((f: any) => ({ ...f, billPrefix: e.target.value.toUpperCase() }))} placeholder="PB" maxLength={10} />
            <p className="text-xs text-gray-400 mt-1">Purchase Bill ke liye</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Debit Note Prefix</label>
            <input className={inputCls} value={form.debitNotePrefix || "DN"} onChange={e => setForm((f: any) => ({ ...f, debitNotePrefix: e.target.value.toUpperCase() }))} placeholder="DN" maxLength={10} />
            <p className="text-xs text-gray-400 mt-1">Purchase Return ke liye</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Separator</label>
            <select className={inputCls} value={form.numberSeparator ?? "-"} onChange={e => setForm((f: any) => ({ ...f, numberSeparator: e.target.value }))}>
              <option value="-">Hyphen  (SI-1-0001)</option>
              <option value="/">Slash  (SI/1/0001)</option>
              <option value=".">Dot  (SI.1.0001)</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Prefix, series aur number ke beech</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number Digits (zero padding)</label>
            <select className={inputCls} value={String(form.numberDigits ?? 4)} onChange={e => setForm((f: any) => ({ ...f, numberDigits: Number(e.target.value) }))}>
              <option value="3">3 digits — 001, 002 ... 999</option>
              <option value="4">4 digits — 0001, 0002 ... 9999</option>
              <option value="5">5 digits — 00001, 00002 ... 99999</option>
              <option value="6">6 digits — 000001, 000002 ...</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Serial number mein kitne zero</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number Mode</label>
            <select className={inputCls} value={form.serialNumberMode || "auto"} onChange={e => setForm((f: any) => ({ ...f, serialNumberMode: e.target.value }))}>
              <option value="auto">Auto (system generate karta hai)</option>
              <option value="manual">Manual (khud likho)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Financial Year Start (MM-DD)</label>
            <input className={inputCls} value={form.financialYearStart || "04-01"} onChange={e => setForm((f: any) => ({ ...f, financialYearStart: e.target.value }))} placeholder="04-01" />
          </div>
        </div>

        {/* Doc Start Numbers */}
        <div className="border-t border-gray-100 pt-4">
          <div className="text-sm font-semibold text-gray-700 mb-1">Document Start Numbers</div>
          <p className="text-xs text-gray-400 mb-3">Naye financial year ya fresh start par yahan se numbering shuru hogi. Default 1 hai.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sales Invoice shuru hoga</label>
              <input type="number" min="1" className={inputCls} value={form.siStartNumber ?? 1}
                onChange={e => setForm((f: any) => ({ ...f, siStartNumber: Number(e.target.value) }))} />
              <p className="text-xs text-gray-400 mt-0.5">SI-1-<span className="font-mono font-bold">{String(form.siStartNumber ?? 1).padStart(Number(form.numberDigits ?? 4), "0")}</span> se</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Credit Note shuru hoga</label>
              <input type="number" min="1" className={inputCls} value={form.cnStartNumber ?? 1}
                onChange={e => setForm((f: any) => ({ ...f, cnStartNumber: Number(e.target.value) }))} />
              <p className="text-xs text-gray-400 mt-0.5">CN-1-<span className="font-mono font-bold">{String(form.cnStartNumber ?? 1).padStart(Number(form.numberDigits ?? 4), "0")}</span> se</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Bill shuru hoga</label>
              <input type="number" min="1" className={inputCls} value={form.pbStartNumber ?? 1}
                onChange={e => setForm((f: any) => ({ ...f, pbStartNumber: Number(e.target.value) }))} />
              <p className="text-xs text-gray-400 mt-0.5">PB-1-<span className="font-mono font-bold">{String(form.pbStartNumber ?? 1).padStart(Number(form.numberDigits ?? 4), "0")}</span> se</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Debit Note shuru hoga</label>
              <input type="number" min="1" className={inputCls} value={form.dnStartNumber ?? 1}
                onChange={e => setForm((f: any) => ({ ...f, dnStartNumber: Number(e.target.value) }))} />
              <p className="text-xs text-gray-400 mt-0.5">DN-1-<span className="font-mono font-bold">{String(form.dnStartNumber ?? 1).padStart(Number(form.numberDigits ?? 4), "0")}</span> se</p>
            </div>
          </div>
          <div className="mt-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
            ⚠️ Start number change karne ke baad jo bhi naye documents banenge unka number wahan se start hoga. Purane documents ka number nahi badlega.
          </div>
        </div>
      </div>

      {/* Connection */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2 flex items-center gap-2">
          <Database className="w-4 h-4" /> Connection & Backup
        </h3>
        <div className="flex items-center justify-between py-2 border-b border-gray-50">
          <div>
            <div className="text-sm font-medium text-gray-700">Server Connection</div>
            <div className={`text-xs mt-0.5 ${isOnline ? "text-green-600" : "text-red-500"}`}>
              {isOnline ? "● Connected" : "● Unreachable"}
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${isOnline ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {isOnline ? "Online" : "Offline"}
          </div>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="text-sm font-medium text-gray-700">Poora Data Backup (JSON)</div>
            <div className="text-xs text-gray-500 mt-0.5">Parties, Items, Invoices, Payments sab</div>
          </div>
          <button type="button" onClick={downloadBackup} disabled={backupLoading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {backupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download
          </button>
        </div>

        {/* Offline Data Folder */}
        <OfflineDataFolderSection />

        <div><label className="block text-sm font-medium text-gray-700 mb-1">Business Code (Read-only)</label>
          <input className={inputCls + " bg-gray-50 text-gray-500 font-mono tracking-widest"} value={form.businessCode || ""} readOnly /></div>
      </div>

      {/* Activate License */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-5 space-y-4">
        <h3 className="font-semibold text-indigo-800 text-sm border-b border-indigo-200 pb-2 flex items-center gap-2">
          <Ticket className="w-4 h-4" /> License Activate Karein
        </h3>
        {form.planId && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Plan active hai{form.planExpiresAt ? ` · Expires: ${new Date(form.planExpiresAt).toLocaleDateString("en-IN")}` : ""}</span>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-indigo-700 mb-1">Voucher Code</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 border border-indigo-300 rounded-lg px-3 py-2 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. BAS-000001 ya PRO-000001"
              value={voucherCode}
              onChange={e => setVoucherCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && redeemVoucher()}
            />
            <button type="button" onClick={redeemVoucher} disabled={redeemLoading || !voucherCode.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
              {redeemLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
              Activate
            </button>
          </div>
          <p className="text-xs text-indigo-500 mt-1">Vendor se mila hua license code yahan daalo</p>
        </div>
        {redeemResult && (
          <div className={`flex items-start gap-2 text-sm px-3 py-2.5 rounded-lg border ${redeemResult.success ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600"}`}>
            {redeemResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <X className="w-4 h-4 shrink-0 mt-0.5" />}
            {redeemResult.message}
          </div>
        )}
      </div>
    </form>
  );
}
