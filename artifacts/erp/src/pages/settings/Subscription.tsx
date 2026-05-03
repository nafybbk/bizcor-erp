import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  CreditCard, Check, Users, FileText, Package, Building2,
  Calendar, AlertCircle, Clock, Ticket, Loader2, X, CheckCircle2, Crown, Zap,
} from "lucide-react";

const MODULE_LABELS: Record<string, string> = {
  sales: "Sales & Invoicing", purchases: "Purchases & Bills",
  payments: "Payments", inventory: "Inventory",
  accounting: "Accounting & Ledger", gst: "GST Reports",
  masters: "Masters (Items/Parties)", settings: "Settings & Users",
};

function PlanCard({ plan, isCurrentPlan, onActivate }: { plan: any; isCurrentPlan: boolean; onActivate: () => void }) {
  const isPro = plan.price > 0 && plan.maxUsers >= 10;
  return (
    <div className={`relative rounded-2xl border-2 p-5 space-y-4 transition-all ${
      isCurrentPlan
        ? "border-green-400 bg-green-50/60 shadow-md"
        : isPro
        ? "border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-purple-50/40"
        : "border-gray-200 bg-white"
    }`}>
      {isCurrentPlan && (
        <div className="absolute -top-3 left-4">
          <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Aapka Current Plan
          </span>
        </div>
      )}
      {isPro && !isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
            <Crown className="w-3 h-3" /> Recommended
          </span>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
          {plan.description && <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            {plan.price === 0 ? "Free" : `₹${Number(plan.price).toLocaleString("en-IN")}`}
          </div>
          {plan.price > 0 && (
            <div className="text-xs text-gray-400">/{plan.billingCycle === "monthly" ? "mahina" : "saal"}</div>
          )}
        </div>
      </div>

      {/* Limits */}
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-gray-700">
          <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span>Max <strong>{plan.maxUsers}</strong> users</span>
        </div>
        <div className="flex items-center gap-2 text-gray-700">
          <Calendar className="w-3.5 h-3.5 text-purple-500 shrink-0" />
          <span><strong>{plan.validityDays}</strong> din validity</span>
        </div>
        {plan.maxVouchersPerMonth != null && (
          <div className="flex items-center gap-2 text-gray-700">
            <FileText className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span>Max <strong>{plan.maxVouchersPerMonth}</strong> invoices/mahina</span>
          </div>
        )}
        {plan.maxItems != null && (
          <div className="flex items-center gap-2 text-gray-700">
            <Package className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Max <strong>{plan.maxItems}</strong> items</span>
          </div>
        )}
        {plan.maxParties != null && (
          <div className="flex items-center gap-2 text-gray-700">
            <Building2 className="w-3.5 h-3.5 text-teal-500 shrink-0" />
            <span>Max <strong>{plan.maxParties}</strong> parties</span>
          </div>
        )}
      </div>

      {/* Modules */}
      {plan.features && plan.features.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Modules</p>
          <div className="grid grid-cols-2 gap-1">
            {(Object.keys(MODULE_LABELS)).map(mod => {
              const has = plan.features.includes(mod);
              return (
                <div key={mod} className={`flex items-center gap-1.5 text-xs ${has ? "text-gray-700" : "text-gray-300"}`}>
                  {has
                    ? <Check className="w-3 h-3 text-green-500 shrink-0" />
                    : <X className="w-3 h-3 text-gray-200 shrink-0" />}
                  {MODULE_LABELS[mod]}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isCurrentPlan && (
        <button onClick={onActivate}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2
            ${isPro
              ? "bg-indigo-600 hover:bg-indigo-700 text-white"
              : "border-2 border-gray-300 hover:border-indigo-400 text-gray-700 hover:text-indigo-700"}`}>
          <Zap className="w-4 h-4" /> Is plan ke liye voucher code daalo
        </button>
      )}
    </div>
  );
}

export default function Subscription() {
  const [business, setBusiness] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [voucherCode, setVoucherCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showVoucherFor, setShowVoucherFor] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<any>("/businesses/current"),
      api.get<any[]>("/public-plans"),
    ]).then(([b, pl]) => {
      setBusiness(b);
      setPlans(Array.isArray(pl) ? pl : []);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const redeemVoucher = async () => {
    if (!voucherCode.trim()) return;
    setRedeemLoading(true);
    setRedeemResult(null);
    try {
      const res = await api.post<any>("/redeem-voucher", { code: voucherCode.trim() });
      setRedeemResult({ success: true, message: res.message });
      setVoucherCode(""); setShowVoucherFor(null);
      load();
    } catch (err: any) {
      setRedeemResult({ success: false, message: err.message || "Voucher redeem nahi hua" });
    } finally { setRedeemLoading(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
    </div>
  );

  const currentPlan = plans.find(p => p.id === business?.planId) || null;
  const daysLeft = business?.planExpiresAt
    ? Math.ceil((new Date(business.planExpiresAt).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-indigo-500" /> Mera Subscription
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Aapka current plan aur available plans</p>
      </div>

      {/* Current Plan Status Card */}
      <div className={`rounded-2xl border-2 p-5 ${
        !currentPlan ? "border-amber-200 bg-amber-50"
        : daysLeft !== null && daysLeft <= 15 ? "border-red-200 bg-red-50"
        : "border-green-200 bg-green-50"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              !currentPlan ? "bg-amber-100" : daysLeft !== null && daysLeft <= 15 ? "bg-red-100" : "bg-green-100"
            }`}>
              {!currentPlan ? <AlertCircle className="w-6 h-6 text-amber-600" />
                : daysLeft !== null && daysLeft <= 15 ? <Clock className="w-6 h-6 text-red-500" />
                : <CheckCircle2 className="w-6 h-6 text-green-600" />}
            </div>
            <div>
              {currentPlan ? (
                <>
                  <div className="font-bold text-gray-900 text-lg">{currentPlan.name} Plan</div>
                  <div className="text-sm text-gray-600">
                    {business.isTrial ? "Trial period mein" : "Paid plan active"}
                    {business.planExpiresAt && (
                      <span className="ml-2">
                        · Expires: <strong>{new Date(business.planExpiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong>
                      </span>
                    )}
                  </div>
                  {daysLeft !== null && (
                    <div className={`text-sm font-medium mt-0.5 ${daysLeft <= 0 ? "text-red-600" : daysLeft <= 15 ? "text-red-500" : "text-green-600"}`}>
                      {daysLeft <= 0 ? "Plan expire ho gaya!" : `${daysLeft} din baaki`}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="font-bold text-gray-900 text-lg">Koi plan active nahi</div>
                  <div className="text-sm text-amber-700">Vendor se voucher code lekar plan activate karo</div>
                </>
              )}
            </div>
          </div>
          {currentPlan && (
            <div className="sm:text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Current limits</div>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="flex items-center gap-1 bg-white rounded-lg px-2.5 py-1 border border-gray-200">
                  <Users className="w-3.5 h-3.5 text-blue-400" /> {currentPlan.maxUsers} users
                </span>
                {currentPlan.maxVouchersPerMonth != null && (
                  <span className="flex items-center gap-1 bg-white rounded-lg px-2.5 py-1 border border-gray-200">
                    <FileText className="w-3.5 h-3.5 text-orange-400" /> {currentPlan.maxVouchersPerMonth}/mo invoices
                  </span>
                )}
                {currentPlan.maxItems != null && (
                  <span className="flex items-center gap-1 bg-white rounded-lg px-2.5 py-1 border border-gray-200">
                    <Package className="w-3.5 h-3.5 text-amber-400" /> {currentPlan.maxItems} items
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Voucher activation */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-5 space-y-3">
        <h3 className="font-semibold text-indigo-800 text-sm flex items-center gap-2">
          <Ticket className="w-4 h-4" /> Voucher Code se Plan Activate Karo
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 border border-indigo-300 rounded-lg px-3 py-2 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="e.g. 0001-X7KQ2P-R9MZ"
            value={voucherCode}
            onChange={e => setVoucherCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && redeemVoucher()}
          />
          <button onClick={redeemVoucher} disabled={redeemLoading || !voucherCode.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {redeemLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
            Activate
          </button>
        </div>
        <p className="text-xs text-indigo-500">Vendor/dealer se mila hua license code yahan daalo</p>
        {redeemResult && (
          <div className={`flex items-start gap-2 text-sm px-3 py-2.5 rounded-lg border ${redeemResult.success ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600"}`}>
            {redeemResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <X className="w-4 h-4 shrink-0 mt-0.5" />}
            {redeemResult.message}
          </div>
        )}
      </div>

      {/* Available Plans */}
      {plans.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Available Plans</h2>
          <div className={`grid gap-4 ${plans.length === 1 ? "grid-cols-1 max-w-sm" : plans.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
            {plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrentPlan={plan.id === business?.planId}
                onActivate={() => {
                  setShowVoucherFor(plan.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  document.querySelector<HTMLInputElement>('input[placeholder*="BAS"]')?.focus();
                }}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center">Plan upgrade karne ke liye vendor se nayi plan ka voucher code maango</p>
        </div>
      )}
    </div>
  );
}
