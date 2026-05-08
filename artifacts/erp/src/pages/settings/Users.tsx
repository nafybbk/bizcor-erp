import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Loader2, Trash2, Edit2, X, ShieldCheck, User, KeyRound, PencilOff, Trash } from "lucide-react";

const emptyForm = {
  name: "", email: "", password: "", role: "staff" as "business_admin" | "staff",
  permissions: [] as string[], loginPin: "",
  canEdit: true, canDelete: true,
};

const PERMISSIONS = ["sales", "purchases", "payments", "inventory", "accounting", "gst", "masters", "settings"];

function YesNoToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-200 w-fit">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-4 py-1.5 text-sm font-medium transition-colors ${value ? "bg-green-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-4 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 ${!value ? "bg-red-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
      >
        No
      </button>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.get<any>("/users").then(r => setUsers(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setForm({ ...emptyForm }); setError(""); setShowModal(true); };
  const openEdit = (u: any) => {
    setEditId(u.id);
    setForm({
      name: u.name, email: u.email, password: "", role: u.role,
      permissions: u.permissions || [], loginPin: "",
      canEdit: u.canEdit !== false,
      canDelete: u.canDelete !== false,
    });
    setError(""); setShowModal(true);
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      const payload: any = { ...form };
      if (!payload.password) delete payload.password;
      if (!payload.loginPin) delete payload.loginPin;
      if (editId) await api.patch(`/users/${editId}`, payload);
      else await api.post("/users", payload);
      setShowModal(false); load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm("Is user ko delete karna chahte hain?")) return;
    await api.delete(`/users/${id}`);
    load();
  };

  const togglePerm = (perm: string) => {
    setForm(f => ({ ...f, permissions: f.permissions.includes(perm) ? f.permissions.filter(p => p !== perm) : [...f.permissions, perm] }));
  };

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-center h-32 text-gray-400 text-sm">
          Koi user nahi mila
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm ${u.role === "business_admin" ? "bg-blue-500" : "bg-gray-400"}`}>
                {u.name?.charAt(0)?.toUpperCase() || "?"}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm truncate">{u.name}</span>
                  {u.role === "business_admin" ? (
                    <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 flex-shrink-0">
                      <ShieldCheck className="w-3 h-3" /> Admin
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                      <User className="w-3 h-3" /> Staff
                    </span>
                  )}
                  {u.hasPin && (
                    <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                      <KeyRound className="w-3 h-3" /> PIN
                    </span>
                  )}
                  {u.canEdit === false && (
                    <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 flex-shrink-0">
                      <PencilOff className="w-3 h-3" /> No Edit
                    </span>
                  )}
                  {u.canDelete === false && (
                    <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 flex-shrink-0">
                      <Trash className="w-3 h-3" /> No Delete
                    </span>
                  )}
                  {!u.isActive && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 flex-shrink-0">Inactive</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">{u.email}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(u)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => del(u.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9997] p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{editId ? "Edit User" : "Add User"}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{editId ? "New Password (blank = change nahi)" : "Password *"}</label>
                <input type="password" className={inputCls} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Login PIN
                  <span className="text-gray-400 font-normal text-xs ml-1">(same email+password wale users ke liye)</span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder={editId ? "Naya PIN daalo (blank = change nahi)" : "4–8 digit PIN"}
                  className={inputCls}
                  value={form.loginPin}
                  onChange={e => setForm(f => ({ ...f, loginPin: e.target.value.replace(/\D/g, "") }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select className={inputCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}>
                  <option value="staff">Staff</option>
                  <option value="business_admin">Business Admin</option>
                </select>
              </div>

              {/* Edit & Delete Rights */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
                <div className="text-sm font-medium text-gray-700 mb-1">Access Rights</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-700">Edit Records</div>
                    <div className="text-xs text-gray-400">Data edit karne ka right</div>
                  </div>
                  <YesNoToggle value={form.canEdit} onChange={v => setForm(f => ({ ...f, canEdit: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-700">Delete Records</div>
                    <div className="text-xs text-gray-400">Data delete karne ka right</div>
                  </div>
                  <YesNoToggle value={form.canDelete} onChange={v => setForm(f => ({ ...f, canDelete: v }))} />
                </div>
              </div>

              {form.role === "staff" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Module Permissions</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PERMISSIONS.map(p => (
                      <label key={p} className="flex items-center gap-2 text-sm capitalize cursor-pointer">
                        <input type="checkbox" checked={form.permissions.includes(p)} onChange={() => togglePerm(p)} className="rounded text-blue-600" />
                        {p}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
