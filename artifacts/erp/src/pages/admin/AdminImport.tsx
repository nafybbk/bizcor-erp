import { useState, useRef } from "react";
import { api } from "@/lib/api";
import { Upload, FileText, Users, Package, CheckCircle2, XCircle, Loader2, ChevronDown, AlertTriangle } from "lucide-react";

type ParsedRow = Record<string, string | number>;

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  errorDetails: string[];
}

interface ImportResponse {
  customers: ImportResult;
  suppliers: ImportResult;
  items: ImportResult;
}

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCsv(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.split(",").map(c => c.trim()));
}

// ── Smart ERP format detectors ────────────────────────────────────────────────
function detectCustomers(rows: string[][]): ParsedRow[] {
  // Format: code, name, address, phone(?), email(?), _, opening_balance
  return rows.map(r => ({
    code: r[0] || "",
    name: r[1] || "",
    address: r[2] || "",
    phone: r[3] || "",
    email: r[4] || "",
    opening_balance: parseFloat(r[6] || r[5] || "0") || 0,
  })).filter(r => r.code && r.name && String(r.name).length > 1);
}

function detectSuppliers(rows: string[][]): ParsedRow[] {
  // Format: code, name, phone, opening_balance
  return rows.map(r => ({
    code: r[0] || "",
    name: r[1] || "",
    phone: r[2] || "",
    opening_balance: parseFloat(r[3] || "0") || 0,
  })).filter(r => r.code && r.name && String(r.name).length > 1);
}

function detectItems(rows: string[][]): ParsedRow[] {
  // Format: code, name, sale_price, purchase_price, opening_stock
  return rows.map(r => ({
    code: r[0] || "",
    name: r[1] || "",
    sale_price: parseFloat(r[2] || "0") || 0,
    purchase_price: parseFloat(r[3] || "0") || 0,
    opening_stock: parseFloat(r[4] || "0") || 0,
  })).filter(r => r.code && r.name && String(r.name).length > 1);
}

// ── File upload box ───────────────────────────────────────────────────────────
function FileBox({
  label, icon, file, count, onFile, accept
}: {
  label: string; icon: React.ReactNode; file: File | null; count: number;
  onFile: (f: File) => void; accept?: string;
}) {
  const inp = useRef<HTMLInputElement>(null);
  return (
    <div
      className="border-2 border-dashed border-gray-200 rounded-xl p-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition text-center"
      onClick={() => inp.current?.click()}
    >
      <input ref={inp} type="file" accept={accept || ".csv,.txt"} className="hidden" onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); }} />
      <div className="flex flex-col items-center gap-2">
        <div className="text-blue-500">{icon}</div>
        <div className="font-medium text-sm text-gray-700">{label}</div>
        {file ? (
          <div className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {file.name} — {count} rows
          </div>
        ) : (
          <div className="text-xs text-gray-400">Click to upload CSV</div>
        )}
      </div>
    </div>
  );
}

// ── Result badge ──────────────────────────────────────────────────────────────
function ResultCard({ label, result }: { label: string; result: ImportResult }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="font-semibold text-sm text-gray-700 mb-2">{label}</div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-green-50 rounded-lg p-2">
          <div className="text-green-700 font-bold text-lg">{result.imported}</div>
          <div className="text-green-600">Imported</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-2">
          <div className="text-yellow-700 font-bold text-lg">{result.skipped}</div>
          <div className="text-yellow-600">Skipped</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <div className="text-red-700 font-bold text-lg">{result.errors}</div>
          <div className="text-red-600">Errors</div>
        </div>
      </div>
      {result.errorDetails?.length > 0 && (
        <div className="mt-2 text-xs text-red-500 space-y-1">
          {result.errorDetails.slice(0, 5).map((e, i) => <div key={i}>• {e}</div>)}
        </div>
      )}
    </div>
  );
}

