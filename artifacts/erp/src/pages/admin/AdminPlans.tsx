import { useEffect, useState, useMemo } from "react";
import { api, fmt } from "@/lib/api";
import {
  Plus, Edit2, Trash2, Loader2, X, Building2, CreditCard,
  Users, Wifi, MessageSquare, Clock, Wrench, CheckCircle2, IndianRupee,
  Infinity, CalendarDays, HelpCircle, FileText, Package,
  RefreshCw, Tag,
} from "lucide-react";

type BillingType = "onetime" | "monthly" | "yearly";

interface PackageConfig {
  billingType: BillingType;

  // Users
  adminPrice: number;
  extraUserCount: number;
  extraUserPrice: number;

  // LAN (one-time only)
  lanIncluded: boolean;
  lanClientCount: number;
  lanClientPrice: number;

  // Chat
  chatIncluded: boolean;
  chatPrice: number;

  // Validity (one-time only)
  validityType: "unlimited" | "years";
  validityYears: number;

  // Subscription limits (monthly/yearly)
  maxVouchersPerMonth: number;
  maxItems: number;
  maxParties: number;
  trialDays: number;

  // Maintenance (one-time only)
  maintenanceIncluded: boolean;
  maintenanceExtra: boolean;
  maintenancePrice: number;
  maintenanceCycle: "monthly" | "yearly";
}

const DEFAULT_CFG: PackageConfig = {
  billingType: "onetime",
  adminPrice: 0,
  extraUserCount: 0,
  extraUserPrice: 0,
  lanIncluded: false,
  lanClientCount: 1,
  lanClientPrice: 0,
  chatIncluded: false,
  chatPrice: 0,
  validityType: "unlimited",
  validityYears: 5,
  maxVouchersPerMonth: 0,
  maxItems: 0,
  maxParties: 0,
  trialDays: 0,
  maintenanceIncluded: true,
  maintenanceExtra: false,
  maintenancePrice: 0,
  maintenanceCycle: "yearly",
};

function calcTotal(cfg: PackageConfig): number {
  return (
    cfg.adminPrice +
    cfg.extraUserCount * cfg.extraUserPrice +
    (cfg.lanIncluded ? cfg.lanClientCount * cfg.lanClientPrice : 0) +
    (cfg.chatIncluded ? cfg.chatPrice : 0)
  );
}

