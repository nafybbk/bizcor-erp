import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  LayoutDashboard, FileText, ShoppingCart, CreditCard, Package, BookOpen,
  FileBarChart2, Settings, Users, ChevronDown, ChevronRight, LogOut,
  Building2, Menu, X, ShieldCheck, Receipt, Wallet,
  TrendingUp, BarChart3, ClipboardList, Wifi, WifiOff, Headphones,
} from "lucide-react";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
}

function NavLink({ href, children, icon, active }: { href: string; children: React.ReactNode; icon: React.ReactNode; active: boolean }) {
  return (
    <Link href={href}>
      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-700 hover:text-white"}`}>
        <span className="w-4 h-4 flex-shrink-0">{icon}</span>
        <span>{children}</span>
      </div>
    </Link>
  );
}

function NavGroup({ item, location }: { item: NavItem; location: string }) {
  const isActive = item.children?.some(c => c.href === location) || false;
  const [open, setOpen] = useState(isActive);

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${isActive ? "text-white bg-slate-700" : "text-slate-300 hover:bg-slate-700 hover:text-white"}`}
        >
          <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>
          <span className="flex-1 text-left">{item.label}</span>
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        {open && (
          <div className="ml-7 mt-1 space-y-0.5">
            {item.children.map(child => (
              <Link key={child.href} href={child.href}>
                <div className={`px-3 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${location === child.href ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-700 hover:text-white"}`}>
                  {child.label}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink href={item.href!} icon={item.icon} active={location === item.href}>
      {item.label}
    </NavLink>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, business, logout, isSuperAdmin } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [softwareName, setSoftwareName] = useState("BizERP");

  useEffect(() => {
    // Check online status
    const checkOnline = () => {
      api.get("/healthz").then(() => setIsOnline(true)).catch(() => setIsOnline(false));
    };
    checkOnline();
    const interval = setInterval(checkOnline, 30000);

    // Load software name from settings (for super admin) or localStorage
    const cached = localStorage.getItem("erp_app_name");
    if (cached) setSoftwareName(cached);
    if (isSuperAdmin()) {
      api.get<any>("/super-admin/settings").then(s => {
        if (s.softwareName) { setSoftwareName(s.softwareName); localStorage.setItem("erp_app_name", s.softwareName); }
      }).catch(() => {});
    }

    return () => clearInterval(interval);
  }, []);

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
    { label: "App Settings", href: "/admin/settings", icon: <Settings className="w-4 h-4" /> },
  ];

  const navItems = isSuperAdmin() ? superAdminNav : businessNav;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-56" : "w-0 overflow-hidden"} bg-slate-900 flex-shrink-0 flex flex-col transition-all duration-200`}>
        {/* Logo */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-white font-bold text-sm leading-tight truncate">{softwareName}</div>
              {business && <div className="text-slate-400 text-xs truncate">{business.name}</div>}
              {isSuperAdmin() && <div className="text-yellow-400 text-xs flex items-center gap-1"><ShieldCheck className="w-3 h-3" />Tech Support</div>}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item, i) => (
            <NavGroup key={i} item={item} location={location} />
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-slate-700">
          {/* Online/Offline indicator */}
          <div className={`flex items-center gap-2 px-2 py-1 mb-2 rounded-lg text-xs ${isOnline ? "text-green-400" : "text-red-400"}`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{isOnline ? "Connected" : "Offline"}</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-medium truncate">{user?.name}</div>
              <div className="text-slate-400 text-xs truncate">{isSuperAdmin() ? "Tech Support" : user?.role?.replace("_", " ")}</div>
            </div>
          </div>
          {isSuperAdmin() && (
            <div className="flex items-center gap-1 px-2 py-1 mb-1">
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
          <div className="flex-1" />
          {!isOnline && (
            <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-full flex items-center gap-1">
              <WifiOff className="w-3 h-3" /> Offline
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
