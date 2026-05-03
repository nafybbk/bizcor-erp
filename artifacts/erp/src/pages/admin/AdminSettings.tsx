import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Loader2, Save, Settings, Globe, Phone, Mail, Palette, Type, Lock, Smartphone, Upload, X, UserCircle } from "lucide-react";

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

  const [profile, setProfile] = useState({ phone: "", name: "", avatar: "" });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<any>("/super-admin/settings").then(s => {
      setForm(f => ({ ...f, ...s }));
    }).catch(console.error).finally(() => setLoading(false));
    api.get<any>("/super-admin/my-profile").then(p => setProfile({ phone: p.phone || "", name: p.name || "", avatar: p.avatar || "" })).catch(() => {});
  }, []);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) { alert("Image 1.5MB se chhoti honi chahiye"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setProfile(p => ({ ...p, avatar: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    setProfileMsg(null); setProfileSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (profile.phone !== undefined) payload.phone = profile.phone;
      if (profile.avatar !== undefined) payload.avatar = profile.avatar;
      if (pwForm.newPassword) {
        if (pwForm.newPassword !== pwForm.confirmPassword) {
          setProfileMsg({ type: "err", text: "New password aur confirm password match nahi kar rahe" }); setProfileSaving(false); return;
        }
        if (!pwForm.currentPassword) {
          setProfileMsg({ type: "err", text: "Current password daalna zaroori hai" }); setProfileSaving(false); return;
        }
        payload.currentPassword = pwForm.currentPassword;
        payload.newPassword = pwForm.newPassword;
      }
      await api.patch("/super-admin/my-profile", payload);
      setProfileMsg({ type: "ok", text: "Profile update ho gayi!" });
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      setProfileMsg({ type: "err", text: err.message || "Update mein problem hui" });
    } finally { setProfileSaving(false); }
  };

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

      {/* ── My Profile: Phone + Password ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-yellow-600" /> Tech Login — Mera Profile
        </h3>
        <p className="text-xs text-gray-500">Tech Login ka mobile number aur password yahan se badlein.</p>

        {profileMsg && (
          <div className={`text-sm px-3 py-2 rounded-lg ${profileMsg.type === "ok" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
            {profileMsg.text}
          </div>
        )}

        {/* Avatar Upload */}
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full border-2 border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
              {profile.avatar
                ? <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                : <UserCircle className="w-12 h-12 text-gray-300" />}
            </div>
            {profile.avatar && (
              <button type="button" onClick={() => setProfile(p => ({ ...p, avatar: "" }))}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="text-sm font-medium text-gray-700">Profile Photo</div>
            <button type="button" onClick={() => avatarInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-medium text-gray-700 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              {profile.avatar ? "Photo Badlo" : "Photo Upload Karo"}
            </button>
            <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={handleAvatarUpload} />
            <p className="text-xs text-gray-400">PNG/JPG — max 1.5MB</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number (Login ke liye use hoga)</label>
          <input type="tel" className={inputCls}
            value={profile.phone}
            onChange={e => setProfile(p => ({ ...p, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
            placeholder="10 digit mobile number" maxLength={10} />
          <p className="text-xs text-gray-400 mt-1">Yahi number Tech Login mein daalenge</p>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Password Badlein</span>
            <span className="text-xs text-gray-400">(khali chhodein agar sirf mobile update karna ho)</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input type="password" className={inputCls}
                value={pwForm.currentPassword}
                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                placeholder="Purana password" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" className={inputCls}
                  value={pwForm.newPassword}
                  onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                  placeholder="Naya password (min 6 char)" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input type="password" className={inputCls}
                  value={pwForm.confirmPassword}
                  onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="Dobara naya password" />
              </div>
            </div>
          </div>
        </div>

        <button type="button" onClick={saveProfile} disabled={profileSaving}
          className="flex items-center gap-2 px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
          {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {profileSaving ? "Saving..." : "Profile Save Karo"}
        </button>
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
