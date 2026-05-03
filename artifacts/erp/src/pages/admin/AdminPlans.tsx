import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Plus, Edit2, Trash2, Loader2, X, Check, Building2, CreditCard } from "lucide-react";

const emptyForm = {
  name: "", description: "", price: "", billingCycle: "monthly" as "monthly" | "yearly",
  maxUsers: "5", trialDays: "0", validityDays: "30", features: "", sortOrder: "0", isActive: true,
};

export default function AdminPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.get<any>("/super-admin/plans").then(r => setPlans(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setForm({ ...emptyForm }); setError(""); setShowModal(true); };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name, description: p.description || "", price: String(p.price), billingCycle: p.billingCycle,
      maxUsers: String(p.maxUsers), trialDays: String(p.trialDays), validityDays: String(p.validityDays),
      features: (p.features || []).join("\n"), sortOrder: String(p.sortOrder || 0), isActive: p.isActive,
    });
    setError(""); setShowModal(true);
  };

  const save = async () => {
    if (!form.name || !form.price) { setError("Name and price are required"); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        name: form.name, description: form.description, price: Number(form.price),
        billingCycle: form.billingCycle, maxUsers: Number(form.maxUsers),
        trialDays: Number(form.trialDays), validityDays: Number(form.validityDays),
        features: form.features.split("\n").map(f => f.trim()).filter(Boolean),
        sortOrder: Number(form.sortOrder), isActive: form.isActive,
      };
      if (editId) await api.patch(`/super-admin/plans/${editId}`, payload);
      else await api.post("/super-admin/plans", payload);
      setShowModal(false); load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const del = async (id: number, hasBusinesses: boolean) => {
    if (hasBusinesses) { alert("Cannot delete plan with active businesses. Deactivate it instead."); return; }
    if (!confirm("Delete this plan?")) return;
    await api.delete(`/super-admin/plans/${id}`);
    load();
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    await api.patch(`/super-admin/plans/${id}`, { isActive: !isActive });
    load();
  };

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Plans</h1>
          <p className="text-sm text-gray-500 mt-0.5">Define subscription plans with pricing, validity and trial period</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" /> New Plan
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan.id} className={`bg-white rounded-xl border-2 ${plan.isActive ? "border-blue-200" : "border-gray-200 opacity-60"} p-5 space-y-3`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
                  {plan.description && <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => openEdit(plan)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => del(plan.id, Number(plan.businessCount) > 0)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="text-2xl font-bold text-blue-600">
                {plan.price == 0 ? "Free" : `₹${fmt.number(plan.price)}`}
                <span className="text-sm font-normal text-gray-400">/{plan.billingCycle === "monthly" ? "mo" : "yr"}</span>
              </div>

              <div className="space-y-1.5 text-sm text-gray-600">
                <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500" /> Max {plan.maxUsers} users</div>
                <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500" /> {plan.validityDays} days validity</div>
                {plan.trialDays > 0 && <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-orange-400" /> {plan.trialDays} days free trial</div>}
                {(plan.features || []).map((f: string, i: number) => (
                  <div key={i} className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500" />{f}</div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{plan.businessCount || 0} businesses</span>
                </div>
                <button onClick={() => toggleActive(plan.id, plan.isActive)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${plan.isActive ? "bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600" : "bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700"}`}>
                  {plan.isActive ? "Active" : "Inactive"}
                </button>
              </div>
            </div>
          ))}
          {plans.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <div className="font-medium">No plans defined yet</div>
              <button onClick={openCreate} className="text-blue-600 text-sm mt-1">Create your first plan →</button>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{editId ? "Edit Plan" : "New Plan"}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Plan Name *</label><input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Basic, Pro, Enterprise" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><input className={inputCls} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
                  <input type="number" min="0" className={inputCls} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0 for free" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Cycle</label>
                  <select className={inputCls} value={form.billingCycle} onChange={e => setForm(f => ({ ...f, billingCycle: e.target.value as any }))}>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Validity (days)</label>
                  <input type="number" min="1" className={inputCls} value={form.validityDays} onChange={e => setForm(f => ({ ...f, validityDays: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Free Trial (days)</label>
                  <input type="number" min="0" className={inputCls} value={form.trialDays} onChange={e => setForm(f => ({ ...f, trialDays: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Users</label>
                  <input type="number" min="1" className={inputCls} value={form.maxUsers} onChange={e => setForm(f => ({ ...f, maxUsers: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input type="number" min="0" className={inputCls} value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Features (one per line)</label>
                <textarea className={inputCls} rows={4} value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} placeholder="GST Reports&#10;Multi-user&#10;Priority Support" />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <span className="text-sm text-gray-700">Plan is active (visible for assignment)</span>
              </label>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

