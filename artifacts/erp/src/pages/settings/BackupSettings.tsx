import { useEffect, useState } from "react";
import { HardDrive, Shield, FolderOpen, RefreshCw, Check, AlertTriangle, Loader2, ChevronDown, ChevronUp } from "lucide-react";

declare global {
  interface Window {
    bizcorDesktop?: {
      backup: {
        isPinSet: () => Promise<boolean>;
        setPin: (pin: string) => Promise<boolean>;
        verifyPin: (pin: string) => Promise<boolean>;
        isEnabled: () => Promise<boolean>;
        setEnabled: (val: boolean) => Promise<boolean>;
        list: () => Promise<{ name: string; path: string; sizeKb: number; createdAt: string }[]>;
        create: () => Promise<{ success: boolean; fileName?: string; error?: string }>;
        openFolder: () => Promise<boolean>;
        chooseAndRestore: () => Promise<{ canceled: boolean; filePath?: string }>;
        restore: (filePath: string, pin: string) => Promise<{ success: boolean; error?: string }>;
      };
    };
  }
}

const isDesktop = typeof window !== "undefined" && !!window.bizcorDesktop?.backup;

export default function BackupSettings() {
  const [pinSet, setPinSet] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [backups, setBackups] = useState<{ name: string; path: string; sizeKb: number; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // PIN setup state
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  // Backup now state
  const [backingUp, setBackingUp] = useState(false);

  // Restore state
  const [restoring, setRestoring] = useState(false);
  const [restorePin, setRestorePin] = useState("");
  const [restoreFile, setRestoreFile] = useState<string | null>(null);
  const [showRestorePin, setShowRestorePin] = useState(false);

  // Backup list collapse
  const [showList, setShowList] = useState(false);

  const desktop = window.bizcorDesktop?.backup;

  async function loadState() {
    if (!desktop) return;
    setLoading(true);
    try {
      const [ps, en, bl] = await Promise.all([desktop.isPinSet(), desktop.isEnabled(), desktop.list()]);
      setPinSet(ps);
      setEnabled(en);
      setBackups(bl);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadState(); }, []);

  function flash(type: "ok" | "err", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  }

  async function handleToggleEnable(val: boolean) {
    if (!desktop) return;
    if (val && !pinSet) { setShowPinSetup(true); return; }
    await desktop.setEnabled(val);
    setEnabled(val);
    flash("ok", val ? "Auto backup shuru ho gaya!" : "Auto backup band ho gaya.");
  }

  async function handleSetPin() {
    if (!desktop) return;
    if (newPin.length < 4) { flash("err", "PIN kam se kam 4 digit ka hona chahiye."); return; }
    if (newPin !== confirmPin) { flash("err", "Dono PIN alag hain. Dobara check karein."); return; }
    setPinLoading(true);
    try {
      await desktop.setPin(newPin);
      await desktop.setEnabled(true);
      setPinSet(true);
      setEnabled(true);
      setShowPinSetup(false);
      setNewPin(""); setConfirmPin("");
      flash("ok", "PIN set ho gaya! Auto backup active hai.");
    } finally {
      setPinLoading(false);
    }
  }

  async function handleBackupNow() {
    if (!desktop) return;
    setBackingUp(true);
    try {
      const res = await desktop.create();
      if (res.success) {
        flash("ok", `Backup bana diya: ${res.fileName}`);
        loadState();
      } else {
        flash("err", res.error || "Backup nahi bana.");
      }
    } finally {
      setBackingUp(false);
    }
  }

  async function handleChooseRestore() {
    if (!desktop) return;
    const result = await desktop.chooseAndRestore();
    if (!result.canceled && result.filePath) {
      setRestoreFile(result.filePath);
      setShowRestorePin(true);
      setRestorePin("");
    }
  }

  async function handleRestore() {
    if (!desktop || !restoreFile) return;
    if (!restorePin) { flash("err", "PIN daalna zaroori hai."); return; }
    setRestoring(true);
    try {
      const res = await desktop.restore(restoreFile, restorePin);
      if (res.success) {
        flash("ok", "Restore complete! App restart ho rahi hai...");
        setShowRestorePin(false);
        setRestoreFile(null);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        flash("err", res.error || "Restore nahi hua.");
      }
    } finally {
      setRestoring(false);
    }
  }

  if (!isDesktop) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Backup feature sirf <strong>Desktop (EXE) version</strong> mein available hai.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <HardDrive className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-gray-900">DB Backup Settings</h2>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-2.5 text-sm font-medium flex items-center gap-2 ${msg.type === "ok" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
          {msg.type === "ok" ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-4"><Loader2 className="w-4 h-4 animate-spin" />Loading...</div>
      ) : (
        <>
          {/* Auto Backup Toggle */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 text-sm">Auto Daily Backup</p>
                <p className="text-xs text-gray-500 mt-0.5">Roz ek backup banta hai — last 7 rakhe jaate hain</p>
              </div>
              <button
                onClick={() => handleToggleEnable(!enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-blue-600" : "bg-gray-300"}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            {enabled && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                <Check className="w-3.5 h-3.5" />
                Active — roz raat ko auto backup hoga
              </div>
            )}
          </div>

          {/* PIN Setup Dialog */}
          {showPinSetup && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-blue-800">
                <Shield className="w-4 h-4" />
                <p className="font-semibold text-sm">Backup PIN set karein</p>
              </div>
              <p className="text-xs text-blue-700">Yeh PIN backup file ko lock karega. Restore ke waqt yahi PIN chahiye hoga.</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Naya PIN (4-8 digit)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="1234"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Confirm PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="1234"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSetPin} disabled={pinLoading}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1">
                  {pinLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  PIN Set Karo & Activate
                </button>
                <button onClick={() => { setShowPinSetup(false); setNewPin(""); setConfirmPin(""); }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Change PIN (if already set) */}
          {pinSet && !showPinSetup && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Backup PIN</p>
                    <p className="text-xs text-gray-500">PIN set hai ✓</p>
                  </div>
                </div>
                <button onClick={() => setShowPinSetup(true)}
                  className="text-xs text-blue-600 hover:underline">PIN Change Karo</button>
              </div>
            </div>
          )}

          {/* Backup Now */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 text-sm">Manual Backup</p>
                <p className="text-xs text-gray-500 mt-0.5">Abhi ek backup banao</p>
              </div>
              <button onClick={handleBackupNow} disabled={backingUp || !pinSet}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {backingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
                Backup Banao
              </button>
            </div>
            {!pinSet && <p className="text-xs text-amber-600 mt-2">⚠ Pehle PIN set karein (Auto backup toggle karo)</p>}
          </div>

          {/* Restore */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 text-sm">Restore from Backup</p>
                <p className="text-xs text-gray-500 mt-0.5">.bizcor file choose karo → PIN daalo → Restore</p>
              </div>
              <button onClick={handleChooseRestore} disabled={restoring}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
                <RefreshCw className="w-3.5 h-3.5" />
                Restore Karo
              </button>
            </div>

            {showRestorePin && restoreFile && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <p className="text-xs text-amber-800 font-medium">File: {restoreFile.split(/[\\/]/).pop()}</p>
                <p className="text-xs text-amber-700">⚠ Restore karne se purana data replace ho jaayega!</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={restorePin}
                    onChange={e => setRestorePin(e.target.value.replace(/\D/g, ""))}
                    placeholder="Backup PIN"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button onClick={handleRestore} disabled={restoring}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1">
                    {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Confirm
                  </button>
                  <button onClick={() => { setShowRestorePin(false); setRestoreFile(null); setRestorePin(""); }}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Open Folder */}
          <button onClick={() => desktop?.openFolder()}
            className="flex items-center gap-2 text-sm text-blue-600 hover:underline px-1">
            <FolderOpen className="w-4 h-4" />
            Backup Folder Kholo
          </button>

          {/* Backup List */}
          {backups.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setShowList(!showList)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50">
                <span>Saved Backups ({backups.length}/{7})</span>
                {showList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showList && (
                <div className="divide-y divide-gray-100">
                  {backups.map(b => (
                    <div key={b.name} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-xs font-medium text-gray-800">{b.name}</p>
                        <p className="text-xs text-gray-400">{new Date(b.createdAt).toLocaleString("hi-IN")} · {b.sizeKb} KB</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
