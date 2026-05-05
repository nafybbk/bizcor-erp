import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Users, Search, RefreshCw, Loader2, ShieldCheck, Shield, ShieldOff,
  KeyRound, Building2, CreditCard, Clock, CheckCircle2, XCircle,
  AlertTriangle, Eye, EyeOff, ChevronLeft, ChevronRight, Phone, Mail,
  Lock, Unlock,
} from "lucide-react";

interface UserRow {
  id: number; name: string; email: string; role: string;
  isActive: boolean; lastSeenAt: string | null; createdAt: string;
  businessId: number; bizName: string; bizCode: string;
  gstin: string | null; pan: string | null; bizPhone: string | null;
  bizStatus: string; planId: number | null; planName: string | null;
  maxUsers: number | null; userCount: number;
  voucherCode: string | null; lastLogin: string | null;
  isExpired: boolean; isTrial: boolean; planExpiresAt: string | null;
  plainPassword: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  business_admin: "Biz Admin", staff: "Staff", accountant: "Accountant", manager: "Manager",
};
const ROLE_COLORS: Record<string, string> = {
  business_admin: "bg-blue-100 text-blue-700",
  staff: "bg-gray-100 text-gray-600",
  accountant: "bg-purple-100 text-purple-700",
  manager: "bg-orange-100 text-orange-700",
};

function timeAgo(d: string | null) {
  if (!d) return "—";
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return `${diff}s pehle`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m pehle`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h pehle`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d pehle`;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function LicenseBadge({ used, max, expired, trial }: { used: number; max: number | null; expired: boolean; trial: boolean }) {
  if (!max) return <span className="text-xs text-gray-400">—</span>;
  const pct = Math.round((used / max) * 100);
  const over = used > max;
  const color = expired ? "text-red-600 bg-red-50 border-red-200"
    : over ? "text-orange-600 bg-orange-50 border-orange-200"
    : pct >= 80 ? "text-yellow-600 bg-yellow-50 border-yellow-200"
    : "text-green-600 bg-green-50 border-green-200";
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium ${color}`}>
      {over ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
      {used}/{max}
      {trial && <span className="text-xs opacity-70">(Trial)</span>}
      {expired && <span className="text-xs font-bold ml-0.5">EXPIRED</span>}
    </div>
  );
}

function PasswordModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [pw, setPw] = useState(""); const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false); const [msg, setMsg] = useState("");

  const handleReset = async () => {
    if (!pw || pw.length < 4) { setMsg("Kam se kam 4 characters ka password daalen"); return; }
    setLoading(true); setMsg("");
    try {
      const r = await api.patch<any>(`/super-admin/users/${user.id}/password`, { password: pw });
      setMsg(r.message || "Password reset ho gaya ✓");
      setPw("");
    } catch (e: any) { setMsg(e.message || "Error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">Password Reset</div>
            <div className="text-sm text-gray-500">{user.name} — {user.email}</div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            <strong>Note:</strong> Purana password dikhana possible nahi hai (encrypted hota hai). Yahan naya password set karein.
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Naya Password</label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={pw} onChange={e => setPw(e.target.value)}
                placeholder="Naya password daalen..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <button onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {msg && (
            <div className={`text-sm px-3 py-2 rounded-lg ${msg.includes("✓") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {msg}
            </div>
          )}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleReset} disabled={loading || !pw}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Password Reset Karo
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [passwordUser, setPasswordUser] = useState<UserRow | null>(null);
  const [blockingId, setBlockingId] = useState<number | null>(null);
  const [shownPasswords, setShownPasswords] = useState<Set<number>>(new Set());
  const togglePwVisible = (id: number) => setShownPasswords(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });
  const limit = 50;

  const load = useCallback(async (p = page, q = search, sf = statusFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) });
      if (q) params.set("search", q);
      if (sf) params.set("status", sf);
      const r = await api.get<any>(`/super-admin/users?${params}`);
      setUsers(Array.isArray(r.data) ? r.data : []);
      setTotal(r.total || 0);
    } catch { } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { load(page, search, statusFilter); }, [page, search, statusFilter]);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleStatus = (v: string) => { setStatusFilter(v); setPage(1); };

  const toggleBlock = async (u: UserRow) => {
    setBlockingId(u.id);
    try {
      const r = await api.patch<any>(`/super-admin/users/${u.id}/block`, {});
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: r.isActive } : x));
    } catch { } finally { setBlockingId(null); }
  };

  const totalPages = Math.ceil(total / limit);
  const activeCount = users.filter(u => u.isActive).length;
  const blockedCount = users.filter(u => !u.isActive).length;

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-500" /> All Users
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Sabhi businesses ke users — KYC, license, last login sab ek jagah
          </p>
        </div>
        <button onClick={() => load(page, search, statusFilter)}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 self-start">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Search by name, email, business, GSTIN, phone..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>
        <div className="flex gap-2">
          {[["", "All"], ["active", "Active"], ["blocked", "Blocked"]].map(([val, lbl]) => (
            <button key={val} onClick={() => handleStatus(val)}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${statusFilter === val
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="flex gap-4 text-sm text-gray-500">
          <span className="font-medium text-gray-900">{total} users</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />{activeCount} active</span>
          <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-red-500" />{blockedCount} blocked</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <div>Koi user nahi mila</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Business / KYC</th>
                  <th className="px-4 py-3 text-left">Plan / License</th>
                  <th className="px-4 py-3 text-left">Last Login</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.isActive ? "opacity-60" : ""}`}>
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                          u.isActive ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"}`}>
                          {(u.name || "?")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">{u.name}</div>
                          <div className="text-xs text-gray-400 flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3 flex-shrink-0" />{u.email}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs text-gray-400 font-mono select-all">
                              {shownPasswords.has(u.id)
                                ? (u.plainPassword || <span className="italic text-gray-300">password nahi</span>)
                                : "••••••••"}
                            </span>
                            <button onClick={() => togglePwVisible(u.id)}
                              className="text-gray-300 hover:text-indigo-500 transition-colors"
                              title={shownPasswords.has(u.id) ? "Hide password" : "Show password"}>
                              {shownPasswords.has(u.id)
                                ? <EyeOff className="w-3 h-3" />
                                : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                          <span className={`mt-0.5 inline-block text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-600"}`}>
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Business / KYC */}
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <div className="font-medium text-gray-900 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate max-w-[140px]">{u.bizName || "—"}</span>
                        </div>
                        <div className="text-xs text-gray-400 font-mono">{u.bizCode || "—"}</div>
                        {u.gstin && (
                          <div className="text-xs text-gray-500">
                            <span className="font-medium text-gray-400">GSTIN:</span> {u.gstin}
                          </div>
                        )}
                        {u.pan && (
                          <div className="text-xs text-gray-500">
                            <span className="font-medium text-gray-400">PAN:</span> {u.pan}
                          </div>
                        )}
                        {u.bizPhone && (
                          <div className="text-xs text-gray-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" />{u.bizPhone}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Plan / License */}
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-medium text-gray-700">{u.planName || "No plan"}</span>
                        </div>
                        <LicenseBadge used={u.userCount} max={u.maxUsers} expired={u.isExpired} trial={u.isTrial} />
                        {u.planExpiresAt && (
                          <div className={`text-xs ${u.isExpired ? "text-red-500 font-medium" : "text-gray-400"}`}>
                            {u.isExpired ? "Expired: " : "Expires: "}
                            {new Date(u.planExpiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        )}
                        {u.voucherCode && (
                          <div className="text-xs text-gray-400 font-mono">#{u.voucherCode}</div>
                        )}
                      </div>
                    </td>

                    {/* Last Login */}
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <div className="text-xs text-gray-600 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {timeAgo(u.lastLogin)}
                        </div>
                        {u.lastSeenAt && (
                          <div className="text-xs text-gray-400">
                            Seen: {timeAgo(u.lastSeenAt)}
                          </div>
                        )}
                        <div className="text-xs text-gray-300">
                          Joined: {timeAgo(u.createdAt)}
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">
                          <ShieldOff className="w-3 h-3" /> Blocked
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => toggleBlock(u)}
                          disabled={blockingId === u.id}
                          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                            u.isActive
                              ? "border-red-200 text-red-600 hover:bg-red-50"
                              : "border-green-200 text-green-700 hover:bg-green-50"
                          } disabled:opacity-50`}
                        >
                          {blockingId === u.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : u.isActive ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          {u.isActive ? "Block" : "Unblock"}
                        </button>
                        <button
                          onClick={() => setPasswordUser(u)}
                          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-medium transition-colors"
                        >
                          <KeyRound className="w-3 h-3" /> Reset PW
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="px-3 py-1.5 border border-indigo-300 bg-indigo-50 text-indigo-700 rounded-lg font-medium">
              {page} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {passwordUser && (
        <PasswordModal user={passwordUser} onClose={() => setPasswordUser(null)} />
      )}
    </div>
  );
}
