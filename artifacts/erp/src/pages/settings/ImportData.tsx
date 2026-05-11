import { useState, useRef } from "react";
import { api } from "@/lib/api";
import {
  Upload, FileSpreadsheet, ShoppingCart, Package, Users,
  CheckCircle2, AlertTriangle, Loader2, Info, Download, Shield,
} from "lucide-react";

const ERP_PRESETS: Record<string, { label: string; desc: string }> = {
  smarterp: {
    label: "SmartERP (HMR Systems / SQL Server)",
    desc: "Excel file with GST Invoices, Qty Sold aur GRN-ITC sheets",
  },
};

async function parseExcel(file: File): Promise<Record<string, any[]>> {
  const xlsx = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = xlsx.read(buf, { type: "array", cellDates: false });
  const result: Record<string, any[]> = {};
  for (const name of wb.SheetNames) {
    result[name] = xlsx.utils.sheet_to_json(wb.Sheets[name], { defval: "" });
  }
  return result;
}

function Badge({ n, label, icon }: { n: number; label: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-xl p-4 text-center">
      <div className="flex justify-center mb-1 text-blue-500">{icon}</div>
      <div className="text-2xl font-bold text-gray-800">{n.toLocaleString("en-IN")}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function ResultRow({ label, created, skipped, errors }: { label: string; created: number; skipped: number; errors: number }) {
  return (
    <div className="flex items-center gap-3 text-sm py-2 border-b border-gray-50 last:border-0">
      <span className="w-36 font-medium text-gray-700">{label}</span>
      <span className="text-green-600 font-semibold w-20">✓ {created} imported</span>
      <span className="text-amber-500 w-20">⟳ {skipped} skipped</span>
      <span className="text-red-500 w-20">✗ {errors} errors</span>
    </div>
  );
}

type Step = "idle" | "backing-up" | "backed-up" | "importing" | "done";

export default function ImportData() {
  const [erpType, setErpType] = useState("smarterp");
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<Record<string, any[]>>({});
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  const [step, setStep] = useState<Step>("idle");
  const [backupFilename, setBackupFilename] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  const invoices = sheets["GST Invoices"] || [];
  const qtySold = sheets["Qty Sold"] || [];
  const purchases = sheets["GRN-ITC"] || [];

  const handleFile = async (f: File) => {
    setFile(f); setSheets({}); setParseError(""); setResult(null); setStep("idle"); setError("");
    setParsing(true);
    try {
      const parsed = await parseExcel(f);
      setSheets(parsed);
    } catch (e: any) {
      setParseError("File parse nahi hua: " + (e.message || "Unknown error"));
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!invoices.length && !purchases.length) { setError("File mein data nahi mila"); return; }
    setError(""); setResult(null);

    // ── Step 1: Auto backup ────────────────────────────────────────────────
    setStep("backing-up");
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}api/businesses/backup`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("erp_token")}` },
      });
      if (!resp.ok) throw new Error("Backup API ne error diya");

      const blob = await resp.blob();
      const disposition = resp.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const fname = match?.[1] || `backup-${Date.now()}.json`;

      // Trigger browser download (works for both online and offline)
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fname; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setBackupFilename(fname);
      setStep("backed-up");

      // Small pause so user sees the backup confirmation
      await new Promise(r => setTimeout(r, 1200));
    } catch (e: any) {
      setError("Backup failed: " + (e.message || "Unknown error"));
      setStep("idle");
      return;
    }

    // ── Step 2: Import ─────────────────────────────────────────────────────
    setStep("importing");
    try {
      const res = await api.post<any>("/import-smarterp-self", {
        invoices, qtySold, purchases,
      });
      setResult(res);
      setStep("done");
    } catch (e: any) {
      setError(e?.message || "Import failed");
      setStep("idle");
    }
  };

  const canImport = !parsing && (invoices.length > 0 || purchases.length > 0) && step === "idle";
  const busy = step === "backing-up" || step === "importing";

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Data Import</h1>
        <p className="text-sm text-gray-500 mt-0.5">Purane ERP ka data BizCor mein import karein — import se pehle auto-backup hoga</p>
      </div>

      {/* ERP Type */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="text-sm font-semibold text-gray-700">1. ERP chunein</div>
        <div className="space-y-2">
          {Object.entries(ERP_PRESETS).map(([key, p]) => (
            <label key={key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${erpType === key ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
              <input type="radio" name="erp" value={key} checked={erpType === key} onChange={() => setErpType(key)} className="mt-0.5 accent-blue-600" />
              <div>
                <div className="font-medium text-sm text-gray-800">{p.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{p.desc}</div>
              </div>
            </label>
          ))}
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            Tally, BUSY support — jald aayega
          </div>
        </div>
      </div>

      {/* File Upload */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="text-sm font-semibold text-gray-700">2. Excel file upload karein</div>
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${file ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-blue-400 hover:bg-blue-50/30"}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          {parsing ? (
            <div className="flex flex-col items-center gap-2 text-blue-500">
              <Loader2 className="w-8 h-8 animate-spin" />
              <div className="text-sm">Parsing Excel…</div>
            </div>
          ) : file ? (
            <div className="flex flex-col items-center gap-1">
              <FileSpreadsheet className="w-10 h-10 text-green-500" />
              <div className="font-medium text-sm text-gray-700">{file.name}</div>
              <div className="text-xs text-green-600">File ready — click to change</div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <Upload className="w-8 h-8" />
              <div className="text-sm">Click or drag & drop Excel file here</div>
              <div className="text-xs">.xlsx ya .xls format</div>
            </div>
          )}
        </div>

        {parseError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {parseError}
          </div>
        )}

        {Object.keys(sheets).length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Detected sheets</div>
            <div className="grid grid-cols-3 gap-3">
              <Badge n={invoices.length} label="GST Invoices" icon={<ShoppingCart className="w-5 h-5" />} />
              <Badge n={qtySold.length} label="Qty Sold (items)" icon={<Package className="w-5 h-5" />} />
              <Badge n={purchases.length} label="GRN / Purchases" icon={<Users className="w-5 h-5" />} />
            </div>
          </div>
        )}
      </div>

      {/* Progress steps */}
      {(busy || step === "backed-up" || step === "done") && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="text-sm font-semibold text-gray-700">Progress</div>
          <div className="space-y-2">
            {/* Backup step */}
            <div className={`flex items-center gap-3 text-sm rounded-lg px-3 py-2 ${step === "backing-up" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>
              {step === "backing-up"
                ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
              <div>
                <span className="font-medium">
                  {step === "backing-up" ? "Pehle backup ho raha hai…" : "Backup complete!"}
                </span>
                {step !== "backing-up" && backupFilename && (
                  <div className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                    <Download className="w-3 h-3" />
                    <span>Aapke Downloads folder mein save hua: <strong>{backupFilename}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Import step */}
            {(step === "importing" || step === "done") && (
              <div className={`flex items-center gap-3 text-sm rounded-lg px-3 py-2 ${step === "importing" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>
                {step === "importing"
                  ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                <span className="font-medium">
                  {step === "importing" ? "Data import ho raha hai…" : "Import complete!"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Safety notice */}
      {canImport && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
          <div>
            <span className="font-semibold">Import se pehle full backup hoga — auto!</span>
            <div className="text-xs mt-0.5 text-amber-600">
              Aapka poora data (parties, items, vouchers, payments) pehle aapke device pe download hoga,
              phir import shuru hoga. Kuch galat ho toh backup se wapas aa sakte hain.
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {step !== "done" && (
        <button
          onClick={handleImport}
          disabled={!canImport || busy}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition"
        >
          {step === "backing-up" && <><Loader2 className="w-4 h-4 animate-spin" /> Backup ho raha hai…</>}
          {step === "importing" && <><Loader2 className="w-4 h-4 animate-spin" /> Import ho raha hai…</>}
          {step === "idle" && <><Upload className="w-4 h-4" /> Backup karke Import Shuru Karo</>}
          {step === "backed-up" && <><Loader2 className="w-4 h-4 animate-spin" /> Import ho raha hai…</>}
        </button>
      )}

      {/* Results */}
      {result && step === "done" && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-600 font-semibold">
            <CheckCircle2 className="w-5 h-5" /> Import Complete!
          </div>
          <div className="grid grid-cols-2 gap-3 text-center text-sm">
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-700">{result.counts?.partiesCreated || 0}</div>
              <div className="text-green-600 text-xs">Parties created</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-700">{result.counts?.itemsCreated || 0}</div>
              <div className="text-blue-600 text-xs">Items created</div>
            </div>
          </div>
          <div className="border rounded-lg p-3 space-y-0.5">
            <ResultRow label="Sales Invoices" created={result.counts?.salesCreated || 0} skipped={result.counts?.salesSkipped || 0} errors={result.counts?.salesErrors || 0} />
            <ResultRow label="Purchase Bills" created={result.counts?.purchasesCreated || 0} skipped={result.counts?.purchasesSkipped || 0} errors={result.counts?.purchasesErrors || 0} />
          </div>
          {result.log?.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-red-600">Errors / Notes ({result.log.length})</div>
              <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                {result.log.map((l: string, i: number) => (
                  <div key={i} className="text-xs text-gray-600 font-mono">• {l}</div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
            <Download className="w-3.5 h-3.5" />
            Backup file <strong>{backupFilename}</strong> aapke Downloads folder mein hai — kabhi bhi revert kar sakte hain
          </div>
        </div>
      )}
    </div>
  );
}
