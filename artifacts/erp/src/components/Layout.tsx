import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getDraftCount, syncAllDrafts } from "@/lib/offlineQueue";
import { getDeviceLocation } from "@/lib/locationStore";
import { getLang, toggleLang, T, type Lang } from "@/lib/lang";
import { getDataFolderName, pickDataFolder, isFileSystemSupported } from "@/lib/localDataFolder";
import {
  LayoutDashboard, FileText, ShoppingCart, CreditCard, Package, BookOpen,
  FileBarChart2, Settings, Users, ChevronDown, ChevronRight, LogOut,
  Building2, Menu, X, ShieldCheck, Receipt, Wallet,
  TrendingUp, BarChart3, ClipboardList, Wifi, WifiOff, Headphones, Download,
  UserCircle, CloudOff, Ticket, ShoppingBag, MapPin, Loader2, CheckCircle2, FolderOpen,
} from "lucide-react";
import { BizCorIcon, BusinessInitialsIcon } from "@/components/BizCorLogo";
import LocationModal from "@/components/LocationModal";

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
  const isMobile = () => window.innerWidth < 768;
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile());
  const [isOnline, setIsOnline] = useState(true);
  const [softwareName, setSoftwareName] = useState("BizERP");
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [bizLogo, setBizLogo] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState(getDraftCount());
  const [showDraftNotice, setShowDraftNotice] = useState(false);
  const [deviceLoc, setDeviceLoc] = useState(getDeviceLocation());
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [lang, setLangState] = useState<Lang>(getLang());
  const [dataFolderName, setDataFolderName] = useState<string | null>(getDataFolderName());
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

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

    // Device location listener
    const refreshLoc = () => setDeviceLoc(getDeviceLocation());
    window.addEventListener("device-location-change", refreshLoc);

    // Language change listener
    const refreshLang = () => setLangState(getLang());
    window.addEventListener("lang-change", refreshLang);

    // Data folder change listener
    const refreshFolder = () => setDataFolderName(getDataFolderName());
    window.addEventListener("data-folder-change", refreshFolder);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("offline-queue-change", refreshDraftCount);
      window.removeEventListener("device-location-change", refreshLoc);
      window.removeEventListener("lang-change", refreshLang);
      window.removeEventListener("data-folder-change", refreshFolder);
    };
  }, []);

  const [autoSyncing, setAutoSyncing] = useState(false);
  const [autoSyncResult, setAutoSyncResult] = useState<{ synced: number; failed: number } | null>(null);

  useEffect(() => {
    const checkOnline = async () => {
      const wasOffline = !isOnline;
      try {
        await api.get("/healthz");
        setIsOnline(true);
        if (wasOffline && getDraftCount() > 0) {
          setAutoSyncing(true);
          try {
            const result = await syncAllDrafts();
            setAutoSyncResult(result);
            setTimeout(() => setAutoSyncResult(null), 5000);
          } finally { setAutoSyncing(false); }
        }
      } catch { setIsOnline(false); }
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

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (isMobile()) setSidebarOpen(false);
    if (location === "/" || location === "/settings/business") loadLogo();
  }, [location]);

  // Swipe gesture — right swipe opens, left swipe closes
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (dy > 40) return; // vertical scroll — ignore
    if (dx > 60 && touchStartX.current < 40) setSidebarOpen(true);   // right swipe from edge
    if (dx < -60) setSidebarOpen(false);                               // left swipe
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const L = T[lang];

  const businessNav: NavItem[] = [
    { label: L.dashboard, href: "/", icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      label: L.sales, icon: <TrendingUp className="w-4 h-4" />,
      children: [
        { label: L.invoices, href: "/sales/invoices" },
        { label: L.creditNotes, href: "/sales/credit-notes" },
      ],
    },
    {
      label: L.purchases, icon: <ShoppingCart className="w-4 h-4" />,
      children: [
        { label: L.bills, href: "/purchases/bills" },
        { label: L.debitNotes, href: "/purchases/debit-notes" },
      ],
    },
    {
      label: L.payments, icon: <Wallet className="w-4 h-4" />,
      children: [
        { label: L.receipts, href: "/payments/receipts" },
        { label: L.payments, href: "/payments/payments" },
        { label: L.outstanding, href: "/payments/outstanding" },
      ],
    },
    { label: L.inventory, href: "/inventory", icon: <Package className="w-4 h-4" /> },
    {
      label: L.accounting, icon: <BookOpen className="w-4 h-4" />,
      children: [
        { label: L.partyLedger, href: "/accounting/ledger" },
        { label: L.trialBalance, href: "/accounting/trial-balance" },
        { label: L.receivables, href: "/accounting/receivables" },
        { label: L.payables, href: "/accounting/payables" },
      ],
    },
    {
      label: L.gstReports, icon: <FileBarChart2 className="w-4 h-4" />,
      children: [
        { label: L.gstr1, href: "/gst/gstr1" },
        { label: L.gstr3b, href: "/gst/gstr3b" },
      ],
    },
    {
      label: L.masters, icon: <ClipboardList className="w-4 h-4" />,
      children: [
        { label: L.customers, href: "/masters/customers" },
        { label: L.suppliers, href: "/masters/suppliers" },
        { label: L.allParties, href: "/masters/parties" },
        { label: L.items, href: "/masters/items" },
        { label: L.units, href: "/masters/units" },
        { label: L.hsnCodes, href: "/masters/hsn" },
        { label: L.taxRates, href: "/masters/tax-rates" },
      ],
    },
    { label: L.myPlan, href: "/settings/subscription", icon: <CreditCard className="w-4 h-4" /> },
    { label: L.users, href: "/settings/users", icon: <Users className="w-4 h-4" /> },
    { label: L.settings, href: "/settings/business", icon: <Settings className="w-4 h-4" /> },
  ];

  const superAdminNav: NavItem[] = [
    { label: L.dashboard, href: "/", icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: L.loginActivity, href: "/admin/activity", icon: <BarChart3 className="w-4 h-4" /> },
    { label: L.allUsers, href: "/admin/users", icon: <Users className="w-4 h-4" /> },
    { label: L.buyers, href: "/admin/buyers", icon: <ShoppingBag className="w-4 h-4" /> },
    { label: L.businesses, href: "/admin/businesses", icon: <Building2 className="w-4 h-4" /> },
    { label: L.plans, href: "/admin/plans", icon: <CreditCard className="w-4 h-4" /> },
    { label: L.licenseVouchers, href: "/admin/vouchers", icon: <Ticket className="w-4 h-4" /> },
    { label: L.techSupportAccounts, href: "/admin/super-admins", icon: <ShieldCheck className="w-4 h-4" /> },
    { label: L.appSettings, href: "/admin/settings", icon: <Settings className="w-4 h-4" /> },
  ];

  const navItems = isSuperAdmin() ? superAdminNav : businessNav;

  return (
    <div className="flex h-screen bg-background overflow-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* Mobile overlay — tap to close */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-20" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar handle tab — mobile only */}
      <button
        className="md:hidden fixed top-1/2 -translate-y-1/2 z-40 transition-all duration-200 focus:outline-none"
        style={{ left: sidebarOpen ? "224px" : "0px" }}
        onClick={() => setSidebarOpen(o => !o)}
        aria-label="Toggle sidebar"
      >
        <div className="bg-slate-700/90 backdrop-blur-sm rounded-r-xl flex flex-col items-center justify-center gap-1 w-4 h-14 shadow-lg">
          <div className="w-0.5 h-2 bg-slate-300 rounded-full" />
          <div className="w-0.5 h-3 bg-slate-400 rounded-full" />
          <div className="w-0.5 h-2 bg-slate-300 rounded-full" />
        </div>
      </button>

      {/* Sidebar — fixed on mobile, static on desktop */}
      <aside className={`
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        ${sidebarOpen ? "md:w-56" : "md:w-0 md:overflow-hidden"}
        fixed md:static inset-y-0 left-0 z-30
        w-56 bg-slate-900 flex-shrink-0 flex flex-col transition-all duration-200
      `}>

        {/* Firm Header — clickable → Firm Profile */}
        <Link href="/profile">
          <a className="block p-4 border-b border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer group">
            <div className="flex items-center gap-2.5">
              {/* Logo or icon */}
              {bizLogo
                ? <div className="w-8 h-8 flex-shrink-0 rounded-lg overflow-hidden bg-blue-600 flex items-center justify-center">
                    <img src={bizLogo} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                : isSuperAdmin()
                  ? <BizCorIcon size={32} />
                  : <BusinessInitialsIcon name={business?.name || "B"} size={32} />
              }
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
            {draftCount > 0 && (
              <button onClick={() => navigate("/offline-drafts")}
                className="ml-auto flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white rounded-full px-2 py-0.5 text-xs font-bold transition-colors">
                <CloudOff className="w-3 h-3" />
                {draftCount} draft{draftCount > 1 ? "s" : ""}
              </button>
            )}
          </div>

          {/* Device Location */}
          <button
            onClick={() => setShowLocationModal(true)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
              deviceLoc ? "text-emerald-400 hover:bg-slate-700" : "text-slate-500 hover:bg-slate-700 hover:text-slate-300"
            }`}
          >
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate flex-1 text-left">
              {deviceLoc ? deviceLoc.name : L.setLocation}
            </span>
            <span className="text-slate-600 text-[10px]">✎</span>
          </button>

          {/* Data Folder */}
          {isFileSystemSupported() && (
            <button
              onClick={async () => {
                const result = await pickDataFolder();
                if (result) setDataFolderName(result.name);
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                dataFolderName ? "text-blue-400 hover:bg-slate-700" : "text-slate-500 hover:bg-slate-700 hover:text-slate-300"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate flex-1 text-left">
                {dataFolderName ? dataFolderName : L.dataFolder}
              </span>
              <span className="text-slate-600 text-[10px]">✎</span>
            </button>
          )}

          {/* Language Toggle */}
          <button
            onClick={() => { toggleLang(); setLangState(getLang()); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <span className="text-sm leading-none">🌐</span>
            <span className="flex-1 text-left">{L.language}</span>
            <span className="bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded text-slate-200 font-mono text-[10px] font-bold tracking-wider">
              {lang === "en" ? "EN" : "हि"}
            </span>
          </button>

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
            {L.signOut}
          </button>
        </div>
      </aside>

      {/* Location Modal */}
      {showLocationModal && (
        <LocationModal onClose={() => { setShowLocationModal(false); setDeviceLoc(getDeviceLocation()); }} />
      )}

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


        {/* Auto-sync banner */}
        {autoSyncing && (
          <div className="bg-blue-600 text-white text-sm px-4 py-2 flex items-center gap-2 shrink-0">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            Internet aa gaya — Pending drafts auto-sync ho rahe hain...
          </div>
        )}
        {autoSyncResult && !autoSyncing && (
          <div className="bg-green-600 text-white text-sm px-4 py-2 flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {autoSyncResult.synced} drafts server par submit ho gaye!
            {autoSyncResult.failed > 0 && <span className="text-yellow-200 ml-1">({autoSyncResult.failed} failed — manually check karo)</span>}
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
