import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { getDrafts, removeDraft, resolvePayload, OfflineDraft } from "@/lib/offlineQueue";
import { api } from "@/lib/api";
import { ArrowLeft, CloudOff, CheckCircle2, XCircle, Loader2, Trash2, Send, AlertTriangle } from "lucide-react";
import { fmt } from "@/lib/api";
import { useLang, t } from "@/lib/lang";

type Status = "pending" | "syncing" | "done" | "failed";

interface DraftState extends OfflineDraft {
  status: Status;
  error?: string;
}

export default function OfflineDrafts() {
  const lang = useLang();
  const [, navigate] = useLocation();
  const [drafts, setDrafts] = useState<DraftState[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setDrafts(getDrafts().map(d => ({ ...d, status: "pending" as Status })));
  }, []);

  const submitDraft = async (draft: DraftState, idMap: Record<number, number>): Promise<any> => {
    let payload = resolvePayload(draft.payload, idMap);

    if (payload?.partyId && typeof payload.partyId === "number" && payload.partyId < 0) {
      const partyName: string | undefined = payload.partyName;
      if (partyName) {
        const result = await api.get<any>(`/parties?search=${encodeURIComponent(partyName)}&limit=10`);
        const parties: any[] = result.data || result || [];
        const found = parties.find((p: any) =>
          p.name?.toLowerCase().trim() === partyName.toLowerCase().trim()
        );
        if (found) {
          payload = { ...payload, partyId: found.id };
        } else {
          throw new Error(t("offlinePartyNotFound", lang).replace("party", `"${partyName}"`));
        }
      } else {
        throw new Error(t("partyIdNotResolved", lang));
      }
    }

    if (draft.method === "POST") return api.post(draft.endpoint, payload);
    return api.patch(draft.endpoint, payload);
  };

  const syncOne = async (draft: DraftState): Promise<void> => {
    setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: "syncing" } : d));
    try {
      await submitDraft(draft, {});
      removeDraft(draft.id);
      setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: "done" } : d));
    } catch (err: any) {
      setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: "failed", error: err.message } : d));
    }
  };

  const syncAll = async () => {
    setSyncing(true);
    const idMap: Record<number, number> = {};
    const pending = drafts.filter(d => d.status === "pending" || d.status === "failed");

    for (const d of pending) {
      setDrafts(prev => prev.map(x => x.id === d.id ? { ...x, status: "syncing" } : x));
      try {
        const result = await submitDraft(d, idMap);
        if (d.endpoint === "/parties" && d.tempId && result?.id) {
          idMap[d.tempId] = result.id;
        }
        removeDraft(d.id);
        setDrafts(prev => prev.map(x => x.id === d.id ? { ...x, status: "done" } : x));
      } catch (err: any) {
        setDrafts(prev => prev.map(x => x.id === d.id ? { ...x, status: "failed", error: err.message } : x));
      }
    }
    setSyncing(false);
  };

  const deleteDraft = (id: string) => {
    removeDraft(id);
    setDrafts(prev => prev.filter(d => d.id !== id));
  };

  const pendingCount = drafts.filter(d => d.status === "pending" || d.status === "failed").length;
  const doneCount = drafts.filter(d => d.status === "done").length;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CloudOff className="w-6 h-6 text-orange-500" />
            Offline Drafts
          </h1>
          <p className="text-sm text-gray-500">{t("offlineDraftsDesc", lang)}</p>
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <div className="font-semibold text-gray-700">{t("noPendingDrafts", lang)}</div>
          <div className="text-sm text-gray-400 mt-1">{t("allDataSubmitted", lang)}</div>
          <button onClick={() => navigate("/")} className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
            {t("goToDashboard", lang)}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-5 py-3">
            <div className="text-sm text-orange-800">
              <span className="font-bold">{pendingCount}</span> pending · <span className="font-bold text-green-700">{doneCount}</span> submitted
            </div>
            <button onClick={syncAll} disabled={syncing || pendingCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {t("submitAll", lang)}
            </button>
          </div>

          {drafts.some(d => d.payload?.partyId < 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
              ⚠️ {t("offlinePartyTip", lang)}
            </div>
          )}

          <div className="space-y-3">
            {drafts.map(draft => (
              <div key={draft.id} className={`bg-white rounded-xl border p-4 ${
                draft.status === "done" ? "border-green-200 bg-green-50" :
                draft.status === "failed" ? "border-red-200 bg-red-50" :
                draft.status === "syncing" ? "border-blue-200" : "border-gray-200"
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {draft.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
                      {draft.status === "failed" && <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                      {draft.status === "syncing" && <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />}
                      {draft.status === "pending" && <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                      <span className="font-semibold text-sm text-gray-800">{draft.label}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 ml-6 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>Saved: {fmt.date(draft.savedAt)}</span>
                      {draft.locationName && (
                        <span className="text-emerald-600 flex items-center gap-0.5">
                          📍 {draft.locationName}
                        </span>
                      )}
                    </div>
                    {draft.status === "failed" && draft.error && (
                      <div className="text-xs text-red-600 mt-1 ml-6">Error: {draft.error}</div>
                    )}
                    {draft.status === "done" && (
                      <div className="text-xs text-green-600 font-medium mt-1 ml-6">✓ {t("submittedToServer", lang)}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(draft.status === "pending" || draft.status === "failed") && (
                      <>
                        <button onClick={() => syncOne(draft)}
                          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          {t("submit", lang)}
                        </button>
                        <button onClick={() => deleteDraft(draft.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
