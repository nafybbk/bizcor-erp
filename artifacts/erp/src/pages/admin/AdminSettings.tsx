import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Loader2, Save, Settings, Globe, Phone, Mail, Palette, Type } from "lucide-react";

export default function AdminSettings() {
  const [form, setForm] = useState({
    softwareName: "BizERP",
    supportEmail: "",
    supportPhone: "",
    logoUrl: "",
    primaryColor: "#2563eb",
    footerText: "Powered by BizERP",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get<any>("/super-admin/settings").then(s => {
      setForm(f => ({ ...f, ...s }));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/super-admin/settings", form);
      localStorage.setItem("erp_app_name", form.softwareName);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  return (
    <form onSubmit={save} className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">App Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Customize software branding and support details</p>
        </div>
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">Settings saved! Reload sidebar to see name change.</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2 flex items-center gap-2"><Type className="w-4 h-4" /> Branding</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Software Name</label>
          <input className={inputCls} value={form.softwareName} onChange={e => setForm(f => ({ ...f, softwareName: e.target.value }))} placeholder="BizERP" />
          <p className="text-xs text-gray-400 mt-1">This name appears in the sidebar and login page</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Footer Text</label>
          <input className={inputCls} value={form.footerText} onChange={e => setForm(f => ({ ...f, footerText: e.target.value }))} placeholder="Powered by BizERP" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL (optional)</label>
          <input className={inputCls} value={form.logoUrl} onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))} placeholder="https://..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
          <div className="flex items-center gap-3">
            <input type="color" value={form.primaryColor} onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
              className="w-12 h-10 border border-gray-200 rounded-lg cursor-pointer" />
            <input className={inputCls} value={form.primaryColor} onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))} placeholder="#2563eb" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2 flex items-center gap-2"><Phone className="w-4 h-4" /> Support Contact</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
          <input type="email" className={inputCls} value={form.supportEmail} onChange={e => setForm(f => ({ ...f, supportEmail: e.target.value }))} placeholder="support@yourdomain.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Support Phone</label>
          <input className={inputCls} value={form.supportPhone} onChange={e => setForm(f => ({ ...f, supportPhone: e.target.value }))} placeholder="+91 XXXXX XXXXX" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2 flex items-center gap-2"><Globe className="w-4 h-4" /> Deployment Info</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="font-medium">Database</span>
            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">PostgreSQL (Drizzle ORM)</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="font-medium">Backend</span>
            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">Express.js (Node 24)</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="font-medium">Frontend</span>
            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">React + Vite</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="font-medium">Version</span>
            <span className="font-mono text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">v1.0.0</span>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
          <strong>Migration tip:</strong> To migrate to Vercel + Supabase, set DATABASE_URL to Supabase PostgreSQL URL, SESSION_SECRET to a random string, deploy frontend to Vercel, and backend as a Vercel serverless function. See DEPLOYMENT.md for full guide.
        </div>
      </div>
    </form>
  );
}
