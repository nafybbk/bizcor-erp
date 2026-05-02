import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Loader2, Trash2, Edit2, X } from "lucide-react";

const emptyForm = { name: "", email: "", password: "", role: "staff" as "business_admin"|"staff", permissions: [] as string[] };

const PERMISSIONS = ["sales", "purchases", "payments", "inventory", "accounting", "gst", "masters", "settings"];

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
    setForm({ name: u.name, email: u.email, password: "", role: u.role, permissions: u.permissions || [] });
    setError(""); setShowModal(true);
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      const payload: any = { ...form };
      if (!payload.password) delete payload.password;
      if (editId) await api.patch(`/users/${editId}`, payload);
      else await api.post("/users", payload);
      setShowModal(false); load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm("Delete user?")) return;
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${u.role === "business_admin" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                      {u.role?.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(u)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => del(u.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{editId ? "Edit User" : "Add User"}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input type="email" className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{editId ? "New Password (leave blank to keep)" : "Password *"}</label><input type="password" className={inputCls} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select className={inputCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}>
                  <option value="staff">Staff</option>
                  <option value="business_admin">Business Admin</option>
                </select>
              </div>
              {form.role === "staff" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
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
