import { useState } from "react";
import { api, setAdminToken } from "@/lib/api";
import { Eye, EyeOff, Loader2, Headphones, Fingerprint, ShieldCheck } from "lucide-react";
import { BizCorLogo } from "@/components/BizCorLogo";
import { PasswordListDrawer } from "@/components/PasswordListDrawer";
import { startAuthentication } from "@simplewebauthn/browser";

export default function TechLogin() {
  const [form, setForm] = useState({ phone: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState("");
  const [pwdDrawer, setPwdDrawer] = useState(false);
  const [pwdData, setPwdData] = useState<{ superAdmins: any[]; users: any[] }>({
    superAdmins: [],
    users: [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await api.post<any>("/auth/tech-login", {
        phone: form.phone.trim(),
        password: form.password,
      });
      if (res.token && res.user) {
        setAdminToken(res.token);
        sessionStorage.setItem("erp_user", JSON.stringify(res.user));
        window.location.href = "/";
      }
    } catch (err: any) {
      setError(err.message || "Phone ya password galat hai");
    } finally { setLoading(false); }
  };

  const handleFingerprint = async () => {
    setFpError(""); setFpLoading(true);
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
        setFpError("Pehle Admin Panel > Settings mein fingerprint register karo");
      } else if (msg.includes("cancel") || msg.includes("Cancel") || msg.includes("NotAllowed")) {
        setFpError("Fingerprint cancel ho gaya");
      } else {
        setFpError(msg || "Fingerprint verify nahi ho saka");
      }
    } finally { setFpLoading(false); }
  };

  const inputCls =
    "w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm";

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <BizCorLogo size="lg" animated />
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-100 border border-yellow-200 rounded-full">
            <Headphones className="w-3.5 h-3.5 text-yellow-600" />
            <span className="text-xs font-semibold text-yellow-700 tracking-wide">TECH SUPPORT</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Tech Login</h2>
            <p className="text-xs text-gray-500 mt-0.5">Sirf authorized staff ke liye</p>
          </div>

          {/* Fingerprint button */}
          <button
            type="button"
            onClick={handleFingerprint}
            disabled={fpLoading}
            className="w-full py-3.5 border-2 border-dashed border-yellow-300 hover:border-yellow-500 hover:bg-yellow-50 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all group disabled:opacity-60"
          >
            {fpLoading ? (
              <Loader2 className="w-7 h-7 text-yellow-500 animate-spin" />
            ) : (
              <Fingerprint className="w-7 h-7 text-yellow-500 group-hover:scale-110 transition-transform" />
            )}
            <span className="text-sm font-medium text-yellow-700">
              {fpLoading ? "Verify ho raha hai..." : "Fingerprint se Password List"}
            </span>
            <span className="text-xs text-yellow-500">Tap karo</span>
          </button>

          {fpError && (
            <div className="bg-orange-50 border border-orange-200 text-orange-700 text-xs px-3 py-2 rounded-lg">
              {fpError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">ya password se login karo</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mobile Number / Email
              </label>
              <input
                type="text"
                className={inputCls}
                placeholder="Mobile ya email"
                value={form.phone}
                onChange={e => {
                  const v = e.target.value;
                  setForm(f => ({ ...f, phone: v.includes("@") ? v : v.replace(/\D/g, "").slice(0, 10) }));
                }}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <a
                href="https://wa.me/917905282816?text=Mera%20BizCor%20Tech%20login%20password%20reset%20karna%20hai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-yellow-600 hover:underline"
              >
                Password bhool gaye?
              </a>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <Headphones className="w-4 h-4" />
              Login Karo
            </button>
          </form>

          <div className="pt-2 text-center">
            <a href="/login" className="text-xs text-gray-400 hover:text-blue-500 transition-colors">
              ← Business Login pe jaao
            </a>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-green-500" /> Secure · SSL Encrypted
          </span>
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
