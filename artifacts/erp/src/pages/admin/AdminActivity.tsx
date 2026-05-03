import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Activity, MapPin, Monitor, Wifi, WifiOff, RefreshCw, Loader2, Clock, User, Building2 } from "lucide-react";

export default function AdminActivity() {
  const [logs, setLogs] = useState<any[]>([]);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [l, a] = await Promise.all([
        api.get<any[]>("/super-admin/login-logs"),
        api.get<any[]>("/super-admin/active-users"),
      ]);
      setLogs(Array.isArray(l) ? l : []);
      setActiveUsers(Array.isArray(a) ? a : []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const formatTime = (d: string) => {
    const date = new Date(d);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s pehle`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m pehle`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h pehle`;
    return fmt.date(d);
  };

  const roleLabel = (r: string) => r === "super_admin" ? "Tech Admin" : r === "business_admin" ? "Biz Admin" : "Staff";
  const roleBadge = (r: string) => r === "super_admin"
    ? "bg-yellow-100 text-yellow-700"
    : r === "business_admin" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600";

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-500" /> Login Activity
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Sabhi logins, active users, aur GPS location</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : (
        <>
          {/* Active users */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
              <Wifi className="w-4 h-4 text-green-500" />
              Abhi Active ({activeUsers.length})
              <span className="text-xs text-gray-400 font-normal">(last 15 min mein active)</span>
            </h2>
            {activeUsers.length === 0 ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                <WifiOff className="w-4 h-4" /> Koi bhi abhi online nahi hai
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeUsers.map((u, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-green-100 bg-green-50">
                    <div className="w-9 h-9 rounded-full bg-green-200 flex items-center justify-center text-green-800 font-bold text-sm flex-shrink-0">
                      {(u.name || "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">{u.name}</div>
                      <div className="text-xs text-gray-500 truncate">{u.businessName || "—"}</div>
                      <div className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                        {u.lastSeenAt ? formatTime(u.lastSeenAt) : "Active"}
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
              <h2 className="text-base font-semibold text-gray-800">Recent Logins ({logs.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-left">Business</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">IP</th>
                    <th className="px-4 py-3 text-left">Location (GPS)</th>
                    <th className="px-4 py-3 text-left">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-gray-400 py-8">Koi login log nahi mila</td></tr>
                  ) : logs.map((log, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs flex-shrink-0">
                            {(log.userName || "?")[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{log.userName || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{log.businessName || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(log.role)}`}>
                          {roleLabel(log.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{log.ipAddress || "—"}</td>
                      <td className="px-4 py-3">
                        {log.latitude && log.longitude ? (
                          <a
                            href={`https://maps.google.com/?q=${log.latitude},${log.longitude}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-indigo-600 hover:underline text-xs"
                          >
                            <MapPin className="w-3 h-3" />
                            {Number(log.latitude).toFixed(4)}, {Number(log.longitude).toFixed(4)}
                          </a>
                        ) : (
                          <span className="text-gray-300 text-xs">GPS nahi mila</span>
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
