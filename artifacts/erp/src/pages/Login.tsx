import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Building2, Eye, EyeOff, Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ email: "", password: "", businessCode: "" });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"business" | "superadmin">("business");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password, mode === "business" ? form.businessCode : undefined);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">BizERP</h1>
          <p className="text-gray-500 mt-1">Indian Business ERP</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "business" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setMode("business")}
            >Business Login</button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "superadmin" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setMode("superadmin")}
            >Super Admin</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "business" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Code</label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm uppercase tracking-wider"
                  placeholder="e.g. ABC123"
                  value={form.businessCode}
                  onChange={e => setForm({ ...form, businessCode: e.target.value.toUpperCase() })}
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

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
