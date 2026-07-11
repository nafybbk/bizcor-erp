import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Loader2, Edit2, Trash2, X, Check, Upload, FileSpreadsheet, AlertCircle, ChevronDown } from "lucide-react";
import * as XLSX from "xlsx";
import SortableTh from "@/components/SortableTh";
import { useSort } from "@/lib/useSort";

// ── Column auto-detection — handles multiple GST portal export formats ─────────
const COL_ALIASES: Record<string, string[]> = {
  code: ["hsn code", "hsn/sac", "hsn", "sac code", "sac", "hsncode", "hsn_code", "code", "commodity code"],
  description: ["description", "goods and service", "goods/service", "goods & service", "commodity", "item description", "product description", "desc"],
  taxRate: ["igst rate", "gst rate", "igst%", "gst%", "tax rate", "rate", "igst", "gst", "tax%", "rate%"],
};

function detectCol(headers: string[], colKey: "code" | "description" | "taxRate"): number {
  const aliases = COL_ALIASES[colKey];
  for (const alias of aliases) {
    const idx = headers.findIndex(h => h.toLowerCase().trim() === alias);
    if (idx >= 0) return idx;
  }
  // Partial match fallback
  for (const alias of aliases) {
    const idx = headers.findIndex(h => h.toLowerCase().trim().includes(alias));
    if (idx >= 0) return idx;
  }
  return -1;
}

interface ParsedRow { code: string; description: string; taxRate: string; _raw: string[] }
interface ColMap { code: number; description: number; taxRate: number }

function parseFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
        // Skip empty leading rows
        const firstNonEmpty = raw.findIndex(r => r.some(c => String(c).trim()));
        const trimmed = raw.slice(firstNonEmpty);
        // GST portal exports often have title/banner rows above the real
        // header — scan the first few rows for the one with an HSN column
        let headerIdx = 0;
        for (let i = 0; i < Math.min(trimmed.length, 10); i++) {
          const candidate = (trimmed[i] || []).map(h => String(h).trim());
          if (detectCol(candidate, "code") >= 0) { headerIdx = i; break; }
        }
        const headers = (trimmed[headerIdx] || []).map(h => String(h).trim());
        const rows = trimmed.slice(headerIdx + 1).filter(r => r.some(c => String(c).trim()));
        resolve({ headers, rows: rows.map(r => r.map(c => String(c).trim())) });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function HsnCodes() {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", description: "", taxRate: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ code: "", description: "", taxRate: "" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<"idle" | "preview" | "done">("idle");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [colMap, setColMap] = useState<ColMap>({ code: -1, description: -1, taxRate: -1 });
  const [importMode, setImportMode] = useState<"skip" | "overwrite">("skip");
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; skipped: number; total: number } | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  const load = () => {
    setLoading(true);
    api.get<any>("/masters/hsn").then(r => setCodes(r.data)).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await api.post("/masters/hsn", { ...form, taxRate: form.taxRate ? Number(form.taxRate) : null });
    setForm({ code: "", description: "", taxRate: "" }); setSaving(false); load();
  };
  const startEdit = (c: any) => { setEditId(c.id); setEditForm({ code: c.code, description: c.description || "", taxRate: c.taxRate ? String(c.taxRate) : "" }); };
  const cancelEdit = () => setEditId(null);
  const saveEdit = async (id: number) => {
    await api.patch(`/masters/hsn/${id}`, { ...editForm, taxRate: editForm.taxRate ? Number(editForm.taxRate) : null });
    setEditId(null); load();
  };
  const del = async (id: number) => {
    if (!confirm("Delete HSN code?")) return;
    await api.delete(`/masters/hsn/${id}`); load();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setImportResult(null);
    setFileName(file.name);
    try {
      const { headers: h, rows: r } = await parseFile(file);
      if (h.length === 0 || r.length === 0) { setParseError("File mein koi data nahi mila. CSV/Excel format check karo."); return; }
      const cm: ColMap = {
        code: detectCol(h, "code"),
        description: detectCol(h, "description"),
        taxRate: detectCol(h, "taxRate"),
      };
      setHeaders(h);
      setRawRows(r);
      setColMap(cm);
      setUploadStep("preview");
    } catch {
      setParseError("File parse nahi ho saka. CSV ya Excel (.xlsx) format mein hona chahiye.");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const parsedRows: ParsedRow[] = rawRows.map(r => ({
    code: colMap.code >= 0 ? r[colMap.code] || "" : "",
    description: colMap.description >= 0 ? r[colMap.description] || "" : "",
    taxRate: colMap.taxRate >= 0 ? r[colMap.taxRate] || "" : "",
    _raw: r,
  })).filter(r => r.code.trim());

  const doImport = async () => {
    if (parsedRows.length === 0) return;
    setUploading(true);
    setImportProgress(0);
    try {
      const payload = parsedRows.map(r => ({ code: r.code.trim(), description: r.description.trim() || undefined, taxRate: r.taxRate ? r.taxRate.replace(/[^0-9.]/g, "") : null }));
      // GST portal's full directory = thousands of rows; one giant request
      // used to hit the serverless time/size limits, so send in chunks
      const CHUNK = 1000;
      const totals = { inserted: 0, updated: 0, skipped: 0, total: payload.length };
      for (let i = 0; i < payload.length; i += CHUNK) {
        const result = await api.post<any>("/masters/hsn/import", {
          rows: payload.slice(i, i + CHUNK),
          mode: importMode,
        });
        totals.inserted += result.inserted || 0;
        totals.updated += result.updated || 0;
        totals.skipped += result.skipped || 0;
        setImportProgress(Math.min(i + CHUNK, payload.length));
      }
      setImportResult(totals);
      setUploadStep("done");
      load();
    } catch (err: any) {
      setParseError(err?.message || "Import nahi ho saka");
    } finally { setUploading(false); setImportProgress(0); }
  };

  const resetUpload = () => { setUploadStep("idle"); setHeaders([]); setRawRows([]); setImportResult(null); setParseError(null); setFileName(""); };

  const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const filtered = search ? codes.filter(c => c.code.toLowerCase().includes(search.toLowerCase()) || (c.description || "").toLowerCase().includes(search.toLowerCase())) : codes;
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered);
  // Full portal directory = thousands of rows — render one page at a time
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const onSortReset = (k: string) => { toggleSort(k); setPage(1); };

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">HSN / SAC Codes</h1>
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search code or description..."
            className={inputCls + " w-56"} />
          <button
            onClick={() => { resetUpload(); fileRef.current?.click(); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg">
            <Upload className="w-4 h-4" /> GST Portal Upload
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFileChange} />
        </div>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm">Add New Code</h3>
        <form onSubmit={save} className="grid grid-cols-4 gap-3">
          <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="HSN/SAC Code"
            className={inputCls} required />
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description"
            className={inputCls + " col-span-2"} />
          <div className="flex gap-2">
            <input type="number" value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: e.target.value }))} placeholder="Tax %"
              className={inputCls + " flex-1"} />
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>

      {/* Upload Preview Panel */}
      {uploadStep !== "idle" && (
        <div className="bg-white rounded-xl border border-green-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-green-50 border-b border-green-100">
            <div className="flex items-center gap-2 font-semibold text-green-800 text-sm">
              <FileSpreadsheet className="w-4 h-4" />
              {fileName} — {uploadStep === "done" ? "Import Complete" : `${parsedRows.length} rows ready`}
            </div>
            <button onClick={resetUpload} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>

          {parseError && (
            <div className="flex items-start gap-2 px-5 py-3 bg-red-50 text-red-700 text-sm border-b border-red-100">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {parseError}
            </div>
          )}

          {uploadStep === "preview" && !parseError && (
            <div className="p-5 space-y-4">
              {/* Column mapping */}
              <div className="grid grid-cols-3 gap-3">
                {(["code", "description", "taxRate"] as const).map(key => {
                  const labels: Record<string, string> = { code: "HSN/SAC Code *", description: "Description", taxRate: "Tax Rate %" };
                  return (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{labels[key]}</label>
                      <div className="relative">
                        <select
                          value={colMap[key]}
                          onChange={e => setColMap(m => ({ ...m, [key]: Number(e.target.value) }))}
                          className={inputCls + " w-full pr-8 appearance-none " + (key === "code" && colMap.code < 0 ? "border-red-400" : "")}>
                          <option value={-1}>— Column nahi mila —</option>
                          {headers.map((h, i) => <option key={i} value={i}>{h} (Col {i + 1})</option>)}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {colMap.code < 0 && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                  <AlertCircle className="w-3.5 h-3.5" /> HSN Code column select karo tabhi import hoga
                </div>
              )}

              {/* Preview table */}
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">Preview (pehli 10 rows):</div>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">#</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">HSN/SAC Code</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">Tax %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {parsedRows.slice(0, 10).map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2 font-mono font-bold text-blue-700">{r.code || <span className="text-red-400">missing</span>}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{r.description || "—"}</td>
                          <td className="px-3 py-2 text-right text-gray-500">{r.taxRate || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedRows.length > 10 && (
                    <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-100 text-center">
                      + {parsedRows.length - 10} more rows
                    </div>
                  )}
                </div>
              </div>

              {/* Import options */}
              <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Duplicate codes:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" name="mode" checked={importMode === "skip"} onChange={() => setImportMode("skip")} className="accent-blue-600" />
                    <span>Skip (existing keep karein)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" name="mode" checked={importMode === "overwrite"} onChange={() => setImportMode("overwrite")} className="accent-orange-500" />
                    <span>Overwrite (update karein)</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={resetUpload} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
                  <button
                    onClick={doImport}
                    disabled={uploading || colMap.code < 0 || parsedRows.length === 0}
                    className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? `Importing… ${importProgress}/${parsedRows.length}` : `Import ${parsedRows.length} Codes`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {uploadStep === "done" && importResult && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Total Rows", value: importResult.total, color: "text-gray-700 bg-gray-50 border-gray-200" },
                  { label: "Naye Add", value: importResult.inserted, color: "text-green-700 bg-green-50 border-green-200" },
                  { label: "Updated", value: importResult.updated, color: "text-blue-700 bg-blue-50 border-blue-200" },
                  { label: "Skipped", value: importResult.skipped, color: "text-gray-500 bg-gray-50 border-gray-200" },
                ].map(s => (
                  <div key={s.label} className={`rounded-lg border px-4 py-3 text-center ${s.color}`}>
                    <div className="text-2xl font-bold">{s.value}</div>
                    <div className="text-xs font-medium mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button onClick={resetUpload} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg font-medium">Done</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HSN Codes Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">#</th>
                <SortableTh label="Code" sortKey="code" currentKey={sortKey} dir={sortDir} onSort={onSortReset} />
                <SortableTh label="Description" sortKey="description" currentKey={sortKey} dir={sortDir} onSort={onSortReset} />
                <SortableTh label="Tax Rate" sortKey="taxRate" currentKey={sortKey} dir={sortDir} onSort={onSortReset} align="right" />
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pageRows.map((c, idx) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 text-xs">{(safePage - 1) * PAGE_SIZE + idx + 1}</td>
                  {editId === c.id ? (
                    <>
                      <td className="px-2 py-2"><input value={editForm.code} onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))} className={inputCls + " w-32"} /></td>
                      <td className="px-2 py-2"><input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className={inputCls + " w-full"} /></td>
                      <td className="px-2 py-2"><input type="number" value={editForm.taxRate} onChange={e => setEditForm(f => ({ ...f, taxRate: e.target.value }))} className={inputCls + " w-20 text-right"} /></td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => saveEdit(c.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4" /></button>
                          <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-mono font-bold text-blue-700">{c.code}</td>
                      <td className="px-4 py-3 text-gray-700">{c.description || "-"}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{c.taxRate ? `${c.taxRate}%` : "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => startEdit(c)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => del(c.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {codes.length === 0 ? "No HSN codes added yet" : "Koi result nahi mila"}
                </td></tr>
              )}
            </tbody>
          </table>
        )}
        {codes.length > 0 && (
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              Showing {sorted.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
              {search ? ` (filtered from ${codes.length})` : ""}
            </span>
            {sorted.length > PAGE_SIZE && (
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40">Prev</button>
                <span className="text-gray-400">Page {safePage} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40">Next</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
