import { useState } from "react";
import { X, Eye, EyeOff, Shield, Users, Crown, Copy, Check } from "lucide-react";
import { useLang } from "@/lib/langHook";
import { t } from "@/lib/lang";

interface PasswordEntry {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  is_active?: boolean;
  business_name?: string;
  business_code?: string;
  plain_password?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  superAdmins: PasswordEntry[];
  users: PasswordEntry[];
}

function PasswordCell({ pwd, id, lang }: { pwd?: string; id: string; lang: string }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!pwd) return <span className="text-gray-300 text-xs italic">{t("passwordNotSet", lang as any)}</span>;

  const copy = async () => {
    await navigator.clipboard.writeText(pwd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-sm text-gray-800 min-w-[80px]">
        {show ? pwd : "••••••••"}
      </span>
      <button
        onClick={() => setShow(!show)}
        className="text-gray-400 hover:text-gray-700 p-0.5 rounded"
        title={show ? t("hidePassword", lang as any) : t("showPassword", lang as any)}
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={copy}
        className="text-gray-400 hover:text-blue-600 p-0.5 rounded"
        title={t("copyPassword", lang as any)}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

export function PasswordListDrawer({ open, onClose, superAdmins, users }: Props) {
  const lang = useLang();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative ml-auto w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-orange-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-600" />
            <h2 className="text-base font-bold text-gray-900">Password List</h2>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold tracking-wide">
              PRIVATE
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
              <Crown className="w-4 h-4 text-yellow-500" />
              Tech Admins ({superAdmins.length})
            </h3>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2.5 text-left">{t("name", lang)}</th>
                    <th className="px-4 py-2.5 text-left">{t("phone", lang)} / {t("email", lang)}</th>
                    <th className="px-4 py-2.5 text-left">{t("password", lang)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {superAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                        {t("noData2", lang)}
                      </td>
                    </tr>
                  ) : (
                    superAdmins.map((a) => (
                      <tr key={a.id} className="hover:bg-yellow-50/40">
                        <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {a.phone || a.email || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <PasswordCell pwd={a.plain_password} id={`sa_${a.id}`} lang={lang} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-blue-500" />
              Business Users ({users.length})
            </h3>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2.5 text-left">{t("name", lang)}</th>
                    <th className="px-4 py-2.5 text-left">Business</th>
                    <th className="px-4 py-2.5 text-left">{t("email", lang)}</th>
                    <th className="px-4 py-2.5 text-left">{t("password", lang)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                        {t("noUsers", lang)}
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className={`hover:bg-blue-50/30 ${!u.is_active ? "opacity-40" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{u.name}</div>
                          <div className="text-xs text-gray-400">
                            {u.role === "business_admin" ? "Admin" : "Staff"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="text-gray-700">{u.business_name || "—"}</div>
                          {u.business_code && (
                            <div className="font-mono text-gray-400">{u.business_code}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate">
                          {u.email}
                        </td>
                        <td className="px-4 py-3">
                          <PasswordCell pwd={u.plain_password} id={`u_${u.id}`} lang={lang} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
