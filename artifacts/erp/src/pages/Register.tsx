import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { Building2, Loader2, Gift } from "lucide-react";

const INDIAN_STATES = [
  { name: "Andhra Pradesh", code: "37" }, { name: "Arunachal Pradesh", code: "12" },
  { name: "Assam", code: "18" }, { name: "Bihar", code: "10" }, { name: "Chhattisgarh", code: "22" },
  { name: "Delhi", code: "07" }, { name: "Goa", code: "30" }, { name: "Gujarat", code: "24" },
  { name: "Haryana", code: "06" }, { name: "Himachal Pradesh", code: "02" },
  { name: "Jammu & Kashmir", code: "01" }, { name: "Jharkhand", code: "20" },
  { name: "Karnataka", code: "29" }, { name: "Kerala", code: "32" }, { name: "Ladakh", code: "38" },
  { name: "Madhya Pradesh", code: "23" }, { name: "Maharashtra", code: "27" }, { name: "Manipur", code: "14" },
  { name: "Meghalaya", code: "17" }, { name: "Mizoram", code: "15" }, { name: "Nagaland", code: "13" },
  { name: "Odisha", code: "21" }, { name: "Punjab", code: "03" }, { name: "Rajasthan", code: "08" },
  { name: "Sikkim", code: "11" }, { name: "Tamil Nadu", code: "33" }, { name: "Telangana", code: "36" },
  { name: "Tripura", code: "16" }, { name: "Uttar Pradesh", code: "09" }, { name: "Uttarakhand", code: "05" },
  { name: "West Bengal", code: "19" },
  { name: "Andaman & Nicobar Islands", code: "35" }, { name: "Chandigarh", code: "04" },
  { name: "Dadra & Nagar Haveli", code: "26" }, { name: "Daman & Diu", code: "25" },
  { name: "Lakshadweep", code: "31" }, { name: "Puducherry", code: "34" },
];

export default function Register() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Clear any stale session from previous login so register always starts fresh
  useEffect(() => {
    localStorage.removeItem("erp_token");
    localStorage.removeItem("erp_user");
    localStorage.removeItem("erp_business");
    sessionStorage.removeItem("erp_token");
    sessionStorage.removeItem("erp_user");
  }, []);
  const [successData, setSuccessData] = useState<{ businessCode: string; businessName: string } | null>(null);
  const [form, setForm] = useState({
    businessName: "", gstin: "", pan: "", address: "", city: "", state: "", stateCode: "",
    pincode: "", phone: "", businessType: "retail",
    adminName: "", adminEmail: "", adminPassword: "", referredBy: "",
  });

  const set = (field: string, val: string) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res: any = await api.post("/businesses/register", form);
      localStorage.setItem("erp_token", res.token);
      localStorage.setItem("erp_user", JSON.stringify(res.user));
      localStorage.setItem("erp_business", JSON.stringify(res.business));
      setSuccessData({ businessCode: res.business.businessCode, businessName: res.business.name });
    } catch (err: any) {
      setError(err.message || err.detail || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Business Registered Successfully!</h1>
          <p className="text-gray-500 text-sm mb-6">{successData.businessName}</p>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-4">
            <p className="text-sm text-gray-500 mb-2">Your Business Code (save this for login):</p>
            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl py-4 px-6 mb-3">
              <span className="text-3xl font-mono font-bold text-blue-700 tracking-widest">{successData.businessCode}</span>
            </div>
            <p className="text-xs text-gray-400">You will need this code at login. Keep it safe.</p>
          </div>

          <button
            onClick={() => { navigate("/"); window.location.reload(); }}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors shadow"
          >
            Dashboard Kholein →
          </button>
        </div>
      </div>
    );
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-3 shadow-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Register Your Business</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="flex mb-8 relative">
            {[1, 2].map(s => (
              <div key={s} className={`flex-1 text-center text-sm font-medium pb-3 border-b-2 ${step >= s ? "border-blue-600 text-blue-600" : "border-gray-200 text-gray-400"}`}>
                {s === 1 ? "Business Details" : "Admin Account"}
              </div>
            ))}
          </div>

          <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : handleSubmit}>
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className={labelClass}>Business Name *</label>
                    <input className={inputClass} value={form.businessName} onChange={e => set("businessName", e.target.value)} required placeholder="Your Business Name" />
                  </div>
                  <div>
                    <label className={labelClass}>GSTIN</label>
                    <input className={inputClass} value={form.gstin} onChange={e => set("gstin", e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} />
                  </div>
                  <div>
                    <label className={labelClass}>PAN</label>
                    <input className={inputClass} value={form.pan} onChange={e => set("pan", e.target.value.toUpperCase())} placeholder="AAAAA0000A" maxLength={10} />
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input className={inputClass} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="9876543210" />
                  </div>
                  <div>
                    <label className={labelClass}>Business Type</label>
                    <select className={inputClass} value={form.businessType} onChange={e => set("businessType", e.target.value)}>
                      <option value="retail">Retail</option>
                      <option value="wholesale">Wholesale</option>
                      <option value="manufacturing">Manufacturing</option>
                      <option value="service">Service</option>
                      <option value="trading">Trading</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Address</label>
                    <input className={inputClass} value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street Address" />
                  </div>
                  <div>
                    <label className={labelClass}>City</label>
                    <input className={inputClass} value={form.city} onChange={e => set("city", e.target.value)} placeholder="City" />
                  </div>
                  <div>
                    <label className={labelClass}>State *</label>
                    <select className={inputClass} value={form.state} onChange={e => {
                      const st = INDIAN_STATES.find(s => s.name === e.target.value);
                      setForm(f => ({ ...f, state: e.target.value, stateCode: st?.code || "" }));
                    }} required>
                      <option value="">Select State</option>
                      {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Pincode</label>
                    <input className={inputClass} value={form.pincode} onChange={e => set("pincode", e.target.value)} placeholder="400001" maxLength={6} />
                  </div>
                </div>
                <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors mt-4">
                  Continue →
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Admin Full Name *</label>
                  <input className={inputClass} value={form.adminName} onChange={e => set("adminName", e.target.value)} required placeholder="Your Full Name" />
                </div>
                <div>
                  <label className={labelClass}>Admin Email *</label>
                  <input type="email" className={inputClass} value={form.adminEmail} onChange={e => set("adminEmail", e.target.value)} required placeholder="admin@yourcompany.com" />
                </div>
                <div>
                  <label className={labelClass}>Password *</label>
                  <input type="password" className={inputClass} value={form.adminPassword} onChange={e => set("adminPassword", e.target.value)} required placeholder="Min 8 characters" minLength={8} />
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <label className="block text-sm font-medium text-green-800 mb-1 flex items-center gap-1.5">
                    <Gift className="w-4 h-4" /> Referral Code (Optional)
                  </label>
                  <input
                    className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-sm bg-white font-mono tracking-widest uppercase"
                    value={form.referredBy}
                    onChange={e => set("referredBy", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    placeholder="Enter if someone gave you a code"
                    maxLength={6}
                  />
                  <p className="text-xs text-green-600 mt-1">The referrer earns a bonus for every 2 referrals (30 days free)</p>
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
                <div className="flex gap-3 mt-4">
                  <button type="button" onClick={() => setStep(1)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
                    ← Back
                  </button>
                  <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create Account
                  </button>
                </div>
              </div>
            )}
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            Already registered? <a href="/login" className="text-blue-600 hover:underline">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
