import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import {
  Plus, Edit2, Trash2, Loader2, X, Building2, CreditCard,
  Users, Clock, CheckCircle2, IndianRupee, FileText, Monitor, MessageSquare, LayoutTemplate,
} from "lucide-react";

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

type BillingUI = "monthly" | "yearly" | "onetime";

const BILLING_LABELS: Record<string, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
  onetime: "One-time",
};
const BILLING_COLORS: Record<string, string> = {
  monthly: "bg-green-100 text-green-700",
  yearly: "bg-blue-100 text-blue-700",
  onetime: "bg-purple-100 text-purple-700",
};

// Detect billing display type from plan data
function getBillingUI(plan: any): BillingUI {
  if (plan.billingCycle === "monthly") return "monthly";
  // yearly + validityDays > 400 → onetime
  if (plan.billingCycle === "yearly" && (plan.validityDays || 0) > 400) return "onetime";
  return "yearly";
}

// Parse LAN clients count from features array
function parseLanClients(feats: string[]): string {
  const f = feats.find(x => x.startsWith("LAN:"));
  if (!f) return "0";
  const m = f.match(/(\d+)/);
  return m ? m[1] : "0";
}

// Parse chat from features array
function parseChatIncluded(feats: string[]): boolean {
  return feats.some(x => x === "Chat: included");
}

// Parse report designer from features array
function parseReportDesignerIncluded(feats: string[]): boolean {
  return feats.some(x => x === "Report Designer: included");
}

// Strip managed features from general textarea
function stripManagedFeatures(feats: string[]): string[] {
  return feats.filter(f => !f.startsWith("LAN:") && f !== "Chat: included" && f !== "Report Designer: included");
}

