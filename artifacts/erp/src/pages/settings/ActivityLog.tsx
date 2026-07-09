import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { api, fmt } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Loader2, Download, Trash2, Eye, X, ShieldAlert, History } from "lucide-react";

// Admin-only activity trail. The malik's own record — staff never see this page
// (server enforces it too). Clear is final: deleted means deleted.

type LogRow = {
  id: number; userId: number | null; userName: string | null; action: string;
  entityType: string; entityId: number | null; entityLabel: string | null;
  summary: string; hasSnapshot: boolean; createdAt: string;
};

const ACTION_STYLE: Record<string, string> = {
  created: "bg-green-100 text-green-700",
  edited: "bg-blue-100 text-blue-700",
  deleted: "bg-red-100 text-red-700",
  restored: "bg-amber-100 text-amber-700",
  login: "bg-gray-100 text-gray-600",
};

const ENTITY_OPTIONS = [
  ["", "Sab kuch"], ["voucher", "Vouchers"], ["payment", "Payments"],
  ["party", "Parties"], ["item", "Items"], ["user", "Users"], ["auth", "Logins"],
] as const;

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Render a before-snapshot in a readable way (voucher/payment/party/item row + optional items)
function SnapshotView({ data }: { data: any }) {
  const before = data?.details?.before;
  if (!before) return <div className="text-sm text-gray-400 py-4 text-center">Is entry mein snapshot nahi hai</div>;
  const { items, allocations, ...fields } = before;
  const skip = new Set(["id", "businessId", "customFields", "passwordHash", "plainPassword"]);
  const rows = Object.entries(fields).filter(([k, v]) => !skip.has(k) && v !== null && v !== "" && v !== undefined);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <div className="text-[10px] uppercase tracking-wide text-gray-400">{k.replace(/([A-Z])/g, " $1")}</div>
            <div className="text-sm text-gray-800 break-words">{String(v)}</div>
          </div>
        ))}
      </div>
      {Array.isArray(items) && items.length > 0 && (
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1.5 text-left font-semibold text-gray-500">Item</th>
                <th className="px-2 py-1.5 text-right font-semibold text-gray-500">Qty</th>
                <th className="px-2 py-1.5 text-right font-semibold text-gray-500">Rate</th>
                <th className="px-2 py-1.5 text-right font-semibold text-gray-500">Taxable</th>
                <th className="px-2 py-1.5 text-right font-semibold text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((it: any, i: number) => (
                <tr key={i}>
                  <td className="px-2 py-1.5">{it.itemName}</td>
                  <td className="px-2 py-1.5 text-right">{Number(it.quantity)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt.currency(it.rate)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt.currency(it.taxableAmount)}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{fmt.currency(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ActivityLog() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [entityType, setEntityType] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [snapshot, setSnapshot] = useState<any>(null);
  const [snapLoading, setSnapLoading] = useState(false);
  const [retention, setRetention] = useState<string>("");
  const [showClearMenu, setShowClearMenu] = useState(false);
  const LIMIT = 50;

  const isAdmin = user?.role === "business_admin" || user?.role === "super_admin";

  const load = () => {
    if (!isAdmin) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (entityType) params.set("entityType", entityType);
    if (search.trim()) params.set("search", search.trim());
    api.get<{ data: LogRow[]; total: number }>(`/activity?${params}`)
      .then(r => { setRows(r.data); setTotal(r.total); setSelected(new Set()); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, from, to, entityType]);
  useEffect(() => {
    if (!isAdmin) return;
    api.get<{ retentionDays: number | null }>("/activity/settings/retention")
      .then(r => setRetention(r.retentionDays ? String(r.retentionDays) : ""))
      .catch(() => {});
  }, [isAdmin]);

  const openSnapshot = async (id: number) => {
    setSnapLoading(true); setSnapshot({ loading: true });
    try { setSnapshot(await api.get<any>(`/activity/${id}/snapshot`)); }
    catch { setSnapshot(null); alert("Snapshot load nahi hua"); }
    finally { setSnapLoading(false); }
  };

  const clearLogs = async (body: { ids?: number[]; before?: string; all?: boolean }, confirmMsg: string) => {
    if (!window.confirm(confirmMsg + "\n\nYeh records hamesha ke liye delete ho jayenge — wapas nahi aayenge.")) return;
    try {
      const r = await api.post<{ cleared: number }>("/activity/clear", body);
      alert(`${r.cleared} records clear ho gaye.`);
      setShowClearMenu(false); load();
    } catch { alert("Clear nahi hua. Dobara try karo."); }
  };

  const saveRetention = async () => {
    try {
      await api.patch("/activity/settings/retention", { retentionDays: retention ? Number(retention) : null });
      alert(retention ? `Set ho gaya — ${retention} din se purani history apne aap delete hogi.` : "Auto-cleanup band kar diya — history hamesha rahegi.");
    } catch { alert("Save nahi hua."); }
  };

  const exportExcel = async () => {
    const params = new URLSearchParams({ page: "1", limit: "200" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (entityType) params.set("entityType", entityType);
    if (search.trim()) params.set("search", search.trim());
    const all: LogRow[] = [];
    for (let p = 1; p <= 25; p++) {
      params.set("page", String(p));
      const r = await api.get<{ data: LogRow[]; total: number }>(`/activity?${params}`);
      all.push(...r.data);
      if (all.length >= r.total) break;
    }
    if (!all.length) { alert("Export ke liye koi records nahi."); return; }
    const ws = XLSX.utils.json_to_sheet(all.map((r, i) => ({
      "Sr": i + 1,
      "Date & Time": new Date(r.createdAt).toLocaleString("en-IN"),
      "User": r.userName || "",
      "Action": r.action,
      "Type": r.entityType,
      "Document": r.entityLabel || "",
      "Details": r.summary,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Activity");
    XLSX.writeFile(wb, `Activity_${from || "all"}_${to || "now"}.xlsx`);
  };

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto mt-16 bg-white rounded-xl border border-gray-200 p-8 text-center">
        <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <div className="font-semibold text-gray-800">Sirf Admin</div>
        <p className="text-sm text-gray-500 mt-1">Activity sirf business admin dekh sakta hai.</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><History className="w-6 h-6 text-slate-500" /> Activity</h1>
          <p className="text-xs text-gray-400 mt-0.5">Aapke business mein kisne kya kiya — sirf aap dekh sakte hain</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 border border-green-400 text-green-700 bg-green-50 hover:bg-green-100 text-xs font-medium rounded-lg transition-colors">
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
          <div className="relative">
            <button onClick={() => setShowClearMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-600 bg-red-50 hover:bg-red-100 text-xs font-medium rounded-lg transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
            {showClearMenu && (
              <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 text-sm">
                <button disabled={selected.size === 0}
                  onClick={() => clearLogs({ ids: [...selected] }, `${selected.size} selected records clear karein?`)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-40">Selected ({selected.size}) clear karo</button>
                <button disabled={!to && !from}
                  onClick={() => clearLogs({ before: to || from }, `${to || from} tak ki saari history clear karein?`)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-40">Filter date tak clear karo</button>
                <button onClick={() => clearLogs({ all: true }, "PURI activity history clear karein?")}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600">Sab clear karo</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Type</label>
          <select value={entityType} onChange={e => { setEntityType(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm">
            {ENTITY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-gray-500 mb-1">Search</label>
          <div className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && (setPage(1), load())}
              placeholder="Invoice no, party, user..." className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm" />
            <button onClick={() => { setPage(1); load(); }} className="px-3 py-1.5 bg-slate-700 text-white text-xs rounded-lg">Go</button>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1" title="Khali chhodo = history hamesha rahegi">Auto-delete (din)</label>
            <input type="number" min={1} value={retention} onChange={e => setRetention(e.target.value)} placeholder="off"
              className="w-20 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm" />
          </div>
          <button onClick={saveRetention} className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50">Save</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Koi activity records nahi</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2 w-8"><input type="checkbox"
                    checked={selected.size === rows.length && rows.length > 0}
                    onChange={e => setSelected(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())} /></th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Kab</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">User</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Action</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Details</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2"><input type="checkbox" checked={selected.has(r.id)}
                      onChange={e => setSelected(s => { const n = new Set(s); e.target.checked ? n.add(r.id) : n.delete(r.id); return n; })} /></td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-800 whitespace-nowrap">{r.userName || "—"}</td>
                    <td className="px-3 py-2"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ACTION_STYLE[r.action] || "bg-gray-100 text-gray-600"}`}>{r.action}</span></td>
                    <td className="px-3 py-2 text-sm text-gray-700">{r.summary}</td>
                    <td className="px-3 py-2">
                      {r.hasSnapshot && (
                        <button onClick={() => openSnapshot(r.id)} title="Purana record dekho"
                          className="text-gray-400 hover:text-blue-600"><Eye className="w-4 h-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-xs text-gray-500">
            <span>{total} records</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 border rounded disabled:opacity-40">Prev</button>
              <span>Page {page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border rounded disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Snapshot modal */}
      {snapshot && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSnapshot(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <div className="font-semibold text-gray-800 text-sm">Purana record (change se pehle)</div>
                {!snapLoading && snapshot.createdAt && (
                  <div className="text-xs text-gray-400">{snapshot.userName} — {new Date(snapshot.createdAt).toLocaleString("en-IN")}</div>
                )}
              </div>
              <button onClick={() => setSnapshot(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              {snapLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
              ) : (
                <SnapshotView data={snapshot} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
