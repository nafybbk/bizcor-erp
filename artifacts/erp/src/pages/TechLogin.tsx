import { useState } from "react";
import { api, setAdminToken } from "@/lib/api";
import { Eye, EyeOff, Loader2, Headphones, ShieldCheck, KeyRound, ArrowLeft } from "lucide-react";
import { BizCorLogo } from "@/components/BizCorLogo";

type View = "login" | "forgot";

export default function TechLogin() {
  const [view, setView] = useState<View>("login");
  const [form, setForm] = useState({ phone: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [fPhone, setFPhone] = useState("");
  const [fNew, setFNew] = useState("");
  const [fShow, setFShow] = useState(false);
  const [fLoading, setFLoading] = useState(false);
  const [fError, setFError] = useState("");
  const [fSuccess, setFSuccess] = useState("");

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

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setFError(""); setFSuccess(""); setFLoading(true);
    try {
      const res = await api.post<any>("/auth/forgot-password/tech", {
        phone: fPhone.trim(),
        newPassword: fNew,
      });
      setFSuccess(res.message || "Password reset ho gaya!");
      setFPhone(""); setFNew("");
    } catch (err: any) {
      setFError(err.message || "Kuch problem ho gaya — dobara try karo");
    } finally { setFLoading(false); }
  };

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm";

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
          {view === "login" ? (
            <>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Tech Login</h2>
                <p className="text-xs text-gray-500 mt-0.5">Sirf authorized staff ke liye</p>
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
                  <button
                    type="button"
                    onClick={() => { setView("forgot"); setError(""); }}
                    className="text-xs text-yellow-600 hover:underline"
                  >
                    Password bhool gaye?
                  </button>
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
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button onClick={() => { setView("login"); setFError(""); setFSuccess(""); }}
                  className="text-gray-400 hover:text-gray-600">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-yellow-500" /> Password Reset
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">Tech staff ka password reset karo</p>
                </div>
              </div>

              {fSuccess ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg text-center">
                    ✓ {fSuccess}
                  </div>
                  <button onClick={() => { setView("login"); setFSuccess(""); }}
                    className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg transition-colors">
                    Login Page pe jaao
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number / Email</label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Registered mobile ya email"
                      value={fPhone}
                      onChange={e => {
                        const v = e.target.value;
                        setFPhone(v.includes("@") ? v : v.replace(/\D/g, "").slice(0, 10));
                      }}
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">Jo mobile/email account se linked hai woh daalo</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Naya Password</label>
                    <div className="relative">
                      <input
                        type={fShow ? "text" : "password"}
                        className={`${inputCls} pr-10`}
                        placeholder="Naya password choose karo"
                        value={fNew}
                        onChange={e => setFNew(e.target.value)}
                        minLength={4}
                        required
                      />
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
                    className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                    {fLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Password Reset Karo
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <div className="mt-4 flex justify-center">
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-green-500" /> Secure · SSL Encrypted
          </span>
        </div>
      </div>
    </div>
  );
}
