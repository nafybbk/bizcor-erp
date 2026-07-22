import { useEffect, useMemo, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Smartphone, Users, Link2, ShieldAlert, RefreshCw, Loader2, Clock, Wifi, WifiOff, FileText, CreditCard, Images, Building2, ChevronDown, ChevronRight } from "lucide-react";
import { useLang } from "@/lib/langHook";

// Every list section collapses by default — the heading alone shows the
// count so the page reads as a quick summary; clicking a heading expands
// just that one section instead of always rendering every table at once.
function Section({ icon, title, count, defaultOpen = false, children }: { icon: React.ReactNode; title: string; count: number; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-4 flex items-center gap-2 text-left hover:bg-gray-50"
      >
        {icon}
        <h2 className="text-base font-semibold text-gray-800 flex-1">
          {title} <span className="text-gray-400 font-normal">({count})</span>
        </h2>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100">{children}</div>}
    </div>
  );
}

interface ConnectSummary {
  totalCustomers: number;
  totalConnections: number;
  newDeviceEventsToday: number;
  sharedInvoices: number;
  sharedPayments: number;
  sharedImages: number;
}

interface ConnectionRow {
  connectionId: number;
  customerId: number;
  customerCode: string;
  customerName: string | null;
  mobile: string;
  lastDeviceSeenAt: string | null;
  businessId: number;
  businessName: string;
  status: string;
  connectedAt: string;
  invoicesShared: number;
  paymentsShared: number;
  imagesShared: number;
  lastImageSharedAt: string | null;
}

export default function AdminConnectActivity() {
  const lang = useLang();
  const [summary, setSummary] = useState<ConnectSummary | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, l, a, c] = await Promise.all([
        api.get<any>("/super-admin/connect-activity/summary"),
        api.get<any[]>("/super-admin/connect-activity/logins"),
        api.get<any[]>("/super-admin/connect-activity/active"),
        api.get<ConnectionRow[]>("/super-admin/connect-activity/connections"),
      ]);
      setSummary(s || null);
      setLogs(Array.isArray(l) ? l : []);
      setActive(Array.isArray(a) ? a : []);
      setConnections(Array.isArray(c) ? c : []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const formatTime = (d: string | null) => {
    if (!d) return "—";
    const date = new Date(d);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    const sfx = lang === "hi" ? "pehle" : "ago";
    if (diff < 60) return `${diff}s ${sfx}`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${sfx}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ${sfx}`;
    return fmt.date(d);
  };

  const maskDevice = (id: string | null) => (id ? `${id.slice(0, 6)}…${id.slice(-4)}` : "—");

  // Businesses and Customers lists are both derived from the same
  // /connections rows (real data, no separate placeholder endpoint) —
  // one grouped by business, one grouped by customer.
  const businesses = useMemo(() => {
    const map = new Map<number, { businessId: number; businessName: string; customers: Set<number>; invoices: number; payments: number; images: number }>();
    for (const r of connections) {
      let b = map.get(r.businessId);
      if (!b) { b = { businessId: r.businessId, businessName: r.businessName, customers: new Set(), invoices: 0, payments: 0, images: 0 }; map.set(r.businessId, b); }
      b.customers.add(r.customerId);
      b.invoices += r.invoicesShared;
      b.payments += r.paymentsShared;
      b.images += r.imagesShared;
    }
    return Array.from(map.values()).sort((x, y) => y.customers.size - x.customers.size);
  }, [connections]);

  const customers = useMemo(() => {
    const map = new Map<number, { customerId: number; customerName: string | null; mobile: string; lastDeviceSeenAt: string | null; businesses: Set<string>; invoices: number; payments: number; images: number }>();
    for (const r of connections) {
      let c = map.get(r.customerId);
      if (!c) { c = { customerId: r.customerId, customerName: r.customerName, mobile: r.mobile, lastDeviceSeenAt: r.lastDeviceSeenAt, businesses: new Set(), invoices: 0, payments: 0, images: 0 }; map.set(r.customerId, c); }
      c.businesses.add(r.businessName);
      c.invoices += r.invoicesShared;
      c.payments += r.paymentsShared;
      c.images += r.imagesShared;
    }
    return Array.from(map.values()).sort((x, y) => (y.lastDeviceSeenAt || "").localeCompare(x.lastDeviceSeenAt || ""));
  }, [connections]);

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
          <Section icon={<Wifi className="w-4 h-4 text-green-500" />} title={lang === "hi" ? "Abhi Active" : "Currently Active"} count={active.length}>
            <div className="p-5">
              <div className="text-xs text-gray-400 mb-3">{lang === "hi" ? "(last 15 min mein active)" : "(active in last 15 min)"}</div>
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
                        <div className="text-xs text-gray-500 truncate">{c.mobile}</div>
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
          </Section>

          {/* Connect Businesses */}
          <Section icon={<Building2 className="w-4 h-4 text-gray-500" />} title="Connect Businesses" count={businesses.length}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Business</th>
                    <th className="px-4 py-3 text-right">Customers</th>
                    <th className="px-4 py-3 text-right">Invoices</th>
                    <th className="px-4 py-3 text-right">Payments</th>
                    <th className="px-4 py-3 text-right">Images</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {businesses.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-gray-400 py-8">{lang === "hi" ? "Abhi koi Connect business nahi" : "No Connect businesses yet"}</td></tr>
                  ) : businesses.map((b) => (
                    <tr key={b.businessId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{b.businessName}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{b.customers.size}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{b.invoices}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{b.payments}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{b.images}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Connect Customers */}
          <Section icon={<Users className="w-4 h-4 text-gray-500" />} title="Connect Customers" count={customers.length}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Mobile</th>
                    <th className="px-4 py-3 text-right">Businesses</th>
                    <th className="px-4 py-3 text-right">Invoices</th>
                    <th className="px-4 py-3 text-right">Payments</th>
                    <th className="px-4 py-3 text-right">Images</th>
                    <th className="px-4 py-3 text-left">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customers.length === 0 ? (
                    <tr><td colSpan={7} className="text-center text-gray-400 py-8">{lang === "hi" ? "Abhi koi Connect customer nahi" : "No Connect customers yet"}</td></tr>
                  ) : customers.map((c) => (
                    <tr key={c.customerId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.customerName || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.mobile}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{c.businesses.size}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{c.invoices}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{c.payments}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{c.images}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatTime(c.lastDeviceSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Per customer × business movement detail */}
          <Section icon={<Link2 className="w-4 h-4 text-gray-500" />} title="Connections — Data Movement Detail" count={connections.length}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Business</th>
                    <th className="px-4 py-3 text-right">Invoices</th>
                    <th className="px-4 py-3 text-right">Payments</th>
                    <th className="px-4 py-3 text-right">Images</th>
                    <th className="px-4 py-3 text-left">Connected</th>
                    <th className="px-4 py-3 text-left">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {connections.length === 0 ? (
                    <tr><td colSpan={7} className="text-center text-gray-400 py-8">{lang === "hi" ? "Abhi koi connection nahi" : "No connections yet"}</td></tr>
                  ) : connections.map((r) => (
                    <tr key={r.connectionId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{r.customerName || "—"}</div>
                        <div className="text-xs text-gray-500 font-mono">{r.mobile}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{r.businessName}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.invoicesShared}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.paymentsShared}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.imagesShared}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt.date(r.connectedAt)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatTime(r.lastDeviceSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Login logs */}
          <Section icon={<Clock className="w-4 h-4 text-gray-500" />} title="Recent Connect Logins" count={logs.length}>
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
          </Section>
        </>
      )}
    </div>
  );
}
