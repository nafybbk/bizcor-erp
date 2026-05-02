import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Search, Loader2 } from "lucide-react";

export default function AdminBusinesses() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    api.get<any>(`/super-admin/businesses?${params}`)
      .then(r => { setBusinesses(r.data); setTotal(r.total); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, search, status]);

  const toggleStatus = async (id: number, current: string) => {
    const newStatus = current === "active" ? "inactive" : "active";
    await api.patch(`/super-admin/businesses/${id}`, { status: newStatus });
    load();
  };

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">All Businesses</h1>
        <span className="text-sm text-gray-500">{total} total</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Business</th>
                <th className="text-left px-4 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">GSTIN</th>
                <th className="text-left px-4 py-3 font-medium">State</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Registered</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {businesses.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{b.name}</div>
                    {b.businessType && <div className="text-xs text-gray-400 capitalize">{b.businessType}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-blue-600 font-bold">{b.businessCode}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.gstin || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{b.state || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "active" ? "bg-green-100 text-green-700" : b.status === "suspended" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmt.date(b.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleStatus(b.id, b.status)} className={`text-xs px-2 py-1 rounded font-medium ${b.status === "active" ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}>
                      {b.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
