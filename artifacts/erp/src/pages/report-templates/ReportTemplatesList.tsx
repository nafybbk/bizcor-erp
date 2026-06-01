import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  FileBarChart2, Plus, Copy, Trash2, Star, Download, Upload,
  Eye, Edit2, MoreVertical, Package, Lock, Sparkles,
} from "lucide-react";
import type { SavedTemplate } from "@/lib/reportEngine/types";
import { REPORT_TYPES } from "@/lib/reportEngine/types";

export default function ReportTemplatesList() {
  const { user, business } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role !== 'staff';

  // Plan gate — paid plan only
  const hasAccess = user?.role === 'super_admin' ||
    (!business?.isTrial && !!business?.planExpiresAt && new Date(business.planExpiresAt) > new Date());

  const [activeType, setActiveType] = useState<string>('');
  const [importError, setImportError] = useState('');

  const { data: templates = [], isLoading } = useQuery<SavedTemplate[]>({
    queryKey: ['report-templates', activeType],
    queryFn: () => api.get<SavedTemplate[]>(
      activeType ? `/report-templates?report_type=${activeType}` : '/report-templates'
    ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete<{ success: boolean }>(`/report-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-templates'] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => api.post<SavedTemplate>(`/report-templates/${id}/duplicate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-templates'] }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: number) => api.post<{ success: boolean }>(`/report-templates/${id}/set-default`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-templates'] }),
  });

  async function handleExport(tmpl: SavedTemplate) {
    try {
      const token = localStorage.getItem('erp_token') || sessionStorage.getItem('erp_token') || '';
      const base = (import.meta.env.BASE_URL + 'api').replace(/\/+/g, '/').replace(/\/$/, '');
      const res = await fetch(`${base}/report-templates/${tmpl.id}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tmpl.name.replace(/[^a-z0-9]/gi, '_')}_v${tmpl.version}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api.post<SavedTemplate>('/report-templates/import', data);
      qc.invalidateQueries({ queryKey: ['report-templates'] });
    } catch (err: any) {
      setImportError(err?.data?.error || err?.message || 'Import failed');
    }
    e.target.value = '';
  }

  // Group by report type
  const grouped = templates.reduce<Record<string, SavedTemplate[]>>((acc, t) => {
    if (!acc[t.reportType]) acc[t.reportType] = [];
    acc[t.reportType].push(t);
    return acc;
  }, {});

  const reportTypeLabel = (key: string) =>
    REPORT_TYPES.find(r => r.key === key)?.label || key;

  // ── Plan Gate ──────────────────────────────────────────────────────────────
  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto p-8 mt-16 text-center">
        <div className="bg-white rounded-2xl border border-amber-200 shadow-lg p-10 space-y-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mx-auto">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Report Designer
            </h2>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed">
              Custom invoice templates, letterhead design, aur Crystal Reports style formula editor —<br />
              yeh feature <strong>paid plan</strong> mein available hai.
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1.5">
            <div className="flex items-center gap-2">✅ Drag &amp; drop template designer</div>
            <div className="flex items-center gap-2">✅ Custom invoice / purchase bill layout</div>
            <div className="flex items-center gap-2">✅ Formula editor (Crystal Reports style)</div>
            <div className="flex items-center gap-2">✅ Multi-page, bands, headers, footers</div>
            <div className="flex items-center gap-2">✅ Save, preview, aur print karo</div>
          </div>
          {business?.isTrial && (
            <p className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
              ⚠️ Trial mein Report Designer available nahi hai. Plan activate karo.
            </p>
          )}
          <Link href="/settings/subscription">
            <a className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
              <Sparkles className="w-4 h-4" />
              Plans Dekho &amp; Upgrade Karo
            </a>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileBarChart2 className="w-5 h-5 text-blue-600" />
            Report Templates
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Custom print templates — Invoice, Ledger, Stock Report, aur sab reports
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Upload className="w-4 h-4" />
              Import
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
            <button
              onClick={() => window.open('/report-templates/new', '_blank', 'width=1600,height=960,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
          </div>
        )}
      </div>

      {importError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
          {importError}
        </div>
      )}

      {/* Report type filter tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveType('')}
          className={`px-3 py-1 text-sm rounded-full border transition-colors ${activeType === '' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          All Types
        </button>
        {REPORT_TYPES.slice(0, 8).map(rt => (
          <button
            key={rt.key}
            onClick={() => setActiveType(rt.key)}
            className={`px-3 py-1 text-sm rounded-full border transition-colors ${activeType === rt.key ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            {rt.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : templates.length === 0 ? (
        <EmptyState isAdmin={isAdmin} />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, list]) => (
            <div key={type}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                {reportTypeLabel(type)}
                <span className="text-gray-400 font-normal normal-case tracking-normal">({list.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {list.map(tmpl => (
                  <TemplateCard
                    key={tmpl.id}
                    tmpl={tmpl}
                    isAdmin={isAdmin}
                    onDelete={() => {
                      if (confirm(`"${tmpl.name}" delete karna chahte ho?`)) {
                        deleteMutation.mutate(tmpl.id);
                      }
                    }}
                    onDuplicate={() => duplicateMutation.mutate(tmpl.id)}
                    onSetDefault={() => setDefaultMutation.mutate(tmpl.id)}
                    onExport={() => handleExport(tmpl)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Template Card ─────────────────────────────────────────────────────────────
interface TemplateCardProps {
  tmpl: SavedTemplate;
  isAdmin: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onSetDefault: () => void;
  onExport: () => void;
}

function TemplateCard({ tmpl, isAdmin, onDelete, onDuplicate, onSetDefault, onExport }: TemplateCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FileBarChart2 className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="font-medium text-gray-900 text-sm truncate">{tmpl.name}</span>
            {tmpl.isDefault && (
              <span className="shrink-0 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                Default
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-gray-400">
            <span className="bg-gray-100 px-2 py-0.5 rounded">{tmpl.paperSize}</span>
            <span className="bg-gray-100 px-2 py-0.5 rounded capitalize">{tmpl.orientation}</span>
            <span className="bg-gray-100 px-2 py-0.5 rounded">v{tmpl.version}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Link href={`/report-templates/${tmpl.id}/preview`}>
            <a className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Preview">
              <Eye className="w-4 h-4" />
            </a>
          </Link>
          {isAdmin && (
            <button
              onClick={() => window.open(`/report-templates/${tmpl.id}/edit`, '_blank', 'width=1600,height=960,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes')}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit (naye window mein)"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                  {isAdmin && !tmpl.isDefault && (
                    <button
                      onClick={() => { setMenuOpen(false); onSetDefault(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Star className="w-4 h-4 text-amber-500" />
                      Set as Default
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => { setMenuOpen(false); onDuplicate(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Copy className="w-4 h-4 text-blue-500" />
                      Duplicate
                    </button>
                  )}
                  <button
                    onClick={() => { setMenuOpen(false); onExport(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="w-4 h-4 text-green-500" />
                    Export JSON
                  </button>
                  {isAdmin && (
                    <>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={() => { setMenuOpen(false); onDelete(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="text-center py-16 space-y-4">
      <div className="w-16 h-16 mx-auto bg-blue-50 rounded-2xl flex items-center justify-center">
        <FileBarChart2 className="w-8 h-8 text-blue-400" />
      </div>
      <div>
        <p className="font-medium text-gray-700">Koi template nahi hai</p>
        <p className="text-sm text-gray-400 mt-1">
          {isAdmin ? 'Pehla template banao — New Template button se' : 'Admin se template banwao'}
        </p>
      </div>
      {isAdmin && (
        <button
          onClick={() => window.open('/report-templates/new', '_blank', 'width=1600,height=960,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Pehla Template Banao
        </button>
      )}
    </div>
  );
}
