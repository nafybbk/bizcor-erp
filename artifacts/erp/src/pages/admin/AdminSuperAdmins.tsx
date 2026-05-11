import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Loader2, Plus, Trash2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useLang } from "@/lib/langHook";
import { t } from "@/lib/lang";

export default function AdminSuperAdmins() {
  const lang = useLang();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get<any>("/super-admin/super-admins")
      .then(r => setAdmins(r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError(t("allFieldsRequired", lang)); return;
    }
    if (form.password.length < 6) {
      setError(t("passwordMinChars", lang)); return;
    }
    setSaving(true);
    try {
      await api.post("/super-admin/super-admins", form);
      setForm({ name: "", email: "", password: "" });
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message || t("error", lang));
    } finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm(t("deleteSuperAdminConfirm", lang))) return;
    try {
      await api.delete(`/super-admin/super-admins/${id}`);
      setAdmins(a => a.filter(x => x.id !== id));
    } catch (err: any) { alert(err.message); }
  };

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tech Support Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t("superAdminDesc", lang)}</p>
        </div>
        <button
          onClick={() => { setShowForm(s => !s); setError(""); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {t("newAdmin", lang)}
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-white rounded-xl border border-blue-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" /> {t("createNewSuperAdmin", lang)}
          </h3>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("name", lang)}</label>
              <input
                className={inputCls}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t("fullName", lang)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("email", lang)}</label>
              <input
                type="email"
                className={inputCls}
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t("password", lang)}</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                className={inputCls + " pr-10"}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={t("atLeast6Chars", lang)}
              />
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              {t("cancel", lang)}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? t("creating2", lang) : t("createBtn", lang)}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <span className="text-sm font-medium text-gray-700">
            {admins.length} Super Admin{admins.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : admins.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">{t("noSuperAdminFound", lang)}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {admins.map(a => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-yellow-100 rounded-full flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-800 text-sm">{a.name}</div>
                    <div className="text-xs text-gray-500">{a.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full font-medium">
                    Tech Support
                  </span>
                  <button
                    onClick={() => remove(a.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title={t("remove", lang)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
        {t("superAdminWarning", lang)}
      </div>
    </div>
  );
}
