import { useLocation } from "wouter";
import { FileBarChart2, FolderOpen, ChevronRight } from "lucide-react";
import { REPORT_TYPES } from "@/lib/reportEngine/types";
import { useState, useEffect } from "react";
import { loadStoredFolder, pickFolder, listJsonFiles } from "@/lib/fileSystem";
import type { FolderState } from "@/lib/fileSystem";

const TYPE_ICONS: Record<string, string> = {
  sales_invoice:   "🧾",
  credit_note:     "📋",
  purchase_bill:   "📦",
  debit_note:      "🔄",
  receipt:         "💰",
  payment:         "💸",
};

const TYPE_DESC: Record<string, string> = {
  sales_invoice:   "Customer ko diya jaane wala invoice",
  credit_note:     "Sales return ya discount note",
  purchase_bill:   "Supplier se aaya purchase bill",
  debit_note:      "Purchase return ya debit note",
  receipt:         "Payment received ka receipt",
  payment:         "Payment made ka voucher",
};

export default function Home() {
  const [, navigate] = useLocation();
  const [folder, setFolder] = useState<FolderState>({ handle: null, name: null });
  const [savedFiles, setSavedFiles] = useState<string[]>([]);

  useEffect(() => {
    loadStoredFolder().then(async f => {
      setFolder(f);
      if (f.handle) {
        const files = await listJsonFiles(f.handle);
        setSavedFiles(files);
      }
    });
  }, []);

  async function handlePickFolder() {
    const f = await pickFolder();
    if (f.handle) {
      setFolder(f);
      const files = await listJsonFiles(f.handle);
      setSavedFiles(files);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileBarChart2 className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="text-lg font-bold text-white">BizCor Report Designer</h1>
            <p className="text-xs text-gray-400">Standalone · Offline · File-based</p>
          </div>
        </div>

        {/* Folder selector */}
        <button
          onClick={handlePickFolder}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${
            folder.handle
              ? 'bg-green-900/40 border-green-700 text-green-300 hover:bg-green-900/60'
              : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          {folder.name
            ? <span className="max-w-[200px] truncate">{folder.name}</span>
            : <span>Save Folder Chuniye</span>
          }
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Folder info */}
        {!folder.handle && (
          <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-amber-900/30 border border-amber-700/50 rounded-xl text-amber-300 text-sm">
            <FolderOpen className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Save folder select nahi kiya</p>
              <p className="text-xs text-amber-400/80 mt-0.5">
                Upar "Save Folder Chuniye" button se folder select karo. Ek baar set karo — sab templates wahi save hongi automatically.
              </p>
            </div>
          </div>
        )}

        {folder.handle && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-green-900/20 border border-green-700/40 rounded-xl text-green-300 text-sm">
            <div className="text-green-400">📁</div>
            <div>
              <p className="font-medium">{folder.name}</p>
              <p className="text-xs text-green-400/70 mt-0.5">
                {savedFiles.length > 0
                  ? `${savedFiles.length} template${savedFiles.length > 1 ? 's' : ''} saved: ${savedFiles.join(', ')}`
                  : 'Abhi koi template save nahi hai'
                }
              </p>
            </div>
          </div>
        )}

        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">Report Type Chuniye</h2>

        <div className="grid grid-cols-1 gap-3">
          {REPORT_TYPES.map(rt => {
            const filename = `${rt.key}.json`;
            const hasSaved = savedFiles.includes(filename);
            return (
              <button
                key={rt.key}
                onClick={() => navigate(`/designer/${rt.key}`)}
                className="flex items-center gap-4 px-5 py-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl transition-all text-left group"
              >
                <span className="text-2xl">{TYPE_ICONS[rt.key] || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{rt.label}</span>
                    {hasSaved && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-900/50 border border-green-700/50 rounded-full text-green-400">
                        ✓ Saved
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{TYPE_DESC[rt.key] || ''}</p>
                  {hasSaved && (
                    <p className="text-[10px] text-green-500/70 mt-0.5">{filename}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
              </button>
            );
          })}
        </div>

        <div className="mt-8 px-4 py-3 bg-gray-900/60 border border-gray-800 rounded-xl text-xs text-gray-500">
          <p className="font-medium text-gray-400 mb-1">📖 Kaise kaam karta hai:</p>
          <ol className="space-y-1 list-decimal list-inside">
            <li>Upar se save folder set karo (ek baar)</li>
            <li>Report type choose karo → design karo</li>
            <li><strong className="text-gray-300">"Save to File"</strong> click karo → JSON file save hogi us folder mein</li>
            <li>Us folder se file BizCor ke <code className="text-blue-400">templates/&lt;businessId&gt;/</code> folder mein copy karo</li>
            <li>BizCor automatically wahi file use karega print ke liye</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
