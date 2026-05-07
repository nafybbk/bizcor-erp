import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Loader2, Save, Settings, Globe, Phone, Mail, Palette, Type, Lock, Smartphone, Upload, X, UserCircle, Fingerprint, CheckCircle2, FileText } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";

export default function AdminSettings() {
  const [form, setForm] = useState({
    softwareName: "BizERP",
    supportEmail: "",
    supportPhone: "",
    logoUrl: "",
    primaryColor: "#2563eb",
    footerText: "Powered by BizERP",
    printFooterText: "",
    printFooterLogo: "",
  });
  const printLogoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [profile, setProfile] = useState({ phone: "", name: "", avatar: "" });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [fpLoading, setFpLoading] = useState(false);
  const [fpMsg, setFpMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

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

  const setupFingerprint = async () => {
    setFpMsg(null); setFpLoading(true);
    try {
      const options = await api.post<any>("/auth/webauthn/register-options", {});
      const credential = await startRegistration({ optionsJSON: options });
      await api.post("/auth/webauthn/register-verify", credential);
      setFpMsg({ type: "ok", text: "Fingerprint register ho gaya! Ab login page pe fingerprint se password list dekh sakte ho." });
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("excludeCredentials") || msg.includes("already") || msg.includes("InvalidStateError")) {
        setFpMsg({ type: "ok", text: "Yeh fingerprint pehle se register hai!" });
      } else if (msg.includes("cancel") || msg.includes("NotAllowed")) {
        setFpMsg({ type: "err", text: "Fingerprint setup cancel ho gaya" });
      } else {
        setFpMsg({ type: "err", text: msg || "Fingerprint setup mein error aaya" });
      }
    } finally { setFpLoading(false); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/super-admin/settings", form);
      localStorage.setItem("erp_app_name", form.softwareName);
      // Immediately update sidebar — no refresh needed
      window.dispatchEvent(new CustomEvent("app-settings-changed", { detail: form }));
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

      {/* Fingerprint Setup */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2 flex items-center gap-2">
          <Fingerprint className="w-4 h-4 text-yellow-500" /> Fingerprint Setup
        </h3>
        <p className="text-xs text-gray-500">
          Apna fingerprint register karo — phir login page pe bina password ke sirf fingerprint se saare users ke passwords dekh sakte ho.
        </p>
        {fpMsg && (
          <div className={`flex items-start gap-2 text-sm px-3 py-2 rounded-lg ${fpMsg.type === "ok" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
            {fpMsg.type === "ok" && <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            {fpMsg.text}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={setupFingerprint}
            disabled={fpLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
          >
            {fpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
            {fpLoading ? "Setup ho raha hai..." : "Fingerprint Register Karo"}
          </button>
          <button
            type="button"
            disabled={fpLoading}
            onClick={async () => {
              if (!confirm("Purana fingerprint delete ho jaayega. Confirm?")) return;
              setFpMsg(null);
              try {
                await api.post("/auth/webauthn/reset-credential", {});
                setFpMsg({ type: "ok", text: "Purana fingerprint hata diya. Ab 'Register Karo' button se dobara add karo." });
              } catch (err: any) {
                setFpMsg({ type: "err", text: err.message || "Reset mein problem aayi" });
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
          >
            Reset / Dobara Register Karo
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Agar "timed out" ya "not allowed" error aa raha hai toh pehle Reset karo, phir dobara usi device/browser par register karo.
        </p>
      </div>

      {/* ── Print Footer ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm border-b pb-2 flex items-center gap-2">
          <FileText className="w-4 h-4 text-purple-500" /> Print Footer (Har Invoice / PDF Pe)
        </h3>
        <p className="text-xs text-gray-500">Yeh text aur logo <strong>sabhi businesses</strong> ke har print/PDF ke neeche dikhayi dega.</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Footer Line (Text)</label>
          <input
            className={inputCls}
            value={form.printFooterText}
            onChange={e => setForm(f => ({ ...f, printFooterText: e.target.value }))}
            placeholder="e.g. Powered by BizCor | support@naewtgroup.com | +91 99999 99999"
          />
          <p className="text-xs text-gray-400 mt-1">Yeh line print mein sab se neeche aayegi</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Footer Logo (Image)</label>
          <div className="flex items-center gap-4">
            <div className="w-32 h-12 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
              {form.printFooterLogo
                ? <img src={form.printFooterLogo} alt="Footer Logo" className="max-h-full max-w-full object-contain p-1" />
                : <span className="text-xs text-gray-400">No logo</span>}
            </div>
            <div className="space-y-1.5">
              <button type="button" onClick={() => printLogoInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-medium text-gray-700 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                {form.printFooterLogo ? "Logo Badlo" : "Logo Upload Karo"}
              </button>
              {form.printFooterLogo && (
                <button type="button" onClick={() => setForm(f => ({ ...f, printFooterLogo: "" }))}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors">
                  <X className="w-3.5 h-3.5" /> Hatao
                </button>
              )}
              <input
                ref={printLogoInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 500_000) { alert("Logo 500KB se chhota hona chahiye"); return; }
                  const reader = new FileReader();
                  reader.onload = ev => setForm(f => ({ ...f, printFooterLogo: ev.target?.result as string }));
                  reader.readAsDataURL(file);
                }}
              />
              <p className="text-xs text-gray-400">PNG/JPG/SVG — max 500KB</p>
            </div>
          </div>
        </div>
        {(form.printFooterText || form.printFooterLogo) && (
          <div className="border border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
            <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Preview:</div>
            <div className="flex items-center justify-center gap-3 py-1">
              {form.printFooterLogo && <img src={form.printFooterLogo} alt="" className="h-6 object-contain" />}
              {form.printFooterText && <span className="text-xs text-gray-600">{form.printFooterText}</span>}
            </div>
          </div>
        )}
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
