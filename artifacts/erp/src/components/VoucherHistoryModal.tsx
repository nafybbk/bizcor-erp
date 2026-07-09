import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Loader2, X, Eye, History } from "lucide-react";

// Admin-only revision history for one voucher — every edit/delete entry with a
// click-through to the full snapshot of the document as it was BEFORE that change.

type Entry = {
  id: number; userName: string | null; action: string; summary: string;
  hasSnapshot: boolean; createdAt: string;
};

const ACTION_STYLE: Record<string, string> = {
  created: "bg-green-100 text-green-700",
  edited: "bg-blue-100 text-blue-700",
  deleted: "bg-red-100 text-red-700",
  restored: "bg-amber-100 text-amber-700",
};

function Snapshot({ details }: { details: any }) {
  const before = details?.before;
  if (!before) return null;
  const { items, ...fields } = before;
  const show = ["voucherNumber", "date", "status", "taxableAmount", "totalTax", "grandTotal", "notes"];
  return (
    <div className="mt-2 bg-gray-50 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {show.filter(k => fields[k] !== null && fields[k] !== undefined && fields[k] !== "").map(k => (
          <div key={k}>
            <div className="text-[10px] uppercase text-gray-400">{k.replace(/([A-Z])/g, " $1")}</div>
            <div className="text-xs text-gray-800">{["taxableAmount","totalTax","grandTotal"].includes(k) ? fmt.currency(fields[k]) : String(fields[k])}</div>
          </div>
        ))}
      </div>
      {Array.isArray(items) && items.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400">
              <th className="text-left font-medium py-1">Item</th>
              <th className="text-right font-medium py-1">Qty</th>
              <th className="text-right font-medium py-1">Rate</th>
              <th className="text-right font-medium py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any, i: number) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="py-1">{it.itemName}</td>
                <td className="py-1 text-right">{Number(it.quantity)}</td>
                <td className="py-1 text-right">{fmt.currency(it.rate)}</td>
                <td className="py-1 text-right font-semibold">{fmt.currency(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function VoucherHistoryModal({ voucherId, onClose }: { voucherId: number; onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [openSnap, setOpenSnap] = useState<Record<number, any>>({});

  useEffect(() => {
    api.get<Entry[]>(`/activity/entity/voucher/${voucherId}`)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [voucherId]);

  const toggleSnapshot = async (id: number) => {
    if (openSnap[id]) { setOpenSnap(s => { const n = { ...s }; delete n[id]; return n; }); return; }
    try {
      const r = await api.get<any>(`/activity/${id}/snapshot`);
      setOpenSnap(s => ({ ...s, [id]: r.details }));
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 no-print" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" /> Document History
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">
          {entries === null ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
          ) : entries.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-6">Is document ki koi history nahi — kabhi change nahi hua</div>
          ) : (
            <div className="space-y-3">
              {entries.map(e => (
                <div key={e.id} className="border border-gray-100 rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${ACTION_STYLE[e.action] || "bg-gray-100 text-gray-600"}`}>{e.action}</span>
                      <span className="text-sm text-gray-700 truncate">{e.summary}</span>
                    </div>
                    {e.hasSnapshot && (
                      <button onClick={() => toggleSnapshot(e.id)} title="Purana record dekho"
                        className={`flex-shrink-0 ${openSnap[e.id] ? "text-blue-600" : "text-gray-400 hover:text-blue-600"}`}>
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {e.userName || "—"} · {new Date(e.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {openSnap[e.id] && <Snapshot details={openSnap[e.id]} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
