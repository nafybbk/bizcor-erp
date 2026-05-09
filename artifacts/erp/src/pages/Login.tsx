import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { Eye, EyeOff, Loader2, Search, ChevronRight, Lock, Globe, ShieldCheck, KeyRound, ArrowLeft } from "lucide-react";
import { BizCorLogo } from "@/components/BizCorLogo";

const SAVED_CODE_KEY = "erp_last_business_code";
const SAVED_CREDS_KEY = "erp_remembered_creds";

type View = "login" | "forgot";

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [view, setView] = useState<View>("login");

  const [form, setForm] = useState({ email: "", password: "", businessCode: "" });
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [showLookup, setShowLookup] = useState(false);
  const [multiUsers, setMultiUsers] = useState<{ id: number; name: string; hasPin: boolean }[]>([]);
  const [pins, setPins] = useState<Record<number, string>>({});
  const [alreadyLoggedIn, setAlreadyLoggedIn] = useState<{ lastLoginAt: string | null; lastLoginIp: string | null; loginName?: string; pin?: string } | null>(null);
  const [appName, setAppName] = useState(localStorage.getItem("erp_app_name") || "BizERP");

  const [fEmail, setFEmail] = useState("");
  const [fCode, setFCode] = useState("");
  const [fNew, setFNew] = useState("");
  const [fShow, setFShow] = useState(false);
  const [fLoading, setFLoading] = useState(false);
  const [fError, setFError] = useState("");
  const [fSuccess, setFSuccess] = useState("");

  // Show session-invalidated message if redirected from another session
  const [sessionMsg, setSessionMsg] = useState(() => {
    const msg = localStorage.getItem("erp_session_invalidated_msg");
    if (msg) localStorage.removeItem("erp_session_invalidated_msg");
    return msg || "";
  });

  useEffect(() => {
    const savedCode = localStorage.getItem(SAVED_CODE_KEY);
    const savedCreds = localStorage.getItem(SAVED_CREDS_KEY);
    if (savedCreds) {
      try {
        const c = JSON.parse(savedCreds);
        setForm(f => ({
          ...f,
          email: c.email || "",
          password: c.password || "",
          businessCode: c.businessCode || savedCode || "",
        }));
        setRemember(true);
      } catch {
        if (savedCode) setForm(f => ({ ...f, businessCode: savedCode }));
      }
    } else {
      if (savedCode) setForm(f => ({ ...f, businessCode: savedCode }));
    }
    api.get<any>("/public-settings").then(s => {
      if (s.softwareName) {
        setAppName(s.softwareName);
        localStorage.setItem("erp_app_name", s.softwareName);
      }
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

  const doLogin = async (loginName?: string, pin?: string, forceLogin?: boolean) => {
    setError(""); setLoading(true);
    try {
      const coords = await getGPS();
      await login(form.email, form.password, form.businessCode || undefined, coords, loginName, pin, forceLogin);
      if (form.businessCode) localStorage.setItem(SAVED_CODE_KEY, form.businessCode.toUpperCase());
      if (remember) {
        localStorage.setItem(SAVED_CREDS_KEY, JSON.stringify({
          email: form.email,
          password: form.password,
          businessCode: form.businessCode.toUpperCase(),
        }));
      } else {
        localStorage.removeItem(SAVED_CREDS_KEY);
      }
      navigate("/");
    } catch (err: any) {
      if (err.data?.error === "ALREADY_LOGGED_IN") {
        setAlreadyLoggedIn({ lastLoginAt: err.data.lastLoginAt, lastLoginIp: err.data.lastLoginIp, loginName, pin });
        setError("");
      } else if (err.data?.error === "multiple_users" && err.data?.users?.length > 0) {
        setMultiUsers(err.data.users);
        setPins({});
        setError("");
      } else if (err.data?.error === "wrong_pin") {
        setError("Incorrect PIN — please try again");
      } else if (err.data?.error === "multiple_businesses" || err.message?.includes("multiple businesses")) {
        setError("Your email is linked to multiple businesses. Please enter your Business Code.");
        setShowLookup(true);
      } else {
        setError(err.message || "Invalid email or password");
      }
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMultiUsers([]);
    setPins({});
    setAlreadyLoggedIn(null);
    await doLogin();
  };

  const handleSelectUser = async (userId: number, name: string) => {
    await doLogin(name, pins[userId] || undefined);
  };

  const handleForceLogin = async () => {
    const { loginName, pin } = alreadyLoggedIn || {};
    setAlreadyLoggedIn(null);
    await doLogin(loginName, pin, true);
  };

  const lookupBusinesses = async () => {
    if (!form.email) { setError("Please enter your email first"); return; }
    setLookupLoading(true); setError(""); setBusinesses([]);
    try {
      const res = await api.get<any>(`/auth/lookup-business?email=${encodeURIComponent(form.email)}`);
      if (res.businesses?.length === 0) {
        setError("No business found for this email.");
      } else {
        setBusinesses(res.businesses || []);
        setShowLookup(true);
      }
    } catch {
      setError("Could not find business by email. Please try again.");
    } finally { setLookupLoading(false); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setFError(""); setFSuccess(""); setFLoading(true);
    try {
      const res = await api.post<any>("/auth/forgot-password/user", {
        email: fEmail.toLowerCase().trim(),
        businessCode: fCode.trim() || undefined,
        newPassword: fNew,
      });
      setFSuccess(res.message || "Password reset successful!");
      setFEmail(""); setFCode(""); setFNew("");
    } catch (err: any) {
      setFError(err.message || "Something went wrong — please try again");
    } finally { setFLoading(false); }
  };

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-3">
      <div className="w-full max-w-md">
        <div className="text-center mb-3">
          <BizCorLogo size="sm" animated hideSubtitle />
          <p className="mt-0.5 text-xs text-gray-400">India ka Smart Business ERP</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5">
          {view === "login" ? (
            <>
              <div className="mb-3">
                <h2 className="text-lg font-bold text-gray-900">Business Login</h2>
                <p className="text-xs text-gray-500 mt-0.5">Sign in to your business account</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setShowLookup(false); }}
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <button type="button" onClick={() => { setView("forgot"); setFEmail(form.email); setError(""); }}
                      className="text-xs text-blue-600 hover:underline">
                      Password bhool gaye?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      className={`${inputCls} pr-10`}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPass(!showPass)}
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={remember}
                    onChange={e => {
                      setRemember(e.target.checked);
                      if (!e.target.checked) localStorage.removeItem(SAVED_CREDS_KEY);
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                  />
                  <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer select-none">
                    Remember me (email &amp; password will be saved)
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Business Code <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={lookupBusinesses}
                      disabled={lookupLoading || !form.email}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-40"
                    >
                      {lookupLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                      {lookupLoading ? "Dhundh raha..." : "Code bhool gaye?"}
                    </button>
                  </div>
                  <input
                    type="text"
                    className={`${inputCls} uppercase tracking-wider`}
                    placeholder="e.g. ABC123 (optional)"
                    value={form.businessCode}
                    onChange={e => { setForm(f => ({ ...f, businessCode: e.target.value.toUpperCase() })); setShowLookup(false); }}
                  />
                  <p className="text-xs text-gray-400 mt-1">Not required if you have only one business</p>
                </div>

                {showLookup && businesses.length > 0 && (
                  <div className="border border-blue-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-blue-50 text-xs font-medium text-blue-700">Select your business:</div>
                    {businesses.map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => { setForm(f => ({ ...f, businessCode: b.businessCode })); setShowLookup(false); setBusinesses([]); }}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 border-t border-gray-100 text-left"
                      >
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

                {multiUsers.length > 0 && (
                  <div className="border border-amber-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-amber-50 text-xs font-medium text-amber-800 flex items-center gap-1.5">
                      <span>⚠️</span> Is email pe kai accounts hain — aap kaun hain?
                    </div>
                    {multiUsers.map(u => (
                      <div key={u.id} className="border-t border-gray-100 px-4 py-3 flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-900 flex-1">{u.name}</span>
                        {u.hasPin && (
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={8}
                            placeholder="PIN"
                            value={pins[u.id] || ""}
                            onChange={e => setPins(p => ({ ...p, [u.id]: e.target.value }))}
                            className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleSelectUser(u.id, u.name)}
                          disabled={loading || (u.hasPin && !(pins[u.id] || "").trim())}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg disabled:opacity-40"
                        >
                          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
                          Login
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {sessionMsg && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2 rounded-lg flex items-start gap-2">
                    <span className="mt-0.5">⚠️</span>
                    <span>{sessionMsg}</span>
                  </div>
                )}

                {alreadyLoggedIn && (
                  <div className="border border-orange-200 bg-orange-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="text-orange-500 text-lg leading-none">⚠</span>
                      <div>
                        <p className="text-sm font-semibold text-orange-800">Aap pehle se kisi aur jagah login hain</p>
                        {alreadyLoggedIn.lastLoginAt && (
                          <p className="text-xs text-orange-600 mt-0.5">
                            Pehla login: {alreadyLoggedIn.lastLoginAt}
                            {alreadyLoggedIn.lastLoginIp ? ` (${alreadyLoggedIn.lastLoginIp})` : ""}
                          </p>
                        )}
                        <p className="text-xs text-orange-700 mt-1">Do you want to start a new session? The previous session will be ended.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleForceLogin}
                        disabled={loading}
                        className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Yes, start new session
                      </button>
                      <button
                        type="button"
                        onClick={() => setAlreadyLoggedIn(null)}
                        className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
                      >
                        Nahi
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Sign In
                </button>
              </form>

              <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-500">
                  New business?{" "}
                  <a href="/register" className="text-blue-600 hover:underline font-medium">Register here</a>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => { setView("login"); setFError(""); setFSuccess(""); }}
                  className="text-gray-400 hover:text-gray-600">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-blue-500" /> Password Reset
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">Set a new password</p>
                </div>
              </div>

              {fSuccess ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg text-center">
                    ✓ {fSuccess}
                  </div>
                  <button onClick={() => { setView("login"); setFSuccess(""); }}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                    Login Page pe jaao
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input type="email" className={inputCls} placeholder="you@example.com"
                      value={fEmail} onChange={e => setFEmail(e.target.value)} required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Code <span className="text-gray-400 font-normal">(agar kai businesses hain to)</span>
                    </label>
                    <input type="text" className={`${inputCls} uppercase tracking-wider`}
                      placeholder="e.g. ABC123"
                      value={fCode} onChange={e => setFCode(e.target.value.toUpperCase())} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <div className="relative">
                      <input type={fShow ? "text" : "password"} className={`${inputCls} pr-10`}
                        placeholder="Choose a new password"
                        value={fNew} onChange={e => setFNew(e.target.value)}
                        minLength={4} required />
                      <button type="button" onClick={() => setFShow(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {fShow ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {fError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                      {fError}
                    </div>
                  )}

                  <button type="submit" disabled={fLoading}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                    {fLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Password Reset Karo
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <div className="mt-2 flex flex-col items-center gap-1">
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
          <a
            href="https://erp.naewtgroup.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-blue-500 transition-colors font-mono"
          >
            erp.naewtgroup.com
          </a>
        </div>
      </div>
    </div>
  );
}
