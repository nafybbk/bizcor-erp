import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { Building2, Eye, EyeOff, Loader2, Search, ChevronRight, Headphones } from "lucide-react";

const SAVED_CODE_KEY = "erp_last_business_code";

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ email: "", password: "", businessCode: "" });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"business" | "superadmin">("business");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [showLookup, setShowLookup] = useState(false);
  const [appName, setAppName] = useState(localStorage.getItem("erp_app_name") || "BizERP");
  const [appSubtitle, setAppSubtitle] = useState("Indian Business ERP");

  useEffect(() => {
    // Auto-fill saved business code
    const saved = localStorage.getItem(SAVED_CODE_KEY);
    if (saved) setForm(f => ({ ...f, businessCode: saved }));

    // Load branding from public API (no auth needed)
    api.get<any>("/public-settings").then(s => {
      if (s.softwareName) {
        setAppName(s.softwareName);
        localStorage.setItem("erp_app_name", s.softwareName);
      }
      if (s.footerText) setAppSubtitle(s.footerText);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(form.email, form.password, mode === "business" ? (form.businessCode || undefined) : undefined);
      if (mode === "business" && form.businessCode) {
        localStorage.setItem(SAVED_CODE_KEY, form.businessCode.toUpperCase());
      }
      navigate("/");
    } catch (err: any) {
      if (err.message?.includes("multiple_businesses") || err.code === "multiple_businesses") {
        setError("Aapka email kai businesses se linked hai. Apna Business Code daalo.");
        setShowLookup(true);
      } else {
        setError(err.message || "Login failed");
      }
    } finally { setLoading(false); }
  };

  const lookupBusinesses = async () => {
    if (!form.email) { setError("Pehle apna email daalo"); return; }
    setLookupLoading(true); setError(""); setBusinesses([]);
    try {
      const res = await api.get<any>(`/auth/lookup-business?email=${encodeURIComponent(form.email)}`);
      if (res.businesses?.length === 0) {
        setError("Is email se koi business nahi mila. Check karo ya register karo.");
      } else {
        setBusinesses(res.businesses || []);
        setShowLookup(true);
      }
    } catch {
      setError("Email se business dhundne mein problem hui. Try again.");
    } finally { setLookupLoading(false); }
  };

  const selectBusiness = (code: string) => {
    setForm(f => ({ ...f, businessCode: code }));
    setShowLookup(false);
    setBusinesses([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{appName}</h1>
          <p className="text-gray-500 mt-1">Indian Business ERP</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "business" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setMode("business")}>Business Login</button>
            <button className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${mode === "superadmin" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setMode("superadmin")}>
              <Headphones className="w-3.5 h-3.5" />
              Tech Login
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input type="email" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="you@example.com" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm pr-10"
                  placeholder="••••••••" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })} required />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === "business" && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Business Code <span className="text-gray-400 font-normal">(optional)</span></label>
                  <button type="button" onClick={lookupBusinesses} disabled={lookupLoading || !form.email}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-40">
                    {lookupLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    {lookupLoading ? "Dhundh raha..." : "Code bhool gaye?"}
                  </button>
                </div>
                <input type="text"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm uppercase tracking-wider"
                  placeholder="e.g. ABC123 (khali chhod sakte hain)"
                  value={form.businessCode}
                  onChange={e => { setForm({ ...form, businessCode: e.target.value.toUpperCase() }); setShowLookup(false); }} />
                <p className="text-xs text-gray-400 mt-1">Ek hi business hai to code ki zaroorat nahi</p>
              </div>
            )}

            {/* Business lookup results */}
            {showLookup && businesses.length > 0 && (
              <div className="border border-blue-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-blue-50 text-xs font-medium text-blue-700">Aapke email pe yeh businesses mili hain — select karo:</div>
                {businesses.map(b => (
                  <button key={b.id} type="button" onClick={() => selectBusiness(b.businessCode)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 border-t border-gray-100 text-left transition-colors">
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

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign In
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              New business?{" "}
              <a href="/register" className="text-blue-600 hover:underline font-medium">Register here</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
