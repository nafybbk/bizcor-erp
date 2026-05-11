import { useEffect, useState } from "react";
import { X, AlertTriangle, Lock, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/langHook";
import { t } from "@/lib/lang";

interface TrialStatus {
  phase: number;
  daysLeft: number;
  trialDaysLeft: number;
  locked: boolean;
  showAlert: boolean;
  showBanner: boolean;
  showTawk: boolean;
}

let tawkLoaded = false;

function loadTawk() {
  if (tawkLoaded || typeof window === "undefined") return;
  tawkLoaded = true;
  const tawkPropertyId = (window as any).__TAWK_PROPERTY_ID__ || "";
  if (!tawkPropertyId) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://embed.tawk.to/${tawkPropertyId}/default`;
  s.charset = "UTF-8";
  s.setAttribute("crossorigin", "*");
  document.head.appendChild(s);
}

export default function TrialBanner() {
  const lang = useLang();
  const [status, setStatus] = useState<TrialStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const win = window as any;
    if (win.bizcorDesktop?.getTrialStatus) {
      win.bizcorDesktop.getTrialStatus().then((s: TrialStatus) => {
        setStatus(s);
        if (s.showTawk) loadTawk();
      });
    } else {
      api.get<any>("/businesses/current").then(biz => {
        if (!biz) return;
        const expiry = biz.planExpiry ? new Date(biz.planExpiry) : null;
        if (!expiry) return;
        const now = new Date();
        const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysLeft > 0) {
          setStatus({ phase: 1, daysLeft, trialDaysLeft: daysLeft, locked: false, showAlert: false, showBanner: false, showTawk: false });
        } else if (daysLeft > -30) {
          const graceDaysLeft = 30 + daysLeft;
          setStatus({ phase: 2, daysLeft: graceDaysLeft, trialDaysLeft: 0, locked: false, showAlert: true, showBanner: true, showTawk: true });
          loadTawk();
        } else if (daysLeft > -60) {
          const graceDaysLeft = 60 + daysLeft;
          setStatus({ phase: 3, daysLeft: graceDaysLeft, trialDaysLeft: 0, locked: false, showAlert: true, showBanner: true, showTawk: true });
          loadTawk();
        } else {
          setStatus({ phase: 4, daysLeft: 0, trialDaysLeft: 0, locked: true, showAlert: true, showBanner: true, showTawk: true });
          loadTawk();
        }
      }).catch(() => {});
    }
  }, []);

  if (!status || !status.showAlert) return null;
  if (dismissed && status.phase !== 4) return null;

  const isGrace = status.phase === 3;
  const isLocked = status.phase === 4;
  const isPlanView = status.phase === 2;

  if (isLocked) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-950/90 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("trialEnded", lang)}</h2>
          <p className="text-gray-600 mb-6">{t("trialEndedDesc", lang)}</p>
          <a href="tel:+919999999999"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors">
            {t("contactTechSupport", lang)}
          </a>
        </div>
      </div>
    );
  }

  if (isGrace) {
    return (
      <div className="bg-orange-600 text-white text-sm px-4 py-2 flex items-center gap-3 justify-between">
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>{t("gracePeriod", lang)}</strong>{" "}
            {status.daysLeft} {t("graceWarning", lang)} {t("graceWarning2", lang)}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a href="/my-plan" className="bg-white text-orange-700 font-semibold text-xs px-3 py-1 rounded-lg hover:bg-orange-50 transition-colors">
            {t("viewPlans", lang)}
          </a>
          <button onClick={() => setDismissed(true)} className="text-white/70 hover:text-white p-0.5 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (isPlanView) {
    return (
      <div className="bg-indigo-600 text-white text-sm px-4 py-2 flex items-center gap-3 justify-between">
        <div className="flex items-center gap-2 font-medium">
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          <span>{t("trialExpiredBanner", lang)}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a href="/my-plan" className="bg-white text-indigo-700 font-semibold text-xs px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors">
            {t("viewPlans", lang)}
          </a>
          <button onClick={() => setDismissed(true)} className="text-white/70 hover:text-white p-0.5 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
