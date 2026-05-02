import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Building2, Users, TrendingUp, Loader2 } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<any>("/super-admin/stats").then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Building2 className="w-5 h-5 text-blue-600" /></div>
            <div><div className="text-sm text-gray-500">Total Businesses</div><div className="text-2xl font-bold">{stats?.totalBusinesses}</div></div>
          </div>
          <div className="mt-2 text-xs text-green-600">{stats?.activeBusinesses} active</div>
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
          <h3 className="font-semibold text-gray-700 mb-4 text-sm">Businesses by Plan</h3>
          <div className="space-y-2">
            {stats.planBreakdown.map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{p.planName}</span>
                <span className="font-bold text-gray-900">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