function parseConfig(plan: any): PackageConfig | null {
  if (!plan.packageConfig) return null;
  try { return { ...DEFAULT_CFG, ...JSON.parse(plan.packageConfig) }; } catch { return null; }
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const numCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right w-full";

function N(v: number) { return v.toLocaleString("en-IN"); }

const BILLING_LABELS: Record<BillingType, string> = {
  onetime: "One-time (LAN)",
  monthly: "Monthly",
  yearly: "Yearly",
};

export default function AdminPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [cfg, setCfg] = useState<PackageConfig>({ ...DEFAULT_CFG });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = useMemo(() => calcTotal(cfg), [cfg]);
  const maxUsers = 1 + cfg.extraUserCount;

  const load = () => {
    setLoading(true);
    api.get<any>("/super-admin/plans")
      .then(r => setPlans(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditId(null);
    setName(""); setDescription(""); setSortOrder("0");
    setCfg({ ...DEFAULT_CFG });
    setError(""); setShowModal(true);
  };

  const openEdit = (p: any) => {
    setEditId(p.id);
    setName(p.name); setDescription(p.description || ""); setSortOrder(String(p.sortOrder || 0));
    const existing = parseConfig(p);
    setCfg(existing ? { ...DEFAULT_CFG, ...existing } : {
      ...DEFAULT_CFG,
      adminPrice: Number(p.price) || 0,
      extraUserCount: Math.max(0, (p.maxUsers || 1) - 1),
      validityType: p.validityDays >= 36000 ? "unlimited" : "years",
      validityYears: Math.round((p.validityDays || 1825) / 365),
      maxVouchersPerMonth: p.maxVouchersPerMonth || 0,
      maxItems: p.maxItems || 0,
      maxParties: p.maxParties || 0,
      trialDays: p.trialDays || 0,
      billingType: p.billingCycle === "monthly" ? "monthly" : p.billingCycle === "onetime" ? "onetime" : "yearly",
    });
    setError(""); setShowModal(true);
  };

  const set = <K extends keyof PackageConfig>(key: K, val: PackageConfig[K]) =>
    setCfg(c => ({ ...c, [key]: val }));

  const save = async () => {
    if (!name.trim()) { setError("Plan ka naam zaroori hai"); return; }
    if (total <= 0 && cfg.adminPrice <= 0) { setError("Koi bhi price daalni zaroori hai (Admin ya LAN ya Chat)"); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        name: name.trim(), description, sortOrder: Number(sortOrder),
        packageConfig: cfg,
        maxVouchersPerMonth: cfg.maxVouchersPerMonth || null,
        maxItems: cfg.maxItems || null,
        maxParties: cfg.maxParties || null,
        trialDays: cfg.trialDays || 0,
      };
      if (editId) await api.patch(`/super-admin/plans/${editId}`, payload);
      else await api.post("/super-admin/plans", payload);
      setShowModal(false); load();
    } catch (err: any) { setError(err.message || "Save nahi hua"); }
    finally { setSaving(false); }
  };

  const del = async (id: number, hasBusinesses: boolean) => {
    if (hasBusinesses) { alert("Iss plan pe businesses hain — pehle unhe change karo"); return; }
    if (!confirm("Plan delete karna chahte ho?")) return;
    await api.delete(`/super-admin/plans/${id}`);
    load();
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    await api.patch(`/super-admin/plans/${id}`, { isActive: !isActive });
    load();
  };

  const billingColor: Record<BillingType, string> = {
    onetime: "bg-indigo-100 text-indigo-700",
    monthly: "bg-green-100 text-green-700",
    yearly: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="max-w-6xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plans &amp; Packages</h1>
          <p className="text-sm text-gray-500 mt-0.5">LAN aur SaaS dono ke liye plans banao</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" /> Naya Plan
        </button>
      </div>

      {/* Plan Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {plans.map(plan => {
            const pc = parseConfig(plan);
            const bt: BillingType = pc?.billingType || (plan.billingCycle === "monthly" ? "monthly" : plan.billingCycle === "onetime" ? "onetime" : "yearly");
            return (
              <div key={plan.id}
                className={`bg-white rounded-2xl border-2 ${plan.isActive ? "border-indigo-200" : "border-gray-200 opacity-60"} p-5 space-y-4`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${billingColor[bt]}`}>
                        {BILLING_LABELS[bt]}
                      </span>
                      {plan.sortOrder > 0 && <span className="text-[10px] text-gray-400">#{plan.sortOrder}</span>}
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight">{plan.name}</h3>
                    {plan.description && <p className="text-xs text-gray-400 mt-0.5">{plan.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(plan)} className="p-1.5 text-indigo-400 hover:bg-indigo-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => del(plan.id, Number(plan.businessCount) > 0)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className={`rounded-xl px-4 py-3 ${bt === "monthly" ? "bg-green-50" : bt === "yearly" ? "bg-blue-50" : "bg-indigo-50"}`}>
                  <div className={`text-xs font-medium mb-0.5 ${bt === "monthly" ? "text-green-600" : bt === "yearly" ? "text-blue-600" : "text-indigo-500"}`}>
                    {bt === "onetime" ? "One-time Price" : bt === "monthly" ? "Monthly Price" : "Yearly Price"}
                  </div>
                  <div className={`text-2xl font-bold flex items-center gap-1 ${bt === "monthly" ? "text-green-700" : bt === "yearly" ? "text-blue-700" : "text-indigo-700"}`}>
                    <IndianRupee className="w-5 h-5" />{fmt.number(plan.price)}
                  </div>
                </div>

                {pc ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-gray-700">
                      <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-indigo-400" /> 1 Admin</span>
                      {pc.adminPrice > 0 && <span className="font-medium">₹{N(pc.adminPrice)}</span>}
                    </div>
                    {pc.extraUserCount > 0 && (
                      <div className="flex items-center justify-between text-gray-600">
                        <span className="pl-5 text-xs">+ {pc.extraUserCount} user{pc.extraUserCount > 1 ? "s" : ""} × ₹{N(pc.extraUserPrice)}</span>
                        <span className="text-xs font-medium">₹{N(pc.extraUserCount * pc.extraUserPrice)}</span>
                      </div>
                    )}
                    {pc.lanIncluded ? (
                      <div className="flex items-center justify-between text-gray-700">
                        <span className="flex items-center gap-1.5"><Wifi className="w-3.5 h-3.5 text-green-500" /> LAN ({pc.lanClientCount} client{pc.lanClientCount > 1 ? "s" : ""})</span>
                        <span className="font-medium">₹{N(pc.lanClientCount * pc.lanClientPrice)}</span>
                      </div>
                    ) : bt === "onetime" ? (
                      <div className="flex items-center gap-1.5 text-gray-400 text-xs"><Wifi className="w-3.5 h-3.5" /> LAN — Not included</div>
                    ) : null}
                    {pc.chatIncluded ? (
                      <div className="flex items-center justify-between text-gray-700">
                        <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-purple-500" /> Chat + File Share</span>
                        <span className="font-medium">₹{N(pc.chatPrice)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-gray-400 text-xs"><MessageSquare className="w-3.5 h-3.5" /> Chat — Not included</div>
                    )}
                    <div className="border-t border-gray-100 pt-2 space-y-1">
                      {bt === "onetime" ? (
                        <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                          {pc.validityType === "unlimited"
                            ? <><Infinity className="w-3.5 h-3.5 text-emerald-500" /> Lifetime — Unlimited</>
                            : <><CalendarDays className="w-3.5 h-3.5 text-blue-500" /> {pc.validityYears} Year{pc.validityYears > 1 ? "s" : ""} Validity</>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                          <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                          {bt === "monthly" ? "Monthly subscription" : "Yearly subscription"}
                          {pc.trialDays > 0 && ` · ${pc.trialDays}d trial`}
                        </div>
                      )}
                      {(pc.maxVouchersPerMonth > 0 || pc.maxItems > 0 || pc.maxParties > 0) && (
                        <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                          <FileText className="w-3.5 h-3.5 text-orange-400" />
                          {[
                            pc.maxVouchersPerMonth > 0 ? `${pc.maxVouchersPerMonth} invoices/mo` : null,
                            pc.maxItems > 0 ? `${pc.maxItems} items` : null,
                            pc.maxParties > 0 ? `${pc.maxParties} parties` : null,
                          ].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      {bt === "onetime" && (
                        <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                          <Wrench className="w-3.5 h-3.5 text-orange-400" />
                          {pc.maintenanceIncluded
                            ? "Maintenance — Included"
                            : pc.maintenanceExtra
                              ? `Maintenance — ₹${N(pc.maintenancePrice)}/${pc.maintenanceCycle === "monthly" ? "month" : "year"} extra`
                              : "Maintenance — Not included"}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                        <Users className="w-3.5 h-3.5 text-gray-400" /> Max {maxUsers} → {1 + pc.extraUserCount} user{(1 + pc.extraUserCount) > 1 ? "s" : ""}
                        {pc.lanIncluded && ` + ${pc.lanClientCount} LAN`}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-indigo-400" /> Max {plan.maxUsers} users</div>
                    <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-blue-400" /> {plan.validityDays >= 36000 ? "Lifetime" : `${plan.validityDays} days`}</div>
                    {plan.maxVouchersPerMonth > 0 && <div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-orange-400" /> {plan.maxVouchersPerMonth} invoices/month</div>}
                    {(plan.features || []).map((f: string, i: number) => (
                      <div key={i} className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />{f}</div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Building2 className="w-3.5 h-3.5" /> {plan.businessCount || 0} businesses
                  </div>
                  <button onClick={() => toggleActive(plan.id, plan.isActive)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${plan.isActive
                      ? "bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600"
                      : "bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700"}`}>
                    {plan.isActive ? "Active" : "Inactive"}
                  </button>
                </div>
              </div>
            );
          })}
          {plans.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <div className="font-medium">Abhi koi plan nahi hai</div>
              <button onClick={openCreate} className="text-indigo-600 text-sm mt-1">Pehla plan banao →</button>
            </div>
          )}
        </div>
      )}

      {/* ─── Package Builder Modal ─── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[94vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10 rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-500" />
                {editId ? "Plan Edit Karo" : "Naya Plan Banao"}
              </h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Plan Name + Sort */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Plan ka Naam *</label>
                  <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Basic LAN, Pro, Enterprise" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                  <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-1">
                    Sort Order
                    <span title="Chote number pehle dikhta hai. 0 = top pe. Plans order karne ke liye use karo." className="text-gray-400 cursor-help"><HelpCircle className="w-3.5 h-3.5" /></span>
                  </label>
                  <input type="number" min="0" className={inputCls} value={sortOrder} onChange={e => setSortOrder(e.target.value)} placeholder="0" />
                </div>
              </div>

              {/* BILLING TYPE */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Plan Type</p>
                <div className="flex gap-2">
                  {(["onetime", "monthly", "yearly"] as BillingType[]).map(bt => (
                    <button key={bt} type="button"
                      onClick={() => set("billingType", bt)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${cfg.billingType === bt ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-600 hover:border-indigo-300"}`}>
                      {bt === "onetime" ? "🖥 One-time" : bt === "monthly" ? "📅 Monthly" : "📆 Yearly"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  {cfg.billingType === "onetime"
                    ? "LAN server ke liye ek baar ka payment. Validity years mein."
                    : cfg.billingType === "monthly"
                      ? "Cloud SaaS — har mahine ka subscription."
                      : "Cloud SaaS — saal bhar ka subscription."}
                </p>
              </div>

              {/* USERS */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Users</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Admin User Price (₹) <span className="text-gray-400">(0 = free/included)</span></label>
                    <input type="number" min="0" className={numCls} value={cfg.adminPrice || ""}
                      onChange={e => set("adminPrice", Number(e.target.value))} placeholder="0" />
                  </div>
                  <div className="text-xs text-blue-600 flex items-end pb-2">1 Admin — always included</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Extra Users (kitne?)</label>
                    <input type="number" min="0" className={numCls} value={cfg.extraUserCount || ""}
                      onChange={e => set("extraUserCount", Number(e.target.value))} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Price per user (₹)</label>
                    <input type="number" min="0" className={numCls} value={cfg.extraUserPrice || ""}
                      onChange={e => set("extraUserPrice", Number(e.target.value))} placeholder="0" />
                  </div>
                </div>
                {cfg.extraUserCount > 0 && (
                  <p className="text-xs text-blue-600 text-right">
                    {cfg.extraUserCount} user{cfg.extraUserCount > 1 ? "s" : ""} × ₹{N(cfg.extraUserPrice)} = <strong>₹{N(cfg.extraUserCount * cfg.extraUserPrice)}</strong>
                  </p>
                )}
              </div>

              {/* LAN — only for one-time */}
              {cfg.billingType === "onetime" && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-green-700 uppercase tracking-wide flex items-center gap-1.5"><Wifi className="w-3.5 h-3.5" /> LAN Connection</p>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="radio" checked={!cfg.lanIncluded} onChange={() => set("lanIncluded", false)} className="accent-green-600" />
                      Not Included
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-green-700">
                      <input type="radio" checked={cfg.lanIncluded} onChange={() => set("lanIncluded", true)} className="accent-green-600" />
                      Included
                    </label>
                  </div>
                  {cfg.lanIncluded && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">LAN Clients (kitne?)</label>
                        <input type="number" min="1" className={numCls} value={cfg.lanClientCount || ""}
                          onChange={e => set("lanClientCount", Number(e.target.value))} placeholder="1" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Price per client (₹)</label>
                        <input type="number" min="0" className={numCls} value={cfg.lanClientPrice || ""}
                          onChange={e => set("lanClientPrice", Number(e.target.value))} placeholder="0" />
                      </div>
                      <p className="col-span-2 text-xs text-green-700 text-right">
                        {cfg.lanClientCount} client{cfg.lanClientCount > 1 ? "s" : ""} × ₹{N(cfg.lanClientPrice)} = <strong>₹{N(cfg.lanClientCount * cfg.lanClientPrice)}</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* CHAT */}
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-purple-700 uppercase tracking-wide flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Chat + File Share</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" checked={!cfg.chatIncluded} onChange={() => set("chatIncluded", false)} className="accent-purple-600" />
                    Not Included
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-purple-700">
                    <input type="radio" checked={cfg.chatIncluded} onChange={() => set("chatIncluded", true)} className="accent-purple-600" />
                    Included
                  </label>
                </div>
                {cfg.chatIncluded && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Price (₹) — {cfg.billingType === "onetime" ? "one-time" : cfg.billingType === "monthly" ? "per month" : "per year"}
                    </label>
                    <input type="number" min="0" className={numCls} value={cfg.chatPrice || ""}
                      onChange={e => set("chatPrice", Number(e.target.value))} placeholder="0" />
                  </div>
                )}
              </div>

              {/* VALIDITY — one-time only */}
              {cfg.billingType === "onetime" && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-orange-700 uppercase tracking-wide flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Validity</p>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-orange-700">
                      <input type="radio" checked={cfg.validityType === "unlimited"} onChange={() => set("validityType", "unlimited")} className="accent-orange-500" />
                      <Infinity className="w-4 h-4 text-orange-500" /> Unlimited (Lifetime)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="radio" checked={cfg.validityType === "years"} onChange={() => set("validityType", "years")} className="accent-orange-500" />
                      Years
                    </label>
                  </div>
                  {cfg.validityType === "years" && (
                    <div className="max-w-[140px]">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Kitne saal?</label>
                      <input type="number" min="1" max="99" className={numCls} value={cfg.validityYears || ""}
                        onChange={e => set("validityYears", Number(e.target.value))} placeholder="5" />
                    </div>
                  )}
                </div>
              )}

              {/* INVOICE + LIMITS — monthly/yearly */}
              {cfg.billingType !== "onetime" && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Limits (0 = unlimited)</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Invoices/month</label>
                      <input type="number" min="0" className={numCls} value={cfg.maxVouchersPerMonth || ""}
                        onChange={e => set("maxVouchersPerMonth", Number(e.target.value))} placeholder="∞" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Max Items</label>
                      <input type="number" min="0" className={numCls} value={cfg.maxItems || ""}
                        onChange={e => set("maxItems", Number(e.target.value))} placeholder="∞" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Max Parties</label>
                      <input type="number" min="0" className={numCls} value={cfg.maxParties || ""}
                        onChange={e => set("maxParties", Number(e.target.value))} placeholder="∞" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Trial Days (0 = no trial)</label>
                    <div className="max-w-[140px]">
                      <input type="number" min="0" max="365" className={numCls} value={cfg.trialDays || ""}
                        onChange={e => set("trialDays", Number(e.target.value))} placeholder="0" />
                    </div>
                  </div>
                </div>
              )}

              {/* MAINTENANCE — one-time only */}
              {cfg.billingType === "onetime" && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5" /> Maintenance</p>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                      <input type="radio" checked={cfg.maintenanceIncluded} onChange={() => { set("maintenanceIncluded", true); set("maintenanceExtra", false); }} className="accent-gray-600" />
                      Included (free)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="radio" checked={cfg.maintenanceExtra} onChange={() => { set("maintenanceIncluded", false); set("maintenanceExtra", true); }} className="accent-gray-600" />
                      Extra charge
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
                      <input type="radio" checked={!cfg.maintenanceIncluded && !cfg.maintenanceExtra}
                        onChange={() => { set("maintenanceIncluded", false); set("maintenanceExtra", false); }} className="accent-gray-400" />
                      Not offered
                    </label>
                  </div>
                  {cfg.maintenanceExtra && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Rate (₹)</label>
                        <input type="number" min="0" className={numCls} value={cfg.maintenancePrice || ""}
                          onChange={e => set("maintenancePrice", Number(e.target.value))} placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Cycle</label>
                        <select className={inputCls} value={cfg.maintenanceCycle}
                          onChange={e => set("maintenanceCycle", e.target.value as any)}>
                          <option value="monthly">Per Month</option>
                          <option value="yearly">Per Year</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TOTAL */}
              <div className={`rounded-xl px-5 py-4 flex items-center justify-between ${cfg.billingType === "monthly" ? "bg-green-600" : cfg.billingType === "yearly" ? "bg-blue-600" : "bg-indigo-600"}`}>
                <div>
                  <div className="text-white/70 text-xs font-medium">
                    {cfg.billingType === "onetime" ? "One-time Total" : cfg.billingType === "monthly" ? "Monthly Total" : "Yearly Total"}
                  </div>
                  <div className="text-white text-3xl font-bold">₹{N(total)}</div>
                  <div className="text-white/60 text-xs mt-0.5">
                    {1 + cfg.extraUserCount} user{(1 + cfg.extraUserCount) > 1 ? "s" : ""}
                    {cfg.lanIncluded ? ` + ${cfg.lanClientCount} LAN` : ""}
                    {cfg.chatIncluded ? " + Chat" : ""}
                    {" · "}
                    {cfg.billingType === "onetime"
                      ? cfg.validityType === "unlimited" ? "Lifetime" : `${cfg.validityYears}yr`
                      : cfg.billingType === "monthly" ? "Monthly" : "Yearly"}
                    {cfg.billingType === "onetime" && cfg.maintenanceIncluded ? " · Maintenance incl." : ""}
                  </div>
                </div>
                <IndianRupee className="w-10 h-10 text-white/30" />
              </div>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving}
                className={`flex items-center gap-2 px-5 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-60 ${cfg.billingType === "monthly" ? "bg-green-600 hover:bg-green-700" : cfg.billingType === "yearly" ? "bg-blue-600 hover:bg-blue-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Plan Save Karo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
