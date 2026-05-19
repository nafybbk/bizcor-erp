import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Users, Search, RefreshCw, Loader2, ShieldCheck, User,
  KeyRound, Building2, CreditCard, Clock, ChevronDown, ChevronUp,
  Lock, Unlock, Trash2, Eye, EyeOff, X, AlertTriangle, CheckCircle2,
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

interface BizGroup {
  businessId: number; bizName: string; bizCode: string;
  gstin: string | null; pan: string | null; bizPhone: string | null;
  planName: string | null; maxUsers: number | null; isTrial: boolean;
  isExpired: boolean; planExpiresAt: string | null;
  users: (UserRow & { slotLabel: string })[];
}

function timeAgo(d: string | null) {
  if (!d) return "—";
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

function groupByBusiness(users: UserRow[]): BizGroup[] {
  const map = new Map<number, BizGroup>();
  for (const u of users) {
    if (!map.has(u.businessId)) {
      map.set(u.businessId, {
        businessId: u.businessId, bizName: u.bizName, bizCode: u.bizCode,
        gstin: u.gstin, pan: u.pan, bizPhone: u.bizPhone,
        planName: u.planName, maxUsers: u.maxUsers, isTrial: u.isTrial,
        isExpired: u.isExpired, planExpiresAt: u.planExpiresAt,
        users: [],
      });
    }
    map.get(u.businessId)!.users.push({ ...u, slotLabel: "" });
  }
  // Assign slot labels: admin = "Admin", then staff by createdAt = "+1", "+2"...
  for (const grp of map.values()) {
    const admins = grp.users.filter(u => u.role === "business_admin");
    const staff = grp.users.filter(u => u.role !== "business_admin")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    admins.forEach(u => { u.slotLabel = "Admin"; });
    staff.forEach((u, i) => { u.slotLabel = `+${i + 1}`; });
    grp.users = [...admins, ...staff];
  }
  return Array.from(map.values()).sort((a, b) => a.bizName?.localeCompare(b.bizName ?? "") ?? 0);
}

function ResetPwModal({ user, onClose, onDone }: { user: UserRow; onClose: () => void; onDone: () => void }) {
  const [pw, setPw] = useState(""); const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false); const [msg, setMsg] = useState("");

  const handleReset = async () => {
    if (!pw || pw.length < 4) { setMsg("Kam se kam 4 characters ka password daalo"); return; }
    setLoading(true); setMsg("");
    try {
      const r = await api.patch<any>(`/super-admin/users/${user.id}/password`, { password: pw });
      setMsg(r.message || "Password reset ho gaya ✓");
      setPw(""); setTimeout(() => { onDone(); onClose(); }, 1200);
    } catch (e: any) { setMsg(e.message || "Error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-600" />
            <div>
              <div className="font-semibold text-gray-900 text-sm">Reset Password</div>
              <div className="text-xs text-gray-400">{user.name}</div>
            </div>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="relative">
            <input
              type={show ? "text" : "password"} value={pw}
              onChange={e => setPw(e.target.value)}
              placeholder="Naya password..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {msg && <div className={`text-xs px-3 py-2 rounded-lg ${msg.includes("✓") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg}</div>}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button onClick={handleReset} disabled={loading || !pw}
              className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserCard({ u, onBlock, onDelete, onResetPw, blocking, deleting }:
  { u: UserRow & { slotLabel: string }; onBlock: () => void; onDelete: () => void; onResetPw: () => void; blocking: boolean; deleting: boolean }) {
  const [open, setOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const isAdmin = u.role === "business_admin";

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${!u.isActive ? "opacity-60" : ""} ${isAdmin ? "border-blue-200" : "border-gray-200"}`}>
      {/* User row — tap to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${open ? "bg-gray-50" : "hover:bg-gray-50"}`}
      >
        {/* Avatar with slot label */}
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white ${isAdmin ? "bg-blue-500" : !u.isActive ? "bg-red-400" : "bg-slate-400"}`}>
            {(u.name || "?")[0].toUpperCase()}
          </div>
          <span className={`text-[10px] font-bold px-1 py-0 rounded ${isAdmin ? "text-blue-600" : "text-gray-400"}`}>
            {u.slotLabel}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{u.name}</span>
            {isAdmin && <ShieldCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
            {!u.isActive && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">Blocked</span>}
          </div>
          <div className="text-xs text-gray-400 truncate">{u.email}</div>
          <div className="text-xs text-gray-300">{timeAgo(u.lastLogin)}</div>
        </div>

        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 space-y-3">
          {/* Detail rows */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div className="text-gray-400">Email</div>
            <div className="text-gray-800 font-medium truncate">{u.email}</div>

            <div className="text-gray-400">Password</div>
            <div className="flex items-center gap-1">
              <span className="font-mono text-gray-700">{showPw ? (u.plainPassword || "—") : "••••••"}</span>
              <button onClick={() => setShowPw(s => !s)} className="text-gray-300 hover:text-indigo-500">
                {showPw ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>

            <div className="text-gray-400">Role</div>
            <div className="text-gray-800">{isAdmin ? "Business Admin" : "Staff"}</div>

            <div className="text-gray-400">Status</div>
            <div className={u.isActive ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
              {u.isActive ? "Active" : "Blocked"}
            </div>

            <div className="text-gray-400">Last Login</div>
            <div className="text-gray-600">{timeAgo(u.lastLogin)}</div>

            <div className="text-gray-400">Last Seen</div>
            <div className="text-gray-600">{timeAgo(u.lastSeenAt)}</div>

            <div className="text-gray-400">Joined</div>
            <div className="text-gray-600">{timeAgo(u.createdAt)}</div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1 border-t border-gray-50">
            {/* Block / Unblock */}
            <button
              onClick={onBlock}
              disabled={blocking}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border font-medium transition-colors ${
                u.isActive
                  ? "border-red-200 text-red-600 hover:bg-red-50"
                  : "border-green-200 text-green-700 hover:bg-green-50"
              } disabled:opacity-50`}
            >
              {blocking ? <Loader2 className="w-3 h-3 animate-spin" /> : u.isActive ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              {u.isActive ? "Block" : "Unblock"}
            </button>

            {/* Reset PW */}
            <button
              onClick={onResetPw}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-medium transition-colors"
            >
              <KeyRound className="w-3 h-3" /> Reset PW
            </button>

            {/* Delete — disabled for admin */}
            {!isAdmin ? (
              <button
                onClick={onDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Delete
              </button>
            ) : (
              <div className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-gray-100 text-gray-300 cursor-not-allowed">
                <Trash2 className="w-3 h-3" /> Delete
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BizCard({ grp, onRefresh }: { grp: BizGroup; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [blockingId, setBlockingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [users, setUsers] = useState(grp.users);

  useEffect(() => { setUsers(grp.users); }, [grp.users]);

  const handleBlock = async (u: UserRow) => {
    setBlockingId(u.id);
    try {
      const r = await api.patch<any>(`/super-admin/users/${u.id}/block`, {});
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: r.isActive } : x));
    } catch { } finally { setBlockingId(null); }
  };

  const handleDelete = async (u: UserRow) => {
    if (!confirm(`"${u.name}" ko delete karein? Ye action undo nahi hoga.`)) return;
    setDeletingId(u.id);
    try {
      await api.delete<any>(`/super-admin/users/${u.id}`);
      setUsers(prev => prev.filter(x => x.id !== u.id));
    } catch (e: any) { alert(e.message || "Delete failed"); }
    finally { setDeletingId(null); }
  };

  const overLimit = grp.maxUsers ? users.length > grp.maxUsers : false;
  const planLabel = grp.planName || (grp.isTrial ? "Trial" : "Free");

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Business header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {(grp.bizName || "?")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{grp.bizName}</span>
            <span className="text-xs font-mono text-gray-400">{grp.bizCode}</span>
            {overLimit && (
              <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full font-medium flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" /> Over limit
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <CreditCard className="w-3 h-3" /> {planLabel}
            </span>
            <span className={`text-xs flex items-center gap-1 ${overLimit ? "text-orange-600 font-medium" : "text-gray-400"}`}>
              <Users className="w-3 h-3" />
              {users.length}{grp.maxUsers ? `/${grp.maxUsers}` : ""} users
            </span>
            {grp.bizPhone && <span className="text-xs text-gray-400">{grp.bizPhone}</span>}
          </div>
        </div>
        {/* Slot previews */}
        <div className="flex items-center flex-shrink-0 gap-1">
          {users.slice(0, 4).map(u => (
            <div key={u.id}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${u.role === "business_admin" ? "bg-blue-500" : !u.isActive ? "bg-red-400" : "bg-slate-400"}`}
              title={`${u.name} (${u.slotLabel})`}
            >
              {u.slotLabel === "Admin" ? "A" : u.slotLabel}
            </div>
          ))}
          {users.length > 4 && <span className="text-xs text-gray-400 font-medium">+{users.length - 4}</span>}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      {/* Users list */}
      {expanded && (
        <div className="border-t border-gray-100 px-3 py-2 space-y-2">
          {/* Plan / KYC info bar */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 py-1.5 text-xs text-gray-500">
            {grp.gstin && <span><span className="text-gray-400">GSTIN:</span> {grp.gstin}</span>}
            {grp.pan && <span><span className="text-gray-400">PAN:</span> {grp.pan}</span>}
            {grp.planExpiresAt && (
              <span className={grp.isExpired ? "text-red-500 font-medium" : ""}>
                {grp.isExpired ? "⚠ Expired: " : "Expires: "}
                {new Date(grp.planExpiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
              </span>
            )}
          </div>

          {users.length === 0 ? (
            <div className="text-center text-gray-400 text-xs py-4">No users</div>
          ) : (
            users.map(u => (
              <UserCard
                key={u.id} u={u}
                blocking={blockingId === u.id}
                deleting={deletingId === u.id}
                onBlock={() => handleBlock(u)}
                onDelete={() => handleDelete(u)}
                onResetPw={() => setResetUser(u as UserRow)}
              />
            ))
          )}
        </div>
      )}

      {resetUser && (
        <ResetPwModal user={resetUser} onClose={() => setResetUser(null)} onDone={onRefresh} />
      )}
    </div>
  );
}

export default function AdminUsers() {
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [groups, setGroups] = useState<BizGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<any>(`/super-admin/users?limit=500`);
      const users: UserRow[] = Array.isArray(r.data) ? r.data : [];
      setAllUsers(users);
      setTotal(users.length);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? allUsers.filter(u =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.bizName?.toLowerCase().includes(q) ||
          u.bizCode?.toLowerCase().includes(q) ||
          u.gstin?.toLowerCase().includes(q) ||
          u.bizPhone?.includes(q)
        )
      : allUsers;
    setGroups(groupByBusiness(filtered));
  }, [allUsers, search]);

  const activeCount = allUsers.filter(u => u.isActive).length;
  const blockedCount = allUsers.filter(u => !u.isActive).length;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-500" /> All Users
          </h1>
          {!loading && (
            <p className="text-xs text-gray-400 mt-0.5">
              {groups.length} businesses · {total} users ·
              <span className="text-green-600 ml-1">{activeCount} active</span> ·
              <span className="text-red-500 ml-1">{blockedCount} blocked</span>
            </p>
          )}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Business naam, email, code, GSTIN, phone..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Business groups */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <div>{search ? "Koi nahi mila" : "Koi user nahi hai"}</div>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(grp => (
            <BizCard key={grp.businessId} grp={grp} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}
