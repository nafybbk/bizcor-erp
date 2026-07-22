import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Smartphone, Users, Link2, ShieldAlert, RefreshCw, Loader2, Clock, Wifi, WifiOff, FileText, CreditCard, Images } from "lucide-react";
import { useLang } from "@/lib/langHook";

interface ConnectSummary {
  totalCustomers: number;
  totalConnections: number;
  newDeviceEventsToday: number;
  sharedInvoices: number;
  sharedPayments: number;
  sharedImages: number;
}

export default function AdminConnectActivity() {
  const lang = useLang();
  const [summary, setSummary] = useState<ConnectSummary | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, l, a] = await Promise.all([
        api.get<any>("/super-admin/connect-activity/summary"),
        api.get<any[]>("/super-admin/connect-activity/logins"),
        api.get<any[]>("/super-admin/connect-activity/active"),
      ]);
      setSummary(s || null);
      setLogs(Array.isArray(l) ? l : []);
      setActive(Array.isArray(a) ? a : []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const formatTime = (d: string) => {
    const date = new Date(d);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    const sfx = lang === "hi" ? "pehle" : "ago";
    if (diff < 60) return `${diff}s ${sfx}`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${sfx}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ${sfx}`;
    return fmt.date(d);
  };

  const maskDevice = (id: string | null) => (id ? `${id.slice(0, 6)}…${id.slice(-4)}` : "—");

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-emerald-500" /> Connect Activity
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {lang === "hi" ? "BizCor Connect app ke customer logins aur device movement — business se alag, sirf yahan" : "BizCor Connect app customer logins and device movement — separate from per-business activity"}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> {lang === "hi" ? "Refresh" : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Users className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <div className="text-xl font-bold text-gray-900">{summary?.totalCustomers ?? 0}</div>
                <div className="text-xs text-gray-500">{lang === "hi" ? "Total Connect customers" : "Total Connect customers"}</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center"><Link2 className="w-5 h-5 text-indigo-600" /></div>
              <div>
                <div className="text-xl font-bold text-gray-900">{summary?.totalConnections ?? 0}</div>
                <div className="text-xs text-gray-500">{lang === "hi" ? "Total business connections" : "Total business connections"}</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><ShieldAlert className="w-5 h-5 text-amber-600" /></div>
              <div>
                <div className="text-xl font-bold text-gray-900">{summary?.newDeviceEventsToday ?? 0}</div>
                <div className="text-xs text-gray-500">{lang === "hi" ? "Naye device se login (24h)" : "New-device logins (24h)"}</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><FileText className="w-5 h-5 text-blue-600" /></div>
              <div>
                <div className="text-xl font-bold text-gray-900">{summary?.sharedInvoices ?? 0}</div>
                <div className="text-xs text-gray-500">{lang === "hi" ? "Shared invoices" : "Shared invoices"}</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center"><CreditCard className="w-5 h-5 text-green-600" /></div>
              <div>
                <div className="text-xl font-bold text-gray-900">{summary?.sharedPayments ?? 0}</div>
                <div className="text-xs text-gray-500">{lang === "hi" ? "Shared payments" : "Shared payments"}</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center"><Images className="w-5 h-5 text-pink-600" /></div>
              <div>
                <div className="text-xl font-bold text-gray-900">{summary?.sharedImages ?? 0}</div>
                <div className="text-xs text-gray-500">{lang === "hi" ? "Shared gallery images" : "Shared gallery images"}</div>
              </div>
            </div>
          </div>

          {/* Currently active */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
              <Wifi className="w-4 h-4 text-green-500" />
              {lang === "hi" ? `Abhi Active (${active.length})` : `Currently Active (${active.length})`}
              <span className="text-xs text-gray-400 font-normal">
                {lang === "hi" ? "(last 15 min mein active)" : "(active in last 15 min)"}
              </span>
            </h2>
            {active.length === 0 ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                <WifiOff className="w-4 h-4" />
                {lang === "hi" ? "Koi bhi customer abhi online nahi hai" : "No customer is online right now"}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {active.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-green-100 bg-green-50">
                    <div className="w-9 h-9 rounded-full bg-green-200 flex items-center justify-center text-green-800 font-bold text-sm flex-shrink-0">
                      {(c.name || c.mobile || "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">{c.name || c.mobile}</div>
                      <div className="text-xs text-gray-500 truncate">{c.businessName || c.customerId}</div>
                      <div className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                        {c.lastDeviceSeenAt ? formatTime(c.lastDeviceSeenAt) : "Active"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Login logs */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-800">
                {lang === "hi" ? `Recent Connect Logins (${logs.length})` : `Recent Connect Logins (${logs.length})`}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Mobile</th>
                    <th className="px-4 py-3 text-left">Device</th>
                    <th className="px-4 py-3 text-left">Movement</th>
                    <th className="px-4 py-3 text-left">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-gray-400 py-8">
                      {lang === "hi" ? "Abhi koi data nahi" : "No data yet"}
                    </td></tr>
                  ) : logs.map((log, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs flex-shrink-0">
                            {(log.customerName || log.mobile || "?")[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{log.customerName || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{log.mobile}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{maskDevice(log.deviceId)}</td>
                      <td className="px-4 py-3">
                        {log.newDeviceWarning ? (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 w-fit">
                            <ShieldAlert className="w-3 h-3" /> {lang === "hi" ? "Naya device" : "New device"}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">{lang === "hi" ? "Same device" : "Same device"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatTime(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
