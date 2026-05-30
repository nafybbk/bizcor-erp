import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, getGraceStatus } from "@/lib/auth";
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
  UserCircle, CloudOff, Ticket, ShoppingBag, MapPin, Loader2, CheckCircle2, FolderOpen, Trash2, Banknote, DatabaseZap, MessageSquare, HardDrive,
} from "lucide-react";
import { BizCorIcon, BusinessInitialsIcon } from "@/components/BizCorLogo";
import LocationModal from "@/components/LocationModal";
import FloatingActionButton from "@/components/FloatingActionButton";
import { WindowManagerProvider } from "@/components/WindowManager";
import ReferralBanner from "@/components/ReferralBanner";
import InternalChat from "@/components/InternalChat";
import TrialBanner from "@/components/TrialBanner";

interface NavItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  children?: NavItem[];
  badge?: number;
}

function NavLink({ href, icon, active, badge, children }: { href: string; icon?: React.ReactNode; active: boolean; badge?: number; children: React.ReactNode }) {
  return (
    <Link href={href}>
      <a className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
        active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-700 hover:text-white"}`}>
        {icon}
        <span className="truncate flex-1">{children}</span>
        {badge ? <span className="ml-auto bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{badge}</span> : null}
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
      <NavLink href={item.href!} icon={item.icon} active={location === item.href} badge={item.badge}>
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

function PlanExpiredLock({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="fixed inset-0 bg-gray-950/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center space-y-5">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <ShieldCheck className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Plan Expire Ho Gaya</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            60 din ka grace period khatam ho gaya. Nayi license activate karein.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left space-y-1">
          <div className="text-xs font-semibold text-amber-800">Kya band hai:</div>
          <div className="text-xs text-amber-700">• Invoices, bills, credit notes banana</div>
          <div className="text-xs text-amber-700">• Customers, suppliers, items add karna</div>
          <div className="text-xs text-amber-700">• Reports dekhna</div>
          <div className="text-xs text-amber-700">• Data download/export karna</div>
        </div>
        <div className="text-xs text-gray-400">
          License voucher milne par Settings → Activate License mein daalo.
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout Karo
        </button>
      </div>
    </div>
  );
}

function GraceBanner({ grace, isAdmin }: { grace: "grace_trial" | "grace_admin" | "grace_readonly"; isAdmin: boolean }) {
  const expiry = localStorage.getItem("erp_plan_expires_at");
  const daysLeft = expiry
    ? Math.max(0, 60 - Math.floor((Date.now() - new Date(expiry).getTime()) / (24 * 60 * 60 * 1000)))
    : 0;

  if (grace === "grace_trial") {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex-shrink-0">
        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-semibold">Grace Period:</span>
        <span>Plan expire ho gaya hai — abhi {daysLeft} din bacha hai. {isAdmin ? "Plan activate karo: Settings → Activate License" : "Admin se plan activate karwao."}</span>
      </div>
    );
  }

  if (grace === "grace_admin") {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-300 text-red-800 text-xs flex-shrink-0">
        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 text-red-600" />
        <span className="font-bold text-red-700">⚠ Urgent:</span>
        <span>Sirf {daysLeft} din bacha hai! {isAdmin ? "Abhi plan activate karo: Settings → Activate License" : "Sirf Admin kaam kar sakta hai. Admin se contact karo."}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs flex-shrink-0">
      <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="font-bold">VIEW ONLY MODE —</span>
      <span>Sirf {daysLeft} din bacha hai! Data sirf dekh sakte hain. {isAdmin ? "Plan activate karo: Settings → Activate License" : "Admin se contact karo."}</span>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, business, logout, isSuperAdmin, isPlanExpired } = useAuth();
  const [location, navigate] = useLocation();
  const isMobile = () => window.innerWidth < 768;
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile());
  const [isOnline, setIsOnline] = useState(true);
  const [appMode, setAppMode] = useState<"desktop" | "cloud" | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [chatEnabled, setChatEnabled] = useState(false);
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
  const [bottomCollapsed, setBottomCollapsed] = useState(() => !!localStorage.getItem("erp_sidebar_bottom_collapsed"));
  const [pendingCount, setPendingCount] = useState(0);
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
        const features: string[] = b.planFeatures || [];
        // Chat shown for trial users, any paid-plan user, or if plan explicitly has Chat feature
        // Hidden only for free users with no plan and not on trial
        const hasExplicitChatOff = features.some(f => f.startsWith("Chat:")) && !features.includes("Chat: included");
        setChatEnabled(!!b.isTrial || (!!b.planId && !hasExplicitChatOff) || features.includes("Chat: included"));
      }).catch(() => {});
    }
  }, []);

  // Track offline draft count
  const refreshDraftCount = useCallback(() => {
    setDraftCount(getDraftCount());
  }, []);

  // Poll pending WhatsApp count (super admin only)
  useEffect(() => {
    if (!isSuperAdmin()) return;
    const check = () => {
      api.get<any>("/super-admin/pending-count").then(r => setPendingCount(r.count || 0)).catch(() => {});
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
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
  const [forceOffline, setForceOffline] = useState(
    () => localStorage.getItem("erp_force_offline") === "1"
  );

  const toggleForceOffline = () => {
    setForceOffline(prev => {
      const next = !prev;
      if (next) {
        localStorage.setItem("erp_force_offline", "1");
      } else {
        localStorage.removeItem("erp_force_offline");
        // Reconnecting — trigger immediate check
        setTimeout(() => window.dispatchEvent(new Event("bizcor-check-online")), 100);
      }
      return next;
    });
  };

  useEffect(() => {
    const checkOnline = async () => {
      const wasOffline = !isOnline;
      try {
        const h = await api.get<{ status: string; mode?: string }>("/healthz");
        if (h.mode) setAppMode(h.mode as "desktop" | "cloud");
        // Auto-clear forceOffline when API responds — makes no sense on cloud, and stale on desktop
        if (forceOffline) {
          localStorage.removeItem("erp_force_offline");
          setForceOffline(false);
        }
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
    window.addEventListener("bizcor-check-online", checkOnline);

    const cached = localStorage.getItem("erp_app_name");
    if (cached) setSoftwareName(cached);

    // Read role directly from storage — avoids stale closure issue with isSuperAdmin()
    const _userStr = sessionStorage.getItem("erp_user") || localStorage.getItem("erp_user");
    const _role = _userStr ? (() => { try { return JSON.parse(_userStr)?.role; } catch { return null; } })() : null;
    if (_role === "super_admin") {
      api.get<any>("/super-admin/settings").then(s => {
        if (s.softwareName) { setSoftwareName(s.softwareName); localStorage.setItem("erp_app_name", s.softwareName); }
        if (s.logoUrl) setBizLogo(s.logoUrl);
        else if (_role === "super_admin") setBizLogo(null); // reset to default icon
      }).catch(() => {});
    }

    // Listen for immediate update when admin saves settings
    const onSettingsChanged = (e: Event) => {
      const s = (e as CustomEvent).detail;
      if (s?.softwareName) { setSoftwareName(s.softwareName); localStorage.setItem("erp_app_name", s.softwareName); }
      if (s?.logoUrl) setBizLogo(s.logoUrl);
      else setBizLogo(null);
    };
    window.addEventListener("app-settings-changed", onSettingsChanged);

    return () => { clearInterval(interval); window.removeEventListener("app-settings-changed", onSettingsChanged); window.removeEventListener("bizcor-check-online", checkOnline); };
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

  // Permission check — business_admin sees everything; staff sees only permitted modules
  const hasPerm = (key: string): boolean => {
    if (user?.role === "business_admin") return true;
    return Array.isArray(user?.permissions) && user.permissions.includes(key);
  };

  const businessNavFull: (NavItem & { permKey?: string })[] = [
    { label: L.dashboard, href: "/", icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      label: L.sales, icon: <TrendingUp className="w-4 h-4" />, permKey: "sales",
      children: [
        { label: L.invoices, href: "/sales/invoices" },
        { label: L.creditNotes, href: "/sales/credit-notes" },
      ],
    },
    {
      label: L.purchases, icon: <ShoppingCart className="w-4 h-4" />, permKey: "purchases",
      children: [
        { label: L.bills, href: "/purchases/bills" },
        { label: L.debitNotes, href: "/purchases/debit-notes" },
      ],
    },
    {
      label: L.payments, icon: <Wallet className="w-4 h-4" />, permKey: "payments",
      children: [
        { label: L.receipts, href: "/payments/receipts" },
        { label: L.payments, href: "/payments/payments" },
        { label: L.outstanding, href: "/payments/outstanding" },
      ],
    },
    { label: L.inventory, href: "/inventory", icon: <Package className="w-4 h-4" />, permKey: "inventory" },
    {
      label: L.cashBank, icon: <Banknote className="w-4 h-4" />, permKey: "payments",
      children: [
        { label: "Overview", href: "/cash-bank" },
        { label: L.expenses, href: "/cash-bank/expenses" },
        { label: L.contraEntry, href: "/cash-bank/contra" },
        { label: L.cashBankStatement, href: "/cash-bank/statement" },
        { label: L.cashBankAccounts, href: "/cash-bank/accounts" },
        { label: L.expenseHeads, href: "/cash-bank/expense-heads" },
      ],
    },
    {
      label: L.accounting, icon: <BookOpen className="w-4 h-4" />, permKey: "accounting",
      children: [
        { label: L.partyLedger, href: "/accounting/ledger" },
        { label: L.trialBalance, href: "/accounting/trial-balance" },
        { label: L.receivables, href: "/accounting/receivables" },
        { label: L.payables, href: "/accounting/payables" },
      ],
    },
    {
      label: L.gstReports, icon: <FileBarChart2 className="w-4 h-4" />, permKey: "gst",
      children: [
        { label: L.gstr1, href: "/gst/gstr1" },
        { label: L.gstr3b, href: "/gst/gstr3b" },
      ],
    },
    {
      label: L.masters, icon: <ClipboardList className="w-4 h-4" />, permKey: "masters",
      children: [
        { label: L.customers, href: "/masters/customers" },
        { label: L.suppliers, href: "/masters/suppliers" },
        { label: L.allParties, href: "/masters/parties" },
        { label: L.items, href: "/masters/items" },
        { label: L.units, href: "/masters/units" },
        { label: L.hsnCodes, href: "/masters/hsn" },
        { label: L.taxRates, href: "/masters/tax-rates" },
        { label: L.states, href: "/masters/states" },
      ],
    },
    ...(hasPerm("sales") ? [{ label: "Bin (Deleted)", href: "/vouchers/bin", icon: <Trash2 className="w-4 h-4 text-red-400" /> }] : []),
  ];

  const businessNav: NavItem[] = businessNavFull.filter(item =>
    !item.permKey || hasPerm(item.permKey)
  );

  const superAdminNav: NavItem[] = [
    { label: L.dashboard, href: "/", icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: L.loginActivity, href: "/admin/activity", icon: <BarChart3 className="w-4 h-4" /> },
    { label: L.allUsers, href: "/admin/users", icon: <Users className="w-4 h-4" /> },
    { label: L.buyers, href: "/admin/buyers", icon: <ShoppingBag className="w-4 h-4" /> },
    { label: L.businesses, href: "/admin/businesses", icon: <Building2 className="w-4 h-4" />, badge: pendingCount > 0 ? pendingCount : undefined },
    { label: L.plans, href: "/admin/plans", icon: <CreditCard className="w-4 h-4" /> },
    { label: L.licenseVouchers, href: "/admin/vouchers", icon: <Ticket className="w-4 h-4" /> },
    { label: L.techSupportAccounts, href: "/admin/super-admins", icon: <ShieldCheck className="w-4 h-4" /> },
    { label: L.appSettings, href: "/admin/settings", icon: <Settings className="w-4 h-4" /> },
    { label: "Import Data", href: "/admin/import", icon: <DatabaseZap className="w-4 h-4" /> },
    { label: "Support Messages", href: "/admin/support-messages", icon: <MessageSquare className="w-4 h-4" /> },
  ];

  const navItems = isSuperAdmin() ? superAdminNav : businessNav;

  return (
    <WindowManagerProvider>
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
        <div className="border-t border-slate-700">
          {/* Collapse toggle bar */}
          <button
            onClick={() => {
              const next = !bottomCollapsed;
              setBottomCollapsed(next);
              if (next) localStorage.setItem("erp_sidebar_bottom_collapsed", "1");
              else localStorage.removeItem("erp_sidebar_bottom_collapsed");
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors text-[10px] font-semibold tracking-wider uppercase"
          >
            <span>App Settings</span>
            {bottomCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Collapsible section */}
          {!bottomCollapsed && (
            <div className="px-3 pb-2 space-y-1">
              {/* Nav links: My Plan, Users, Settings, Import Data */}
              <Link href="/settings/subscription">
                <a className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${location === "/settings/subscription" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"}`}>
                  <CreditCard className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{L.myPlan}</span>
                </a>
              </Link>
              {user?.role === "business_admin" && (
                <Link href="/settings/users">
                  <a className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${location === "/settings/users" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"}`}>
                    <Users className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{L.users}</span>
                  </a>
                </Link>
              )}
              {hasPerm("settings") && (
                <Link href="/settings/business">
                  <a className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${location === "/settings/business" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"}`}>
                    <Settings className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{L.settings}</span>
                  </a>
                </Link>
              )}
              {hasPerm("settings") && (
                <Link href="/settings/import">
                  <a className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${location === "/settings/import" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"}`}>
                    <DatabaseZap className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Data & Backup</span>
                  </a>
                </Link>
              )}
              {hasPerm("settings") && !!(window as any).bizcorDesktop?.backup && (
                <Link href="/settings/backup">
                  <a className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${location === "/settings/backup" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"}`}>
                    <HardDrive className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>DB Backup</span>
                  </a>
                </Link>
              )}
              <div className="border-t border-slate-700/60 my-1" />
              {/* Desktop / Cloud mode badge */}
              {appMode && (
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold ${appMode === "desktop" ? "bg-indigo-900/60 text-indigo-300 border border-indigo-700" : "bg-slate-700/60 text-slate-400"}`}>
                  {appMode === "desktop" ? "🖥 Desktop App" : "☁ Cloud"}
                </div>
              )}
              {/* Online/Offline toggle */}
              <div className="space-y-1">
                {/* Status row */}
                <div className="flex items-center gap-1">
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${isOnline ? "text-green-400" : "text-red-400"}`}>
                    {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    <span>{isOnline ? "Connected" : forceOffline ? "Offline (Manual)" : "Offline"}</span>
                  </div>
                  {draftCount > 0 && (
                    <button onClick={() => navigate("/offline-drafts")}
                      className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white rounded-full px-2 py-0.5 text-xs font-bold transition-colors">
                      <CloudOff className="w-3 h-3" />
                      {draftCount}
                    </button>
                  )}
                </div>
                {/* Offline toggle — only in desktop mode */}
                {appMode === "desktop" && (
                  <button
                    onClick={toggleForceOffline}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      forceOffline
                        ? "bg-red-900/40 border-red-600 text-red-300 hover:bg-red-900/60"
                        : "bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {forceOffline ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                      {forceOffline ? "Offline Mode ON" : "Go Offline"}
                    </span>
                    {/* Toggle switch visual */}
                    <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${forceOffline ? "bg-red-500" : "bg-slate-500"}`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${forceOffline ? "translate-x-3.5" : "translate-x-0.5"}`} />
                    </span>
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
            </div>
          )}

          {/* Profile + Sign Out — always visible */}
          <div className="px-3 pb-3 space-y-1">
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

            {/* App version */}
            <div className="px-2 pt-1 flex items-center justify-between">
              <span className="text-slate-400 text-[11px] font-semibold tracking-wide">v2.3.69</span>
              {appMode && (
                <span className="text-slate-400 text-[11px] font-medium">{appMode === "desktop" ? "🖥 Desktop" : "☁ Cloud"}</span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Location Modal */}
      {showLocationModal && (
        <LocationModal onClose={() => { setShowLocationModal(false); setDeviceLoc(getDeviceLocation()); }} />
      )}

      {/* Grace period / expired lock */}
      {!isSuperAdmin() && (() => {
        const grace = getGraceStatus();
        if (grace === "expired") return <PlanExpiredLock onLogout={logout} />;
        return null;
      })()}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Grace period banner */}
        {!isSuperAdmin() && (() => {
          const grace = getGraceStatus();
          if (grace === "grace_trial" || grace === "grace_admin" || grace === "grace_readonly") {
            return <GraceBanner grace={grace} isAdmin={user?.role === "business_admin"} />;
          }
          return null;
        })()}
        {/* Topbar */}
        <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 hover:text-gray-700">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Firm logo in topbar (when sidebar closed) */}
          {!sidebarOpen && bizLogo && (
            <img src={bizLogo} alt="Logo" className="h-7 w-auto object-contain" />
          )}

          {/* Server mode marquee + Staff Chat button */}
          {appMode && (() => {
            const isDesktop = appMode === "desktop";
            const msgs = isDesktop
              ? ["🖥 LAN Server", "⚡ Fast", "🔒 Local", "📦 Offline", "🖥 LAN Server", "⚡ Fast", "🔒 Local", "📦 Offline"]
              : ["☁ Cloud", "🌐 Sync", "🔐 Secure", "📊 Live", "☁ Cloud", "🌐 Sync", "🔐 Secure", "📊 Live"];
            const text = msgs.join("  •  ");
            return (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`relative flex items-center overflow-hidden rounded-md h-5 w-28 sm:w-40 ${isDesktop ? "bg-indigo-600" : "bg-emerald-600"}`}>
                  <style>{`@keyframes biz-marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
                  <span
                    className="absolute whitespace-nowrap text-white text-[10px] font-semibold tracking-wide px-2"
                    style={{ animation: "biz-marquee 14s linear infinite" }}
                  >
                    {text}
                  </span>
                </div>
                {!isSuperAdmin() && chatEnabled && (
                  <button
                    onClick={() => setChatOpen(o => !o)}
                    className={`relative flex items-center justify-center w-6 h-6 rounded-md text-white transition-all flex-shrink-0 ${chatOpen ? "bg-slate-600" : "bg-emerald-600 hover:bg-emerald-700"}`}
                    title="Staff Chat"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {chatUnread > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center">
                        {chatUnread > 9 ? "9+" : chatUnread}
                      </span>
                    )}
                  </button>
                )}
              </div>
            );
          })()}

          <div className="flex-1" />

          {/* Offline drafts alert in topbar */}
          {draftCount > 0 && isOnline && (
            <button onClick={() => navigate("/offline-drafts")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 text-xs rounded-lg hover:bg-orange-100 transition-colors">
              <CloudOff className="w-3.5 h-3.5" />
              {draftCount} offline draft{draftCount > 1 ? "s" : ""} — Submit
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
          {/* Sign Out — topbar right side */}
          <button
            onClick={logout}
            title="Sign Out"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-medium border border-gray-200 hover:border-red-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{T[lang].signOut}</span>
          </button>
        </header>


        {/* Trial banner */}
        {!isSuperAdmin() && <TrialBanner />}

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
            {autoSyncResult.synced} draft{autoSyncResult.synced !== 1 ? "s" : ""} submitted successfully!
            {autoSyncResult.failed > 0 && <span className="text-yellow-200 ml-1">({autoSyncResult.failed} failed — please check manually)</span>}
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
    {!isSuperAdmin() && <FloatingActionButton />}
    {!isSuperAdmin() && <ReferralBanner />}
    {!isSuperAdmin() && chatEnabled && <InternalChat open={chatOpen} onToggle={() => setChatOpen(o => !o)} onUnreadChange={setChatUnread} />}
    </WindowManagerProvider>
  );
}
