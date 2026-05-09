import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { Loader2, Save, Upload, X, ArrowLeft, Settings, Building2, Sparkles, ImageIcon } from "lucide-react";
import { BusinessAnimatedLogo } from "@/components/BizCorLogo";

export default function FirmProfile() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [logoTab, setLogoTab] = useState<"default" | "custom">("default");
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<any>("/businesses/current")
      .then(b => {
        setForm(b);
        localStorage.setItem("erp_biz_profile", JSON.stringify(b));
        if (b.logo) setLogoTab("custom");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const logoToSave = logoTab === "custom" ? form.logo : null;
      const updated = await api.patch<any>("/businesses/current", {
        name: form.name, gstin: form.gstin, pan: form.pan,
        phone: form.phone, email: form.email, logo: logoToSave,
        address: form.address, city: form.city, state: form.state, pincode: form.pincode,
        signatoryName: form.signatoryName,
      });
      localStorage.setItem("erp_biz_profile", JSON.stringify(updated));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } finally { setSaving(false); }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert("Logo must be smaller than 500KB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((f: any) => ({ ...f, logo: ev.target?.result as string }));
      setLogoTab("custom");
    };
    reader.readAsDataURL(file);
  };

  const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  );

  const bizName = form?.name || "Business";
  const bizType = form?.businessType || "";

  return (
    <form onSubmit={save} className="max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Firm Profile</h1>
        <div className="flex-1" />
        <button type="button" onClick={() => navigate("/settings/business")}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700">
          <Settings className="w-4 h-4" /> Full Settings
        </button>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
          ✓ Profile saved — will appear on all reports
        </div>
      )}

      {/* ── Logo Card ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600" /> Firm Logo
        </h3>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-5">
          <button
            type="button"
            onClick={() => setLogoTab("default")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              logoTab === "default"
                ? "bg-indigo-600 text-white shadow"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Auto Logo (Default)
          </button>
          <button
            type="button"
            onClick={() => setLogoTab("custom")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              logoTab === "custom"
                ? "bg-indigo-600 text-white shadow"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Custom Logo Upload
          </button>
        </div>

        {logoTab === "default" ? (
          /* ── Default animated logo ── */
          <div className="flex flex-col items-center gap-4 py-4">
            <BusinessAnimatedLogo
              name={bizName}
              subtitle={bizType}
              size={200}
              bounce={false}
            />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">{bizName}</p>
              {bizType && <p className="text-xs text-gray-400 mt-0.5">{bizType}</p>}
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-center max-w-sm">
              <p className="text-xs text-indigo-600 font-medium">✨ This is your auto-generated logo</p>
              <p className="text-xs text-gray-400 mt-1">
                Auto-generated from your firm name — no design needed!
                To upload a custom logo, use the "Custom Logo Upload" tab.
              </p>
            </div>
          </div>
        ) : (
          /* ── Custom logo upload ── */
          <div className="flex items-center gap-6">
            <div className="relative flex-shrink-0">
              <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center bg-gray-50 overflow-hidden">
                {form?.logo ? (
                  <img src={form.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="text-center text-gray-300">
                    <Building2 className="w-12 h-12 mx-auto mb-1" />
                    <span className="text-xs">No logo</span>
                  </div>
                )}
              </div>
              {form?.logo && (
                <button type="button"
                  onClick={() => setForm((f: any) => ({ ...f, logo: null }))}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-3">
              <button type="button" onClick={() => logoInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors">
                <Upload className="w-4 h-4" />
                {form?.logo ? "Logo Badlo" : "Logo Upload Karo"}
              </button>
              <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" className="hidden" onChange={handleLogoUpload} />
              <ul className="text-xs text-gray-400 space-y-0.5 list-disc list-inside">
                <li>PNG, JPG, SVG — max 500KB</li>
                <li>Transparent background best hota hai</li>
                <li>Har invoice aur document par dikhega</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ── Firm Details ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Firm Details</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Firm / Business Name</label>
            <input className={inp} value={form?.name || ""} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
              <input className={inp} value={form?.gstin || ""} onChange={e => setForm((f: any) => ({ ...f, gstin: e.target.value.toUpperCase() }))} placeholder="22AAAAA0000A1Z5" maxLength={15} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN</label>
              <input className={inp} value={form?.pan || ""} onChange={e => setForm((f: any) => ({ ...f, pan: e.target.value.toUpperCase() }))} maxLength={10} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input className={inp} value={form?.phone || ""} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className={inp} value={form?.email || ""} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea className={inp} rows={2} value={form?.address || ""} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input className={inp} value={form?.city || ""} onChange={e => setForm((f: any) => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
              <input className={inp} value={form?.pincode || ""} onChange={e => setForm((f: any) => ({ ...f, pincode: e.target.value }))} maxLength={6} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Authorized Signatory</label>
            <input className={inp} value={form?.signatoryName || ""} onChange={e => setForm((f: any) => ({ ...f, signatoryName: e.target.value }))} placeholder="Proprietor ka naam" />
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-sm text-gray-500">Business Code</span>
            <span className="font-mono font-bold text-gray-700 tracking-widest">{form?.businessCode}</span>
          </div>
        </div>
      </div>

      <button type="submit" disabled={saving}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 text-sm">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? "Saving..." : "Profile Save Karo"}
      </button>
    </form>
  );
}
