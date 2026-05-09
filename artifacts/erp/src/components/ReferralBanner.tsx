import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Gift, X, Copy, Check, Trophy } from "lucide-react";
import { useLang, t } from "@/lib/lang";

const CONGRATS_DISMISSED_KEY = "erp_referral_congrats_dismissed";

export default function ReferralBanner() {
  const lang = useLang();
  const [status, setStatus] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dismissedAt = localStorage.getItem(CONGRATS_DISMISSED_KEY);
    if (dismissedAt && Date.now() - Number(dismissedAt) < 24 * 60 * 60 * 1000) {
      setDismissed(true);
    }
    api.get<any>("/businesses/referral-status").then(setStatus).catch(() => {});
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(CONGRATS_DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
  };

  const copyCode = () => {
    if (!status?.referralCode) return;
    navigator.clipboard.writeText(status.referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!status || !status.showCongrats || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] animate-slide-down">
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-2xl">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-yellow-300" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-base flex items-center gap-2 flex-wrap">
                🎉 Congratulations! {t("referralRewardEarned", lang)}
                <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
                  {status.rewardCount}/2 rewards
                </span>
              </div>
              <div className="text-sm text-emerald-100 mt-0.5">
                {lang === "hi" ? (
                  <>Aapke <strong>{status.referralCount} referrals</strong> {t("referralsCompleted", lang)}
                    {status.rewardCount < 2 && (
                      <span className="ml-1">Agli {5 - (status.referralCount % 5)} {t("moreReferrals", lang)}</span>
                    )}
                  </>
                ) : (
                  <>Your <strong>{status.referralCount} referrals</strong> {t("referralsCompleted", lang)}
                    {status.rewardCount < 2 && (
                      <span className="ml-1">{5 - (status.referralCount % 5)} {t("moreReferrals", lang)}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-white/15 rounded-lg px-3 py-1.5 border border-white/25">
              <Gift className="w-3.5 h-3.5 text-emerald-200" />
              <span className="text-sm font-mono font-bold tracking-widest">{status.referralCode}</span>
            </div>
            <button
              onClick={copyCode}
              className="flex items-center gap-1 bg-white text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : t("copyPassword", lang)}
            </button>
            <button onClick={handleDismiss} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
