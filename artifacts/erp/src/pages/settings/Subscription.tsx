import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  CreditCard, Check, Users, FileText, Package, Building2,
  Calendar, AlertCircle, Clock, Ticket, Loader2, X, CheckCircle2, Crown, Zap,
  Gift, Copy, Share2, Trophy, Star, History, RotateCcw, Monitor, MessageSquare,
} from "lucide-react";

const MODULE_LABELS: Record<string, string> = {
  sales: "Sales & Invoicing", purchases: "Purchases & Bills",
  payments: "Payments", inventory: "Inventory",
  accounting: "Accounting & Ledger", gst: "GST Reports",
  masters: "Masters (Items/Parties)", settings: "Settings & Users",
};

const MODULE_KEYS = Object.keys(MODULE_LABELS);
function parseLan(feats: string[]): number { const f = feats?.find(x => x.startsWith("LAN:")); return f ? (parseInt(f.match(/(\d+)/)?.[1] || "0") || 0) : 0; }
function hasChat(feats: string[]): boolean { return (feats || []).includes("Chat: included"); }

function PlanCard({ plan, isCurrentPlan, onActivate }: { plan: any; isCurrentPlan: boolean; onActivate: () => void }) {
  const isPro = plan.price > 0 && plan.maxUsers >= 10;
  const feats: string[] = plan.features || [];
  const lan = parseLan(feats);
  const chat = hasChat(feats);
  const moduleFeats = feats.filter(f => MODULE_KEYS.includes(f));
  const hasModules = moduleFeats.length > 0;
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
            <CheckCircle2 className="w-3 h-3" /> Your Current Plan
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
            <div className="text-xs text-gray-400">
              /{plan.billingCycle === "monthly" ? "mahina" : (plan.billingCycle === "onetime" || (plan.validityDays && plan.validityDays >= 1000)) ? "OneTime" : "saal"}
            </div>
          )}
        </div>
      </div>
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
      {(lan > 0 || chat) && (
        <div className="space-y-1.5 pt-2 border-t border-gray-100">
          {lan > 0 && (
            <div className="flex items-center gap-2 text-sm text-indigo-700">
              <Monitor className="w-3.5 h-3.5 shrink-0" /> LAN: {lan} clients
            </div>
          )}
          {chat && (
            <div className="flex items-center gap-2 text-sm text-teal-700">
              <MessageSquare className="w-3.5 h-3.5 shrink-0" /> Chat included
            </div>
          )}
        </div>
      )}
      {hasModules && (
        <div className="space-y-1 pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Modules</p>
          <div className="grid grid-cols-2 gap-1">
            {MODULE_KEYS.map(mod => {
              const has = feats.includes(mod);
              return (
                <div key={mod} className={`flex items-center gap-1.5 text-xs ${has ? "text-gray-700" : "text-gray-300"}`}>
                  {has ? <Check className="w-3 h-3 text-green-500 shrink-0" /> : <X className="w-3 h-3 text-gray-200 shrink-0" />}
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
            ${isPro ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "border-2 border-gray-300 hover:border-indigo-400 text-gray-700 hover:text-indigo-700"}`}>
          <Zap className="w-4 h-4" /> Enter voucher code for this plan
        </button>
      )}
    </div>
  );
}

function ReferralSection() {
  const [referral, setReferral] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    api.get<any>("/businesses/referral-status").then(setReferral).catch(() => {});
  }, []);

  const copyCode = () => {
    if (!referral?.referralCode) return;
    navigator.clipboard.writeText(referral.referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareMsg = () => {
    if (!referral?.referralCode) return;
    const msg = `I'm using BizCor ERP — India's best business software!\n\nRegister with this referral code and use it free:\n🎁 Code: ${referral.referralCode}\n🔗 https://erp.naewtgroup.com/register`;
    if (navigator.share) {
      navigator.share({ text: msg }).then(() => setShared(true)).catch(() => {});
    } else {
      navigator.clipboard.writeText(msg).then(() => { setShared(true); setTimeout(() => setShared(false), 2000); });
    }
  };

  if (!referral) return null;

  const { referralCode, referralCount, rewardCount, progressToNext, maxRewardsReached } = referral;
  const pct = Math.min(100, (progressToNext / 5) * 100);

  return (
    <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 rounded-2xl border-2 border-emerald-200 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Gift className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-base">Referral Program</h3>
            <p className="text-xs text-gray-500">Invite friends — earn a free plan</p>
          </div>
        </div>
        {rewardCount > 0 && (
          <div className="flex items-center gap-1 bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            <Trophy className="w-3 h-3" /> {rewardCount}/2 rewards
          </div>
        )}
      </div>

      {/* Reward explanation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { step: "1", title: "Share", desc: "Send your referral code to friends", icon: <Share2 className="w-4 h-4 text-emerald-600" /> },
          { step: "2", title: "5 people register", desc: "They enter your code at registration", icon: <Users className="w-4 h-4 text-blue-500" /> },
          { step: "3", title: "Earn Referral Plan!", desc: "Your plan auto-activates — congratulations!", icon: <Trophy className="w-4 h-4 text-yellow-500" /> },
        ].map(s => (
          <div key={s.step} className="bg-white/70 rounded-xl p-3 flex items-start gap-2.5 border border-emerald-100">
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0 mt-0.5">{s.step}</div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">{s.icon}<span className="text-sm font-semibold text-gray-800">{s.title}</span></div>
              <p className="text-xs text-gray-500">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Your Code */}
      <div className="bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Your Referral Code</p>
            <div className="text-3xl font-black tracking-[0.2em] text-emerald-700 font-mono">{referralCode}</div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={copyCode}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button onClick={shareMsg}
              className="flex items-center gap-1.5 px-3 py-2 border border-emerald-300 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-50 transition-colors">
              {shared ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {shared ? "Shared!" : "Share"}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {!maxRewardsReached && (
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>Progress to next reward</span>
              <span className="font-semibold text-emerald-700">{progressToNext}/5 referrals</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {5 - progressToNext} more referral{5 - progressToNext === 1 ? "" : "s"} needed → Earn Referral Plan free
              {rewardCount === 0 && referralCount === 0 ? " (get started!)" : ""}
            </p>
          </div>
        )}

        {maxRewardsReached && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm text-yellow-800">
            <Star className="w-4 h-4 text-yellow-500 shrink-0" />
            <span>You've claimed both referral rewards — thank you! 🎉</span>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Referrals", value: String(referralCount), color: "text-blue-600" },
          { label: "Rewards Earned", value: `${rewardCount}/2`, color: "text-emerald-600" },
          { label: "Bonus Days", value: String(referral.bonusDaysAdded || 0), color: "text-purple-600" },
        ].map(s => (
          <div key={s.label} className="bg-white/70 rounded-xl p-3 text-center border border-emerald-100">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Referral Plan is awarded when your code is used — share it directly
      </p>
    </div>
  );
}

// Detect desktop EXE mode — window.bizcorDesktop is injected by Electron preload only
// Never present in browser (erp.naewtgroup.com), always present in EXE
const IS_OFFLINE = !!(window as any).bizcorDesktop;
const SUPPORT_EMAIL = "support@naewtgroup.com";

export default function Subscription() {
  const [business, setBusiness] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [voucherCode, setVoucherCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showVoucherFor, setShowVoucherFor] = useState<number | null>(null);
  const [myVoucher, setMyVoucher] = useState<{ code: string | null; redeemedAt: string | null } | null>(null);
  const [voucherCopied, setVoucherCopied] = useState(false);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [activateMsg, setActivateMsg] = useState<{ id: number; msg: string; ok: boolean } | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<any>("/businesses/current"),
      api.get<any[]>("/public-plans"),
    ]).then(([b, pl]) => {
      setBusiness(b);
      setPlans(Array.isArray(pl) ? pl : []);
    }).catch(console.error).finally(() => setLoading(false));
    api.get<any>("/businesses/my-voucher").then(setMyVoucher).catch(() => {});
    setSubsLoading(true);
    api.get<any>("/businesses/my-subscriptions")
      .then(r => setSubscriptions(Array.isArray(r.data) ? r.data : []))
      .catch(() => setSubscriptions([]))
      .finally(() => setSubsLoading(false));
  };

  useEffect(() => { load(); }, []);

  const activatePlan = async (sub: any) => {
    if (sub.isExpired) return;
    setActivatingId(sub.id);
    setActivateMsg(null);
    try {
      const r = await api.post<any>(`/businesses/activate-plan/${sub.id}`, {});
      if (r.token) localStorage.setItem("erp_token", r.token);
      setActivateMsg({ id: sub.id, msg: r.message || "Plan activate ho gaya!", ok: true });
      load();
      // Reload so new token (with correct planExpiresAt) takes effect everywhere
      if (r.token) setTimeout(() => window.location.reload(), 1000);
    } catch (e: any) {
      setActivateMsg({ id: sub.id, msg: e.message || "Error", ok: false });
    } finally { setActivatingId(null); }
  };

  const redeemVoucher = async () => {
    if (!voucherCode.trim()) return;
    setRedeemLoading(true);
    setRedeemResult(null);
    try {
      if (IS_OFFLINE) {
        // Collect hardware fingerprint from Electron IPC
        let hardwareFingerprint: any = null;
        try {
          const desktop = (window as any).bizcorDesktop;
          if (desktop?.getHardwareInfo) hardwareFingerprint = await desktop.getHardwareInfo();
        } catch { /* not in Electron */ }

        // Offline EXE: validate via cloud, update local SQLite, get fresh token
        const res = await api.post<any>("/redeem-voucher-offline", {
          code: voucherCode.trim(),
          hardwareFingerprint,
        });
        // Save fresh token so planExpiresAt updates immediately (no re-login needed)
        if (res.token) localStorage.setItem("erp_token", res.token);
        setRedeemResult({ success: true, message: res.message });
        setVoucherCode(""); setShowVoucherFor(null);
        load();
      } else {
        // Cloud: direct redemption
        const res = await api.post<any>("/redeem-voucher", { code: voucherCode.trim() });
        // Save fresh token so planExpiresAt updates immediately (no re-login needed)
        if (res.token) localStorage.setItem("erp_token", res.token);
        setRedeemResult({ success: true, message: res.message });
        setVoucherCode(""); setShowVoucherFor(null);
        load();
      }
    } catch (err: any) {
      setRedeemResult({ success: false, message: err.message || "Voucher redeem nahi ho saka" });
    } finally { setRedeemLoading(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
    </div>
  );

  const daysLeft = business?.planExpiresAt
    ? Math.ceil((new Date(business.planExpiresAt).getTime() - Date.now()) / 86400000)
    : null;

  // Find current plan — first check public active plans, then fall back to subscriptions history
  // (plan may have been deactivated in tech panel but business still has valid planExpiresAt)
  let currentPlan: any = plans.find(p => p.id === business?.planId) || null;
  if (!currentPlan && business?.planId && daysLeft !== null && daysLeft > 0) {
    const matchingSub = subscriptions.find(s => s.planId === business.planId);
    if (matchingSub) {
      currentPlan = {
        id: matchingSub.planId,
        name: matchingSub.planName,
        billingCycle: "yearly",
        price: 0,
        maxUsers: matchingSub.maxUsers || 1,
        features: [],
        _fromHistory: true,
      };
    } else {
      // planId set but no matching subscription — still show as active
      currentPlan = {
        id: business.planId,
        name: "Active Plan",
        billingCycle: "yearly",
        price: 0,
        maxUsers: 1,
        features: [],
        _fromHistory: true,
      };
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-indigo-500" /> My Subscription
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Your current plan, referral program and available plans</p>
      </div>

      {/* Current Plan Status */}
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
                    {business.isTrial ? "On trial period" : "Paid plan active"}
                    {business.planExpiresAt && (
                      <span className="ml-2">
                        · Expires: <strong>{new Date(business.planExpiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong>
                      </span>
                    )}
                  </div>
                  {daysLeft !== null && (
                    <div className={`text-sm font-medium mt-0.5 ${daysLeft <= 0 ? "text-red-600" : daysLeft <= 15 ? "text-red-500" : "text-green-600"}`}>
                      {daysLeft <= 0 ? "Plan expired!" : `${daysLeft} days remaining`}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="font-bold text-gray-900 text-lg">No active plan</div>
                  <div className="text-sm text-amber-700">Get a voucher code from your vendor to activate a plan</div>
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

      {/* My License Code (show if voucher was activated) */}
      {myVoucher?.code && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Ticket className="w-5 h-5 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-blue-500 font-medium">Mera License Code</p>
              <p className="text-lg font-black font-mono tracking-widest text-blue-800 truncate">{myVoucher.code}</p>
              {myVoucher.redeemedAt && (
                <p className="text-xs text-blue-400 mt-0.5">
                  Activated: {new Date(myVoucher.redeemedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(myVoucher.code!).then(() => {
                setVoucherCopied(true);
                setTimeout(() => setVoucherCopied(false), 2000);
              });
            }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            {voucherCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {voucherCopied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      {/* ── My Plans — Subscription History ─────────────────────────────── */}
      <div className="space-y-3">
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-500" /> Mere Plans
            {!subsLoading && subscriptions.length > 0 && (
              <span className="text-xs text-gray-400 font-normal ml-1">({subscriptions.length})</span>
            )}
          </h2>
          {subsLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-6 text-center text-sm text-gray-400">
              Abhi koi plan activate nahi hai.<br />
              <span className="text-xs">Neeche voucher code enter kar ke plan activate karo.</span>
            </div>
          ) : (
          <>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 rounded-xl">
            {subscriptions.map(sub => {
              const redeemedDate = sub.redeemedAt ? new Date(sub.redeemedAt) : null;
              const expiresDate = sub.expiresAt ? new Date(sub.expiresAt) : null;
              const daysRemaining = expiresDate
                ? Math.ceil((expiresDate.getTime() - Date.now()) / 86400000)
                : null;
              const isCurrentlyActive = sub.isActive;
              const isExpired = sub.isExpired;
              const isActivating = activatingId === sub.id;

              return (
                <div
                  key={sub.id}
                  className={`rounded-xl border p-3.5 flex items-start gap-3 transition-all ${
                    isCurrentlyActive
                      ? "border-green-400 bg-green-50 shadow-sm"
                      : isExpired
                      ? "border-gray-200 bg-gray-50 opacity-70"
                      : "border-indigo-200 bg-white hover:border-indigo-300"
                  }`}
                >
                  {/* Status icon */}
                  <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                    isCurrentlyActive ? "bg-green-100" : isExpired ? "bg-gray-100" : "bg-indigo-50"
                  }`}>
                    {isCurrentlyActive
                      ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                      : isExpired
                      ? <Clock className="w-4 h-4 text-gray-400" />
                      : <Crown className="w-4 h-4 text-indigo-500" />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{sub.planName}</span>
                      {isCurrentlyActive && (
                        <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-semibold">Active</span>
                      )}
                      {isExpired && (
                        <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded-full">Expired</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                      <span className="font-mono font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded tracking-wider">
                        {sub.code}
                      </span>
                      {sub.maxUsers && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {sub.maxUsers} users
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {sub.validityDays} din
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs">
                      {redeemedDate && (
                        <span className="text-gray-400">
                          Activated: {redeemedDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                      {expiresDate && (
                        <span className={daysRemaining !== null && daysRemaining <= 0 ? "text-red-500" : daysRemaining !== null && daysRemaining <= 15 ? "text-orange-500 font-medium" : "text-gray-400"}>
                          Expires: {expiresDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          {daysRemaining !== null && daysRemaining > 0 && ` (${daysRemaining}d baki)`}
                          {daysRemaining !== null && daysRemaining <= 0 && " · Expired"}
                        </span>
                      )}
                    </div>

                    {activateMsg?.id === sub.id && (
                      <div className={`mt-1.5 text-xs px-2 py-1 rounded-lg ${activateMsg?.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                        {activateMsg?.msg}
                      </div>
                    )}
                  </div>

                  {/* Activate button */}
                  {!isExpired && !isCurrentlyActive && (
                    <button
                      onClick={() => activatePlan(sub)}
                      disabled={isActivating}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
                    >
                      {isActivating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      Switch
                    </button>
                  )}
                  {isCurrentlyActive && (
                    <span className="shrink-0 text-xs text-green-600 font-semibold px-2 py-1.5 bg-green-100 rounded-lg">
                      ✓ Using
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400">Expired plans automatically delete hote hain 30 din baad · Kisi bhi valid plan ko switch kar sakte hain</p>
          </>
          )}
        </div>

      {/* Support contact — desktop exe only */}
      {IS_OFFLINE && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">License bhool gaye ya koi problem hai?</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Email karo: <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline hover:text-amber-900">{SUPPORT_EMAIL}</a>
            </p>
          </div>
        </div>
      )}

      {/* Referral Program */}
      <ReferralSection />

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
        <p className="text-xs text-indigo-500">Enter the license code received from your vendor/dealer</p>
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
                }}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center">To upgrade your plan, ask your vendor for a new plan voucher code</p>
        </div>
      )}
    </div>
  );
}
