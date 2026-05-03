import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getDraftCount } from "@/lib/offlineQueue";
import {
  LayoutDashboard, FileText, ShoppingCart, CreditCard, Package, BookOpen,
  FileBarChart2, Settings, Users, ChevronDown, ChevronRight, LogOut,
  Building2, Menu, X, ShieldCheck, Receipt, Wallet,
  TrendingUp, BarChart3, ClipboardList, Wifi, WifiOff, Headphones, Download,
  UserCircle, CloudOff,
} from "lucide-react";

interface NavItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  children?: NavItem[];
}

function NavLink({ href, icon, active, children }: { href: string; icon?: React.ReactNode; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href}>
      <a className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
        active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-700 hover:text-white"}`}>
        {icon}
        <span className="truncate">{children}</span>
      </a>
    </Link>
  );
}

function NavGroup({ item, location }: { item: NavItem; location: string }) {
  const isChildActive = item.children?.some(c => c.href === location);
  const [open, setOpen] = useState(isChildActive);

  useEffect(() => { if (isChildActive) setOpen(true); }, [location]);

  if (!item.children) {
    return (
      <NavLink href={item.href!} icon={item.icon} active={location === item.href}>
        {item.label}
      </NavLink>
    );
  }

  return (
    <div>
      <button onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
          isChildActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-700 hover:text-white"}`}>
        {item.icon}
        <span className="flex-1 text-left">{item.label}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="ml-3 pl-3 border-l border-slate-700 mt-0.5 space-y-0.5">
          {item.children.map((child, i) => (
            <NavLink key={i} href={child.href!} icon={child.icon} active={location === child.href}>
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, business, logout, isSuperAdmin } = useAuth();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [softwareName, setSoftwareName] = useState("BizERP");
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [bizLogo, setBizLogo] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState(getDraftCount());
  const [showDraftNotice, setShowDraftNotice] = useState(false);

  // Load firm logo
  const loadLogo = useCallback(() => {
    const cached = localStorage.getItem("erp_biz_profile");
    if (cached) {
      try { const p = JSON.parse(cached); if (p.logo) setBizLogo(p.logo); } catch { }
    }
    if (!isSuperAdmin()) {
      api.get<any>("/businesses/current").then(b => {
        if (b.logo) setBizLogo(b.logo);
        else setBizLogo(null);
        localStorage.setItem("erp_biz_profile", JSON.stringify(b));
      }).catch(() => {});
    }
  }, []);

  // Track offline draft count
  const refreshDraftCount = useCallback(() => {
    setDraftCount(getDraftCount());
  }, []);

  useEffect(() => {
    loadLogo();

    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => { setInstalled(true); setInstallPrompt(null); });
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);

    // Offline queue listener
    window.addEventListener("offline-queue-change", refreshDraftCount);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("offline-queue-change", refreshDraftCount);
    };
  }, []);

  useEffect(() => {
    const checkOnline = () => {
      const wasOffline = !isOnline;
      api.get("/healthz").then(() => {
        setIsOnline(true);
        // Came back online — remind user about drafts
        if (wasOffline && getDraftCount() > 0) setShowDraftNotice(true);
      }).catch(() => setIsOnline(false));
    };
    checkOnline();
    const interval = setInterval(checkOnline, 30000);

    const cached = localStorage.getItem("erp_app_name");
    if (cached) setSoftwareName(cached);
    if (isSuperAdmin()) {
      api.get<any>("/super-admin/settings").then(s => {
        if (s.softwareName) { setSoftwareName(s.softwareName); localStorage.setItem("erp_app_name", s.softwareName); }
      }).catch(() => {});
    }

    return () => clearInterval(interval);
  }, []);

  // Reload logo when navigating back from profile/settings
  useEffect(() => {
    if (location === "/" || location === "/settings/business") loadLogo();
  }, [location]);

  const businessNav: NavItem[] = [
    { label: "Dashboard", href: "/", icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      label: "Sales", icon: <TrendingUp className="w-4 h-4" />,
      children: [
        { label: "Invoices", href: "/sales/invoices" },
        { label: "Credit Notes", href: "/sales/credit-notes" },
      ],
    },
    {
      label: "Purchases", icon: <ShoppingCart className="w-4 h-4" />,
      children: [
        { label: "Bills", href: "/purchases/bills" },
        { label: "Debit Notes", href: "/purchases/debit-notes" },
      ],
    },
    {
      label: "Payments", icon: <Wallet className="w-4 h-4" />,
      children: [
        { label: "Receipts", href: "/payments/receipts" },
        { label: "Payments", href: "/payments/payments" },
        { label: "Outstanding", href: "/payments/outstanding" },
      ],
    },
    { label: "Inventory", href: "/inventory", icon: <Package className="w-4 h-4" /> },
    {
      label: "Accounting", icon: <BookOpen className="w-4 h-4" />,
      children: [
        { label: "Party Ledger", href: "/accounting/ledger" },
        { label: "Trial Balance", href: "/accounting/trial-balance" },
        { label: "Receivables", href: "/accounting/receivables" },
        { label: "Payables", href: "/accounting/payables" },
      ],
    },
    {
      label: "GST Reports", icon: <FileBarChart2 className="w-4 h-4" />,
      children: [
        { label: "GSTR-1", href: "/gst/gstr1" },
        { label: "GSTR-3B", href: "/gst/gstr3b" },
      ],
    },
    {
      label: "Masters", icon: <ClipboardList className="w-4 h-4" />,
      children: [
        { label: "Customers", href: "/masters/customers" },
        { label: "Suppliers", href: "/masters/suppliers" },
        { label: "All Parties", href: "/masters/parties" },
        { label: "Items", href: "/masters/items" },
        { label: "Units", href: "/masters/units" },
        { label: "HSN Codes", href: "/masters/hsn" },
        { label: "Tax Rates", href: "/masters/tax-rates" },
      ],
    },
    { label: "Users", href: "/settings/users", icon: <Users className="w-4 h-4" /> },
    { label: "Settings", href: "/settings/business", icon: <Settings className="w-4 h-4" /> },
  ];

  const superAdminNav: NavItem[] = [
    { label: "Dashboard", href: "/", icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: "Businesses", href: "/admin/businesses", icon: <Building2 className="w-4 h-4" /> },
    { label: "Plans", href: "/admin/plans", icon: <CreditCard className="w-4 h-4" /> },
    { label: "Tech Support Accounts", href: "/admin/super-admins", icon: <ShieldCheck className="w-4 h-4" /> },
    { label: "App Settings", href: "/admin/settings", icon: <Settings className="w-4 h-4" /> },
  ];

  const navItems = isSuperAdmin() ? superAdminNav : businessNav;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-56" : "w-0 overflow-hidden"} bg-slate-900 flex-shrink-0 flex flex-col transition-all duration-200`}>

        {/* Firm Header — clickable → Firm Profile */}
        <Link href="/profile">
          <a className="block p-4 border-b border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer group">
            <div className="flex items-center gap-2.5">
              {/* Logo or icon */}
              <div className="w-8 h-8 flex-shrink-0 rounded-lg overflow-hidden bg-blue-600 flex items-center justify-center">
                {bizLogo
                  ? <img src={bizLogo} alt="Logo" className="w-full h-full object-contain" />
                  : <Building2 className="w-4 h-4 text-white" />
                }
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-white font-bold text-sm leading-tight truncate">{softwareName}</div>
                {business && <div className="text-slate-400 text-xs truncate group-hover:text-blue-400">{business.name}</div>}
                {isSuperAdmin() && <div className="text-yellow-400 text-xs flex items-center gap-1"><ShieldCheck className="w-3 h-3" />Tech Support</div>}
              </div>
            </div>
          </a>
        </Link>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item, i) => (
            <NavGroup key={i} item={item} location={location} />
          ))}
        </nav>

        {/* Bottom — User + status */}
        <div className="p-3 border-t border-slate-700 space-y-1.5">
          {/* Online/Offline */}
          <div className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs ${isOnline ? "text-green-400" : "text-red-400"}`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{isOnline ? "Connected" : "Offline"}</span>
            {/* Pending drafts badge */}
            {draftCount > 0 && (
              <button onClick={() => navigate("/offline-drafts")}
                className="ml-auto flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white rounded-full px-2 py-0.5 text-xs font-bold transition-colors">
                <CloudOff className="w-3 h-3" />
                {draftCount} draft{draftCount > 1 ? "s" : ""}
              </button>
            )}
          </div>

          {/* Profile link */}
          <Link href="/profile">
            <a className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
              location === "/profile" ? "bg-slate-700" : "hover:bg-slate-700"}`}>
              <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate">{user?.name}</div>
                <div className="text-slate-400 text-xs truncate">{isSuperAdmin() ? "Tech Support" : user?.role?.replace("_", " ")}</div>
              </div>
              <UserCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
            </a>
          </Link>

          {isSuperAdmin() && (
            <div className="flex items-center gap-1 px-2 py-1">
              <Headphones className="w-3 h-3 text-yellow-400" />
              <span className="text-yellow-400 text-xs font-medium">Tech Support Panel</span>
            </div>
          )}

          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors text-sm">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 hover:text-gray-700">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Firm logo in topbar (when sidebar closed) */}
          {!sidebarOpen && bizLogo && (
            <img src={bizLogo} alt="Logo" className="h-7 w-auto object-contain" />
          )}

          <div className="flex-1" />

          {/* Offline drafts alert in topbar */}
          {draftCount > 0 && isOnline && (
            <button onClick={() => navigate("/offline-drafts")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 text-xs rounded-lg hover:bg-orange-100 transition-colors">
              <CloudOff className="w-3.5 h-3.5" />
              {draftCount} offline draft{draftCount > 1 ? "s" : ""} — Submit karo
            </button>
          )}

          {!isOnline && (
            <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-full flex items-center gap-1">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          )}

          {installPrompt && !installed && (
            <button
              onClick={() => installPrompt.prompt().then((r: any) => { if (r?.outcome === "accepted") { setInstalled(true); setInstallPrompt(null); } })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Install App
            </button>
          )}
          {installed && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
              ✓ Installed
            </span>
          )}
          {business && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded font-mono">{business.businessCode}</span>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