export default function AdminImport() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [bizLoaded, setBizLoaded] = useState(false);
  const [selectedBiz, setSelectedBiz] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const [custFile, setCustFile] = useState<File | null>(null);
  const [supFile, setSupFile] = useState<File | null>(null);
  const [itemFile, setItemFile] = useState<File | null>(null);

  const [custRows, setCustRows] = useState<ParsedRow[]>([]);
  const [supRows, setSupRows] = useState<ParsedRow[]>([]);
  const [itemRows, setItemRows] = useState<ParsedRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState("");

  const loadBusinesses = async () => {
    if (bizLoaded) return;
    try {
      const r = await api.get<any>("/super-admin/businesses?limit=200");
      setBusinesses(r.data || []);
      setBizLoaded(true);
    } catch { setError("Could not load businesses"); }
  };

  const handleFile = async (file: File, type: "customers" | "suppliers" | "items") => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (type === "customers") { setCustFile(file); setCustRows(detectCustomers(rows)); }
    if (type === "suppliers") { setSupFile(file); setSupRows(detectSuppliers(rows)); }
    if (type === "items") { setItemFile(file); setItemRows(detectItems(rows)); }
  };

  const handleImport = async () => {
    if (!selectedBiz) { setError("Please select a business"); return; }
    if (!custRows.length && !supRows.length && !itemRows.length) {
      setError("Please upload at least one CSV file"); return;
    }
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await api.post<ImportResponse>("/super-admin/import-data", {
        businessId: selectedBiz.id,
        customers: custRows,
        suppliers: supRows,
        items: itemRows,
      });
      setResult(res as ImportResponse);
    } catch (e: any) {
      setError(e?.message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">SMART ERP → BizCor Import Tool</h1>
        <p className="text-sm text-gray-500 mt-1">
          Import data (customers, suppliers, items) from any HMR Systems business
        </p>
      </div>

      {/* Business selector */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="font-semibold text-sm text-gray-700">1. Target Business Select Karein</div>
        <div className="relative">
          <button
            className="w-full border rounded-lg px-3 py-2.5 text-left flex items-center justify-between text-sm hover:bg-gray-50 transition"
            onClick={() => { loadBusinesses(); setShowDropdown(d => !d); }}
          >
            {selectedBiz ? (
              <span className="font-medium">{selectedBiz.name} <span className="text-gray-400 font-normal">({selectedBiz.code})</span></span>
            ) : (
              <span className="text-gray-400">Search and select a business…</span>
            )}
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {showDropdown && (
            <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {!bizLoaded ? (
                <div className="p-3 text-center text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Loading…</div>
              ) : businesses.length === 0 ? (
                <div className="p-3 text-sm text-gray-400">No businesses found</div>
              ) : businesses.map(b => (
                <button
                  key={b.id}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition ${selectedBiz?.id === b.id ? "bg-blue-50 font-semibold" : ""}`}
                  onClick={() => { setSelectedBiz(b); setShowDropdown(false); }}
                >
                  {b.name} <span className="text-gray-400">({b.code})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* File uploads */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="font-semibold text-sm text-gray-700">2. CSV Files Upload Karein (SMART ERP format)</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FileBox
            label="Customers CSV"
            icon={<Users className="w-7 h-7" />}
            file={custFile}
            count={custRows.length}
            onFile={f => handleFile(f, "customers")}
          />
          <FileBox
            label="Suppliers CSV"
            icon={<FileText className="w-7 h-7" />}
            file={supFile}
            count={supRows.length}
            onFile={f => handleFile(f, "suppliers")}
          />
          <FileBox
            label="Items CSV"
            icon={<Package className="w-7 h-7" />}
            file={itemFile}
            count={itemRows.length}
            onFile={f => handleFile(f, "items")}
          />
        </div>

        {/* Preview info */}
        <div className="text-xs text-gray-400 space-y-0.5 bg-gray-50 rounded-lg p-3">
          <div className="font-medium text-gray-500 mb-1">Expected CSV column format:</div>
          <div><span className="font-medium">Customers:</span> code, name, address, phone, email, -, opening_balance</div>
          <div><span className="font-medium">Suppliers:</span> code, name, phone, opening_balance</div>
          <div><span className="font-medium">Items:</span> code, name, sale_price, purchase_price, opening_stock</div>
        </div>
      </div>

      {/* Summary before import */}
      {(custRows.length > 0 || supRows.length > 0 || itemRows.length > 0) && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm">
          <div className="font-semibold text-blue-700 mb-1">Import Summary</div>
          <div className="flex gap-4 flex-wrap text-blue-600">
            {custRows.length > 0 && <span>✓ {custRows.length} customers</span>}
            {supRows.length > 0 && <span>✓ {supRows.length} suppliers</span>}
            {itemRows.length > 0 && <span>✓ {itemRows.length} items</span>}
          </div>
          {selectedBiz && (
            <div className="text-blue-500 mt-1 text-xs">Target: {selectedBiz.name} ({selectedBiz.code})</div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={loading || !selectedBiz}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
        ) : (
          <><Upload className="w-4 h-4" /> Import Data</>
        )}
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-600 font-semibold">
            <CheckCircle2 className="w-5 h-5" /> Import Complete!
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {custFile && <ResultCard label="Customers" result={result.customers} />}
            {supFile && <ResultCard label="Suppliers" result={result.suppliers} />}
            {itemFile && <ResultCard label="Items" result={result.items} />}
          </div>
        </div>
      )}
    </div>
  );
}
