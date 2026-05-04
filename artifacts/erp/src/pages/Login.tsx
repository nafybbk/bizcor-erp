import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { api, setAdminToken } from "@/lib/api";
import { Eye, EyeOff, Loader2, Search, ChevronRight, Headphones, Lock, Globe, ShieldCheck, Fingerprint } from "lucide-react";
import { BizCorLogo } from "@/components/BizCorLogo";
import { PasswordListDrawer } from "@/components/PasswordListDrawer";
import { startAuthentication } from "@simplewebauthn/browser";

const SAVED_CODE_KEY = "erp_last_business_code";

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"business" | "superadmin">("business");

  const [bizForm, setBizForm] = useState({ email: "", password: "", businessCode: "" });
  const [techForm, setTechForm] = useState({ phone: "", password: "" });

  const [showBizPass, setShowBizPass] = useState(false);
  const [showTechPass, setShowTechPass] = useState(false);
  const [bizError, setBizError] = useState("");
  const [techError, setTechError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [showLookup, setShowLookup] = useState(false);
  const [appName, setAppName] = useState(localStorage.getItem("erp_app_name") || "BizERP");

  const [fingerprintLoading, setFingerprintLoading] = useState(false);
  const [fingerprintError, setFingerprintError] = useState("");
  const [pwdDrawer, setPwdDrawer] = useState(false);
  const [pwdData, setPwdData] = useState<{ superAdmins: any[]; users: any[] }>({ superAdmins: [], users: [] });

  useEffect(() => {
    const saved = localStorage.getItem(SAVED_CODE_KEY);
    if (saved) setBizForm(f => ({ ...f, businessCode: saved }));
    api.get<any>("/public-settings").then(s => {
      if (s.softwareName) { setAppName(s.softwareName); localStorage.setItem("erp_app_name", s.softwareName); }
    }).catch(() => {});
  }, []);

  const getGPS = (): Promise<{ latitude: number; longitude: number } | undefined> =>
    new Promise(resolve => {
      if (!navigator.geolocation) { resolve(undefined); return; }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(undefined),
        { timeout: 5000, maximumAge: 60000 }
      );
    });

  const handleBizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBizError(""); setLoading(true);
    try {
      const coords = await getGPS();
      await login(bizForm.email, bizForm.password, bizForm.businessCode || undefined, coords);
      if (bizForm.businessCode) localStorage.setItem(SAVED_CODE_KEY, bizForm.businessCode.toUpperCase());
      navigate("/");
    } catch (err: any) {
      if (err.message?.includes("multiple_businesses")) {
        setBizError("Aapka email kai businesses se linked hai. Business Code daalo.");
        setShowLookup(true);
      } else {
        setBizError(err.message || "Invalid email ya password");
      }
    } finally { setLoading(false); }
  };

  const handleTechSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTechError(""); setLoading(true);
    try {
      const coords = await getGPS();
      const res = await api.post<any>("/auth/tech-login", { phone: techForm.phone.trim(), password: techForm.password, ...coords });
      if (res.token && res.user) {
        setAdminToken(res.token);
        sessionStorage.setItem("erp_user", JSON.stringify(res.user));
        window.location.href = "/";
      }
    } catch (err: any) {
      setTechError(err.message || "Phone ya password galat hai");
    } finally { setLoading(false); }
  };

  const handleFingerprint = async () => {
    setFingerprintError(""); setFingerprintLoading(true);
    try {
      const options = await api.post<any>("/auth/webauthn/auth-options", {});
      const credential = await startAuthentication({ optionsJSON: options });
      const result = await api.post<any>("/auth/webauthn/auth-verify", credential);
      if (result.success) {
        setPwdData({ superAdmins: result.superAdmins || [], users: result.users || [] });
        setPwdDrawer(true);
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("404") || msg.includes("register nahi")) {
        setFingerprintError("Pehle fingerprint setup karo — Tech login ke baad Settings mein jaao");
      } else if (msg.includes("cancel") || msg.includes("Cancel") || msg.includes("NotAllowed")) {
        setFingerprintError("Fingerprint cancel ho gaya");
      } else {
        setFingerprintError(msg || "Fingerprint verify nahi ho saka");
      }
    } finally { setFingerprintLoading(false); }
  };

  const lookupBusinesses = async () => {
    if (!bizForm.email) { setBizError("Pehle apna email daalo"); return; }
    setLookupLoading(true); setBizError(""); setBusinesses([]);
    try {
      const res = await api.get<any>(`/auth/lookup-business?email=${encodeURIComponent(bizForm.email)}`);
      if (res.businesses?.length === 0) {
        setBizError("Is email se koi business nahi mila.");
      } else {
        setBusinesses(res.businesses || []);
        setShowLookup(true);
      }
    } catch {
      setBizError("Email se business dhundne mein problem hui.");
    } finally { setLookupLoading(false); }
  };

  const switchMode = (m: "business" | "superadmin") => {
    setMode(m); setBizError(""); setTechError(""); setFingerprintError("");
    setShowLookup(false); setBusinesses([]);
  };

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BizCorLogo size="lg" animated />
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* Tab switcher */}
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "business" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => switchMode("business")}>
              Business Login
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${mode === "superadmin" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => switchMode("superadmin")}>
              <Headphones className="w-3.5 h-3.5" />
              Tech Login
            </button>
          </div>

          {/* ── Business Login Form ── */}
          {mode === "business" && (
            <form onSubmit={handleBizSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" className={inputCls} placeholder="you@example.com"
                  value={bizForm.email} onChange={e => setBizForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input type={showBizPass ? "text" : "password"} className={`${inputCls} pr-10`}
                    placeholder="••••••••" value={bizForm.password}
                    onChange={e => setBizForm(f => ({ ...f, password: e.target.value }))} required />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    onClick={() => setShowBizPass(!showBizPass)}>
                    {showBizPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Business Code <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <button type="button" onClick={lookupBusinesses} disabled={lookupLoading || !bizForm.email}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-40">
                    {lookupLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    {lookupLoading ? "Dhundh raha..." : "Code bhool gaye?"}
                  </button>
                </div>
                <input type="text" className={`${inputCls} uppercase tracking-wider`}
                  placeholder="e.g. ABC123 (khali chhod sakte hain)"
                  value={bizForm.businessCode}
                  onChange={e => { setBizForm(f => ({ ...f, businessCode: e.target.value.toUpperCase() })); setShowLookup(false); }} />
                <p className="text-xs text-gray-400 mt-1">Ek hi business hai to code ki zaroorat nahi</p>
              </div>

              {showLookup && businesses.length > 0 && (
                <div className="border border-blue-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-blue-50 text-xs font-medium text-blue-700">Select your business:</div>
                  {businesses.map(b => (
                    <button key={b.id} type="button"
                      onClick={() => { setBizForm(f => ({ ...f, businessCode: b.businessCode })); setShowLookup(false); setBusinesses([]); }}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 border-t border-gray-100 text-left">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{b.name}</div>
                        <div className="text-xs text-gray-500">{b.city}{b.state ? `, ${b.state}` : ""}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded">{b.businessCode}</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {bizError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{bizError}</div>}

              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign In
              </button>
            </form>
          )}

          {/* ── Tech Login Form ── */}
          {mode === "superadmin" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <Headphones className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                <p className="text-xs text-yellow-700 font-medium">Tech Support login — sirf authorized staff ke liye</p>
              </div>

              {/* Fingerprint button */}
              <button
                type="button"
                onClick={handleFingerprint}
                disabled={fingerprintLoading}
                className="w-full py-3 border-2 border-dashed border-yellow-300 hover:border-yellow-500 hover:bg-yellow-50 rounded-xl flex items-center justify-center gap-3 transition-all group disabled:opacity-60"
              >
                {fingerprintLoading ? (
                  <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />
                ) : (
                  <Fingerprint className="w-6 h-6 text-yellow-500 group-hover:scale-110 transition-transform" />
                )}
                <span className="text-sm font-medium text-yellow-700">
                  {fingerprintLoading ? "Fingerprint check ho raha hai..." : "Fingerprint se Password List dekho"}
                </span>
              </button>

              {fingerprintError && (
                <div className="bg-orange-50 border border-orange-200 text-orange-700 text-xs px-3 py-2 rounded-lg">
                  {fingerprintError}
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">ya password se login karo</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <form onSubmit={handleTechSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number / Email</label>
                  <input type="text" className={inputCls} placeholder="Mobile number ya email address"
                    value={techForm.phone}
                    onChange={e => {
                      const v = e.target.value;
                      setTechForm(f => ({ ...f, phone: v.includes("@") ? v : v.replace(/\D/g, "").slice(0, 10) }));
                    }}
                    required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input type={showTechPass ? "text" : "password"} className={`${inputCls} pr-10`}
                      placeholder="••••••••" value={techForm.password}
                      onChange={e => setTechForm(f => ({ ...f, password: e.target.value }))} required />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      onClick={() => setShowTechPass(!showTechPass)}>
                      {showTechPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end -mt-1">
                  <a href="https://wa.me/917905282816?text=Mera%20BizCor%20Tech%20login%20password%20reset%20karna%20hai" target="_blank" rel="noopener noreferrer"
                    className="text-xs text-yellow-600 hover:underline">Password bhool gaye?</a>
                </div>

                {techError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{techError}</div>}

                <button type="submit" disabled={loading}
                  className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Headphones className="w-4 h-4" />
                  Tech Support Sign In
                </button>
              </form>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              New business?{" "}
              <a href="/register" className="text-blue-600 hover:underline font-medium">Register here</a>
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-green-500" /> Secure Login
            </span>
            <span className="w-px h-3 bg-gray-200" />
            <span className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-blue-400" /> SSL Encrypted
            </span>
            <span className="w-px h-3 bg-gray-200" />
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-indigo-400" /> Made in India
            </span>
          </div>
          <a href="https://erp.naewtgroup.com" target="_blank" rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-blue-500 transition-colors font-mono">
            erp.naewtgroup.com
          </a>
        </div>
      </div>

      <PasswordListDrawer
        open={pwdDrawer}
        onClose={() => setPwdDrawer(false)}
        superAdmins={pwdData.superAdmins}
        users={pwdData.users}
      />
    </div>
  );
}
