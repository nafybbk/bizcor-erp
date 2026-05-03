import { useEffect, useRef, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Plus, Loader2, Edit2, Trash2, X, Check, GripVertical } from "lucide-react";

export default function TaxRates() {
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editRate, setEditRate] = useState("");

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const touchDragIdx = useRef<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get<any>("/masters/tax-rates").then(r => setRates(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await api.post("/masters/tax-rates", { name, rate: Number(rate) });
    setName(""); setRate(""); setSaving(false); load();
  };

  const startEdit = (r: any) => { setEditId(r.id); setEditName(r.name); setEditRate(String(r.rate)); };
  const cancelEdit = () => setEditId(null);
  const saveEdit = async (id: number) => {
    await api.patch(`/masters/tax-rates/${id}`, { name: editName, rate: Number(editRate) });
    setEditId(null); load();
  };

  const del = async (id: number) => {
    if (!confirm("Delete this tax rate?")) return;
    await api.delete(`/masters/tax-rates/${id}`);
    load();
  };

  const saveOrder = async (newRates: any[]) => {
    await api.patch("/masters/tax-rates/reorder", { order: newRates.map(r => r.id) });
  };

  const applyReorder = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const next = [...rates];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setRates(next);
    saveOrder(next);
  };

  // Desktop drag handlers
  const onDragStart = (idx: number) => setDragIdx(idx);
  const onDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const onDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };
  const onDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx !== null) applyReorder(dragIdx, idx);
    setDragIdx(null); setDragOverIdx(null);
  };

  // Mobile touch drag handlers
  const onTouchStartHandle = (idx: number) => { touchDragIdx.current = idx; setDragIdx(idx); };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const row = el?.closest("[data-drag-idx]");
    if (row) setDragOverIdx(Number(row.getAttribute("data-drag-idx")));
  };
  const onTouchEnd = () => {
    if (touchDragIdx.current !== null && dragOverIdx !== null) {
      applyReorder(touchDragIdx.current, dragOverIdx);
    }
    touchDragIdx.current = null;
    setDragIdx(null); setDragOverIdx(null);
  };

  const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">GST Tax Rates</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4 text-sm">Add New Tax Rate</h3>
        <form onSubmit={save} className="flex gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. GST 18%)"
            className={inputCls + " flex-1"} required />
          <input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="Rate (%)" min="0" max="100"
            className={inputCls + " w-24"} required />
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : (
          <>
            {rates.length > 1 && (
              <p className="px-4 pt-3 pb-0 text-xs text-gray-400 flex items-center gap-1">
                <GripVertical className="w-3 h-3" /> Hold &amp; drag to reorder
              </p>
            )}
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="w-8 px-2 py-3"></th>
                  <th className="text-left px-4 py-3 font-medium">#</th>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-right px-4 py-3 font-medium">Rate</th>
                  <th className="text-right px-4 py-3 font-medium">CGST</th>
                  <th className="text-right px-4 py-3 font-medium">SGST</th>
                  <th className="text-right px-4 py-3 font-medium">IGST</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50" onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                {rates.map((r, idx) => (
                  <tr
                    key={r.id}
                    data-drag-idx={idx}
                    draggable
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={e => onDragOver(e, idx)}
                    onDrop={e => onDrop(e, idx)}
                    onDragEnd={onDragEnd}
                    className={`transition-all ${dragIdx === idx ? "opacity-40 bg-blue-50" : "hover:bg-gray-50"} ${dragOverIdx === idx && dragIdx !== idx ? "border-t-2 border-blue-500" : ""}`}
                  >
                    <td className="pl-3 pr-1 py-3">
                      <span
                        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none select-none inline-flex"
                        onTouchStart={() => onTouchStartHandle(idx)}
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-4 h-4" />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                    {editId === r.id ? (
                      <>
                        <td className="px-2 py-2"><input value={editName} onChange={e => setEditName(e.target.value)} className={inputCls + " w-full"} /></td>
                        <td className="px-2 py-2 text-right"><input type="number" value={editRate} onChange={e => setEditRate(e.target.value)} className={inputCls + " w-20 text-right"} /></td>
                        <td colSpan={2} className="px-2 py-2 text-center text-xs text-gray-400">Will recalculate</td>
                        <td className="px-2 py-2"></td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            <button onClick={() => saveEdit(r.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4" /></button>
                            <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                        <td className="px-4 py-3 text-right font-bold text-blue-700">{r.rate}%</td>
                        <td className="px-4 py-3 text-right text-gray-500">{fmt.number(r.cgst, 1)}%</td>
                        <td className="px-4 py-3 text-right text-gray-500">{fmt.number(r.sgst, 1)}%</td>
                        <td className="px-4 py-3 text-right text-gray-500">{fmt.number(r.igst, 1)}%</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => startEdit(r)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => del(r.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