export default function AdminPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [billingCycle, setBillingCycle] = useState<BillingUI>("onetime");
  const [maxUsers, setMaxUsers] = useState("1");
  const [validityDays, setValidityDays] = useState("1825");
  const [trialDays, setTrialDays] = useState("0");
  const [maxVouchersPerMonth, setMaxVouchersPerMonth] = useState("");
  const [maxItems, setMaxItems] = useState("");
  const [maxParties, setMaxParties] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [features, setFeatures] = useState("");
  const [lanClients, setLanClients] = useState("0");
  const [chatIncluded, setChatIncluded] = useState(false);
  const [reportDesignerIncluded, setReportDesignerIncluded] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () => {
    setLoading(true);
    api.get<any>(`/super-admin/plans?_=${Date.now()}`)
      .then(r => setPlans(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditId(null);
    setName(""); setDescription(""); setPrice("0");
    setBillingCycle("onetime"); setMaxUsers("1");
    setValidityDays("1825"); setTrialDays("0");
    setMaxVouchersPerMonth(""); setMaxItems(""); setMaxParties("");
    setSortOrder("0"); setFeatures("");
    setLanClients("0"); setChatIncluded(false); setReportDesignerIncluded(false);
    setError(""); setShowModal(true);
  };

  const openEdit = (p: any) => {
    setEditId(p.id);
    setName(p.name); setDescription(p.description || "");
    setPrice(String(p.price || 0));
    setBillingCycle(getBillingUI(p));
    setMaxUsers(String(p.maxUsers || 1));
    setValidityDays(String(p.validityDays || 1825));
    setTrialDays(String(p.trialDays || 0));
    setMaxVouchersPerMonth(p.maxVouchersPerMonth ? String(p.maxVouchersPerMonth) : "");
    setMaxItems(p.maxItems ? String(p.maxItems) : "");
    setMaxParties(p.maxParties ? String(p.maxParties) : "");
    setSortOrder(String(p.sortOrder || 0));
    const allFeats: string[] = p.features || [];
    setLanClients(parseLanClients(allFeats));
    setChatIncluded(parseChatIncluded(allFeats));
    setReportDesignerIncluded(parseReportDesignerIncluded(allFeats));
    setFeatures(stripManagedFeatures(allFeats).join("\n"));
    setError(""); setShowModal(true);
  };

  const save = async () => {
    if (!name.trim()) { setError("Plan ka naam zaroori hai"); return; }
    setSaving(true); setError("");
    try {
      // Build features list: general features + LAN + Chat
      const generalFeats = features.split("\n").map(f => f.trim()).filter(Boolean);
      const lan = parseInt(lanClients) || 0;
      if (lan > 0) generalFeats.push(`LAN: ${lan} clients`);
      if (chatIncluded) generalFeats.push("Chat: included");
      if (reportDesignerIncluded) generalFeats.push("Report Designer: included");

      const payload = {
        name: name.trim(),
        description,
        price: Number(price) || 0,
        // "onetime" maps to "yearly" in DB (enum only has monthly/yearly)
        billingCycle: billingCycle === "onetime" ? "yearly" : billingCycle,
        maxUsers: Number(maxUsers) || 1,
        validityDays: Number(validityDays) || 1825,
        trialDays: Number(trialDays) || 0,
        maxVouchersPerMonth: maxVouchersPerMonth ? Number(maxVouchersPerMonth) : null,
        maxItems: maxItems ? Number(maxItems) : null,
        maxParties: maxParties ? Number(maxParties) : null,
        sortOrder: Number(sortOrder) || 0,
        features: generalFeats,
      };
      if (editId) await api.patch(`/super-admin/plans/${editId}`, payload);
      else await api.post("/super-admin/plans", payload);
      setShowModal(false);
      setSuccess(`"${name.trim()}" save ho gaya ✓`);
      setTimeout(() => setSuccess(""), 4000);
      load();
    } catch (err: any) {
      const msg = err?.message || "Save nahi hua";
      setError(`Error: ${msg}`);
    }
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

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plans</h1>
          <p className="text-sm text-gray-500 mt-0.5">Subscription plans manage karo</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" /> Naya Plan
        </button>
      </div>

      {success && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {plans.map(plan => {
            const bcUI = getBillingUI(plan);
            const allFeats: string[] = plan.features || [];
            const lan = parseInt(parseLanClients(allFeats)) || 0;
            const chat = parseChatIncluded(allFeats);
            const reportDesigner = parseReportDesignerIncluded(allFeats);
            const otherFeats = stripManagedFeatures(allFeats);
            return (
              <div key={plan.id}
                className={`bg-white rounded-2xl border-2 ${plan.isActive ? "border-indigo-200" : "border-gray-200 opacity-60"} p-5 space-y-4`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${BILLING_COLORS[bcUI] || "bg-gray-100 text-gray-700"}`}>
                        {BILLING_LABELS[bcUI] || bcUI}
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

                <div className={`rounded-xl px-4 py-3 ${bcUI === "monthly" ? "bg-green-50" : bcUI === "onetime" ? "bg-purple-50" : "bg-blue-50"}`}>
                  <div className={`text-xs font-medium mb-0.5 ${bcUI === "monthly" ? "text-green-600" : bcUI === "onetime" ? "text-purple-600" : "text-blue-600"}`}>
                    {bcUI === "monthly" ? "Monthly Price" : bcUI === "onetime" ? "One-time Price" : "Yearly Price"}
                  </div>
                  <div className={`text-2xl font-bold flex items-center gap-1 ${bcUI === "monthly" ? "text-green-700" : bcUI === "onetime" ? "text-purple-700" : "text-blue-700"}`}>
                    <IndianRupee className="w-5 h-5" />{fmt.number(plan.price)}
                  </div>
                </div>

                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-indigo-400" /> Max {plan.maxUsers} user{plan.maxUsers > 1 ? "s" : ""}</div>
                  <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-blue-400" />
                    {plan.validityDays >= 36000 ? "Lifetime" : plan.validityDays >= 365 ? `${Math.round(plan.validityDays / 365)} year${Math.round(plan.validityDays / 365) > 1 ? "s" : ""}` : `${plan.validityDays} days`}
                  </div>
                  {lan > 0 && (
                    <div className="flex items-center gap-2 text-indigo-600">
                      <Monitor className="w-3.5 h-3.5" /> LAN: {lan} clients
                    </div>
                  )}
                  {chat && (
                    <div className="flex items-center gap-2 text-teal-600">
                      <MessageSquare className="w-3.5 h-3.5" /> Chat included
                    </div>
                  )}
                  {reportDesigner && (
                    <div className="flex items-center gap-2 text-purple-600">
                      <LayoutTemplate className="w-3.5 h-3.5" /> Report Designer included
                    </div>
                  )}
                  {plan.trialDays > 0 && <div className="flex items-center gap-2 text-orange-500 text-xs">Trial: {plan.trialDays} days</div>}
                  {plan.maxVouchersPerMonth > 0 && <div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-orange-400" /> {plan.maxVouchersPerMonth} invoices/month</div>}
                  {otherFeats.map((f: string, i: number) => (
                    <div key={i} className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />{f}</div>
                  ))}
                </div>

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

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900">{editId ? "Plan Edit Karo" : "Naya Plan"}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4">
              {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 5 Year Plan" className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description" className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                  <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Type</label>
                  <select value={billingCycle} onChange={e => setBillingCycle(e.target.value as BillingUI)} className={inputCls}>
                    <option value="onetime">One-time (ek dafa)</option>
                    <option value="yearly">Yearly (saalana)</option>
                    <option value="monthly">Monthly (maahana)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Users</label>
                  <input type="number" value={maxUsers} onChange={e => setMaxUsers(e.target.value)} min="1" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Validity (days)</label>
                  <input type="number" value={validityDays} onChange={e => setValidityDays(e.target.value)} min="1" className={inputCls} />
                  <p className="text-[11px] text-gray-400 mt-0.5">365=1yr · 1825=5yr · 36500=lifetime</p>
                </div>
              </div>

              {/* LAN Clients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-indigo-400" /> LAN Clients
                </label>
                <input type="number" value={lanClients} onChange={e => setLanClients(e.target.value)} min="0" placeholder="0 = disabled" className={inputCls} />
                <p className="text-[11px] text-gray-400 mt-0.5">0 = LAN nahi, 2 = 2 clients allowed</p>
              </div>

              {/* Chat + Report Designer checkboxes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-teal-500" /> Chat
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input type="checkbox" checked={chatIncluded} onChange={e => setChatIncluded(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600" />
                    <span className="text-sm text-gray-700">Include karo</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <LayoutTemplate className="w-3.5 h-3.5 text-purple-500" /> Report Designer
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input type="checkbox" checked={reportDesignerIncluded} onChange={e => setReportDesignerIncluded(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600" />
                    <span className="text-sm text-gray-700">Include karo</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trial Days</label>
                  <input type="number" value={trialDays} onChange={e => setTrialDays(e.target.value)} min="0" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} min="0" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Max Invoices/mo</label>
                  <input type="number" value={maxVouchersPerMonth} onChange={e => setMaxVouchersPerMonth(e.target.value)} placeholder="∞" min="0" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Max Items</label>
                  <input type="number" value={maxItems} onChange={e => setMaxItems(e.target.value)} placeholder="∞" min="0" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Max Parties</label>
                  <input type="number" value={maxParties} onChange={e => setMaxParties(e.target.value)} placeholder="∞" min="0" className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Features (ek line = ek feature)</label>
                <textarea value={features} onChange={e => setFeatures(e.target.value)} rows={3} placeholder={"GST Reports\nMulti User\nAll Modules"} className={inputCls} />
                <p className="text-[11px] text-gray-400 mt-0.5">LAN aur Chat upar se set karo — yahan mat likhna</p>
              </div>
            </div>

            <div className="p-5 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? "Saving..." : "Save Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
