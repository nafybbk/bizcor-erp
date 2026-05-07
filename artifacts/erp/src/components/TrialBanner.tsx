import { useEffect, useState } from "react";
import { X, AlertTriangle, Lock } from "lucide-react";
import { api } from "@/lib/api";

interface TrialStatus {
  phase: number;       // 1=silent, 2=alert, 3=grace, 4=locked
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
  const [status, setStatus] = useState<TrialStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Try desktop Electron API first, then cloud API
    const win = window as any;
    if (win.bizcorDesktop?.getTrialStatus) {
      win.bizcorDesktop.getTrialStatus().then((s: TrialStatus) => {
        setStatus(s);
        if (s.showTawk) loadTawk();
      });
    } else {
      // Cloud version: check business plan expiry
      api.get<any>("/businesses/current").then(biz => {
        if (!biz) return;
        const expiry = biz.planExpiry ? new Date(biz.planExpiry) : null;
        const now = new Date();
        if (!expiry) return;
        const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysLeft <= 0) {
          setStatus({ phase: 4, daysLeft: 0, trialDaysLeft: 0, locked: false, showAlert: true, showBanner: true, showTawk: true });
          loadTawk();
        } else if (daysLeft <= 7) {
          setStatus({ phase: 3, daysLeft, trialDaysLeft: daysLeft, locked: false, showAlert: true, showBanner: true, showTawk: true });
          loadTawk();
        } else if (daysLeft <= 30) {
          setStatus({ phase: 2, daysLeft, trialDaysLeft: daysLeft, locked: false, showAlert: true, showBanner: false, showTawk: true });
          loadTawk();
        }
      }).catch(() => {});
    }
  }, []);

  if (!status || !status.showAlert) return null;
  if (dismissed && status.phase !== 4) return null;

  const isGrace = status.phase === 3;
  const isLocked = status.phase === 4;

  if (isLocked) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-950/90 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Trial Khatam Ho Gaya</h2>
          <p className="text-gray-600 mb-6">Aapka 90-din ka trial period khatam ho chuka hai. Software continue karne ke liye license activate karein.</p>
          <a href="tel:+919999999999"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors">
            Tech Support Se Contact Karein
          </a>
        </div>
      </div>
    );
  }

  const bgColor = isGrace ? "bg-orange-600" : "bg-amber-500";
  const icon = isGrace
    ? <AlertTriangle className="w-4 h-4 flex-shrink-0" />
    : <AlertTriangle className="w-4 h-4 flex-shrink-0" />;
  const message = isGrace
    ? `Grace Period: ${status.daysLeft} din baad software lock ho jayega! Abhi license activate karein.`
    : `Trial period: ${status.daysLeft} din bacha hai. License activate karein.`;

  return (
    <div className={`${bgColor} text-white text-sm px-4 py-2 flex items-center gap-3 justify-between`}>
      <div className="flex items-center gap-2 font-medium">
        {icon}
        <span>{message}</span>
      </div>
      <button onClick={() => setDismissed(true)} className="text-white/70 hover:text-white p-0.5 rounded transition-colors flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
