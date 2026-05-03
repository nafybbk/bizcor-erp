import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Building2, Users, TrendingUp, Loader2, CreditCard, FlaskConical } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [softwareName, setSoftwareName] = useState(localStorage.getItem("erp_app_name") || "BizERP");

  useEffect(() => {
    api.get<any>("/super-admin/stats").then(setStats).catch(console.error).finally(() => setLoading(false));
    api.get<any>("/super-admin/settings").then(s => { if (s.softwareName) setSoftwareName(s.softwareName); }).catch(() => {});
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tech Support Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">{softwareName} — Platform Overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Building2 className="w-5 h-5 text-blue-600" /></div>
            <div><div className="text-sm text-gray-500">Total Businesses</div><div className="text-2xl font-bold">{stats?.totalBusinesses}</div></div>
          </div>
          <div className="mt-2 text-xs text-green-600">{stats?.activeBusinesses} active</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center"><FlaskConical className="w-5 h-5 text-orange-600" /></div>
            <div><div className="text-sm text-gray-500">On Trial</div><div className="text-2xl font-bold">{stats?.trialBusinesses || 0}</div></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-purple-600" /></div>
            <div><div className="text-sm text-gray-500">Total Users</div><div className="text-2xl font-bold">{stats?.totalUsers}</div></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5 text-green-600" /></div>
            <div><div className="text-sm text-gray-500">New This Month</div><div className="text-2xl font-bold">{stats?.newBusinessesThisMonth || 0}</div></div>
          </div>
        </div>
      </div>

      {stats?.planBreakdown?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-4 text-sm flex items-center gap-2"><CreditCard className="w-4 h-4" /> Businesses by Plan</h3>
          <div className="space-y-3">
            {stats.planBreakdown.map((p: any, i: number) => {
              const pct = stats.totalBusinesses > 0 ? Math.round((p.count / stats.totalBusinesses) * 100) : 0;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">{p.planName}</span>
                    <span className="font-bold text-gray-900">{p.count} <span className="text-gray-400 font-normal text-xs">({pct}%)</span></span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
