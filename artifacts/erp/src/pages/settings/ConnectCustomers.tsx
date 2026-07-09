import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Loader2, Smartphone, ShieldAlert, Unplug, Ban, CheckCircle2 } from "lucide-react";

// BizCor Connect — supplier's view of which customers' apps are linked to his
// business. Deliberately quiet: this page is the ONLY place sharing is visible.
// Sirf un customers ka data share hota hai jinko supplier ne khud PIN diya hai.

type Conn = {
  id: number; partyId: number; partyName: string | null;
  customerMobile: string | null; customerName: string | null;
  permissions: { invoice?: boolean; payment?: boolean; statement?: boolean; gallery?: boolean } | null;
  status: "active" | "blocked"; createdAt: string;
};

const PERMS = [
  ["invoice", "Invoices"],
  ["payment", "Payments"],
  ["statement", "Statement"],
  ["gallery", "Gallery"],
] as const;

export default function ConnectCustomers() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Conn[] | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  const isAdmin = user?.role === "business_admin" || user?.role === "super_admin";

  const load = () => {
    api.get<Conn[]>("/connect/connections").then(setRows).catch(() => setRows([]));
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const updateConn = async (id: number, body: Record<string, unknown>) => {
    setSaving(id);
    try { await api.patch(`/connect/connections/${id}`, body); load(); }
    catch { alert("Save nahi hua. Dobara try karo."); }
    finally { setSaving(null); }
  };

  const disconnect = async (c: Conn) => {
    if (!window.confirm(`"${c.partyName}" ko disconnect karein?\n\nUnki app se aapka business hat jayega (chat bhi delete hogi). Wapas connect karne ke liye unhe phir se business code + PIN daalna hoga.`)) return;
    setSaving(c.id);
    try { await api.delete(`/connect/connections/${c.id}`); load(); }
    catch { alert("Disconnect nahi hua. Dobara try karo."); }
    finally { setSaving(null); }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto mt-16 bg-white rounded-xl border border-gray-200 p-8 text-center">
        <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <div className="font-semibold text-gray-800">Sirf Admin</div>
        <p className="text-sm text-gray-500 mt-1">Yeh section sirf business admin dekh sakta hai.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-slate-500" /> BizCor Connect
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Sirf un customers ka data share hota hai jinko aapne Party master mein PIN diya hai — aur sirf wahi jo yahan allow hai.
        </p>
      </div>

      {rows === null ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Smartphone className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <div className="text-sm text-gray-500">Abhi koi customer connected nahi hai</div>
          <p className="text-xs text-gray-400 mt-1">Customer ko connect karne ke liye: Party master mein PIN set karo, phir customer ko business code + PIN do.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(c => {
            const p = c.permissions || {};
            const busy = saving === c.id;
            return (
              <div key={c.id} className={`bg-white rounded-xl border p-4 ${c.status === "blocked" ? "border-red-200 bg-red-50/30" : "border-gray-200"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold text-gray-800 flex items-center gap-2">
                      {c.partyName || "—"}
                      {c.status === "blocked" && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Blocked</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      📱 {c.customerMobile || "—"}{c.customerName ? ` (${c.customerName})` : ""} · connected {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.status === "active" ? (
                      <button disabled={busy} onClick={() => updateConn(c.id, { status: "blocked" })}
                        title="Temporarily block — connection bani rahegi par app mein kuch nahi dikhega"
                        className="flex items-center gap-1 px-2.5 py-1.5 border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 text-xs font-medium rounded-lg disabled:opacity-40">
                        <Ban className="w-3.5 h-3.5" /> Block
                      </button>
                    ) : (
                      <button disabled={busy} onClick={() => updateConn(c.id, { status: "active" })}
                        className="flex items-center gap-1 px-2.5 py-1.5 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-xs font-medium rounded-lg disabled:opacity-40">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Unblock
                      </button>
                    )}
                    <button disabled={busy} onClick={() => disconnect(c)}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-red-300 text-red-600 bg-red-50 hover:bg-red-100 text-xs font-medium rounded-lg disabled:opacity-40">
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />} Disconnect
                    </button>
                  </div>
                </div>
                {/* Permission toggles */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                  <span className="text-xs text-gray-400">Customer app mein dikhega:</span>
                  {PERMS.map(([key, label]) => {
                    const on = key === "gallery" ? p[key] === true : p[key] !== false;
                    return (
                      <button key={key} disabled={busy}
                        onClick={() => updateConn(c.id, { permissions: { ...p, [key]: !on } })}
                        className="flex items-center gap-1.5 text-xs disabled:opacity-40">
                        <span className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${on ? "bg-green-500" : "bg-gray-300"}`}>
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
                        </span>
                        <span className={on ? "text-gray-700 font-medium" : "text-gray-400"}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
