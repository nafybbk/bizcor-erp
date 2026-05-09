import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { api, fmt, isOfflineError, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { saveDraft } from "@/lib/offlineQueue";
import { cacheParties, getCachedParties, cacheItems, getCachedItems, cacheUnits, getCachedUnits, cacheTaxRates, getCachedTaxRates } from "@/lib/masterCache";
import { getFieldSize, saveFieldSize, type FieldSize } from "@/lib/uiPrefs";
import { Plus, Trash2, Loader2, ToggleLeft, ToggleRight, AlertTriangle, X, CloudOff, Link2, RefreshCw, Archive, CalendarClock, CheckCircle } from "lucide-react";
import PartySelect from "@/components/PartySelect";

/* ── Item Combobox — typeahead with master search + keyboard nav + new-item badge ─ */
function ItemCombobox({
  masterItems, value, itemId, isSales, onChange, rowIdx,
}: {
  masterItems: any[];
  value: string;
  itemId?: number;
  isSales: boolean;
  onChange: (sel: { itemId?: number; itemName: string; item?: any }) => void;
  rowIdx: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [hilite, setHilite] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll highlighted item into view inside dropdown
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-hilite="true"]`) as HTMLElement;
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [hilite]);

  const q = query.trim().toLowerCase();
  const filtered = q.length === 0
    ? masterItems.slice(0, 20)
    : masterItems.filter(i => i.name.toLowerCase().includes(q)).slice(0, 30);

  const exactMatch = masterItems.find(i => i.name.toLowerCase() === q);
  const isNew = q.length > 0 && !exactMatch;
  const isSaved = !!itemId && !isNew;

  const selectItem = (item: any, focusHsn = false) => {
    setQuery(item.name);
    setOpen(false);
    setHilite(0);
    onChange({ itemId: item.id, itemName: item.name, item });
    if (focusHsn) {
      setTimeout(() => {
        const el = document.querySelector(`[data-row="${rowIdx}"][data-field="hsn"]`) as HTMLInputElement;
        if (el) el.focus();
      }, 20);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { setOpen(true); setHilite(0); }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHilite(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHilite(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (filtered.length > 0) {
        e.preventDefault();
        selectItem(filtered[hilite] ?? filtered[0], true);
      } else {
        setOpen(false);
      }
    } else if (e.key === "Tab") {
      // Tab with dropdown open → select top item and move to HSN
      if (filtered.length > 0) {
        e.preventDefault();
        selectItem(filtered[hilite] ?? filtered[0], true);
      } else {
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          data-row={rowIdx}
          data-field="itemname"
          className="border border-gray-200 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500 pr-12"
          placeholder="Type item name or search..."
          value={query}
          autoComplete="off"
          onFocus={() => { setOpen(true); setHilite(0); }}
          onKeyDown={handleKeyDown}
          onChange={e => {
            const v = e.target.value;
            setQuery(v);
            setOpen(true);
            setHilite(0);
            onChange({ itemId: undefined, itemName: v });
          }}
        />
        {isSaved && (
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">✓ Master</span>
        )}
        {isNew && query.trim() && (
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">NEW</span>
        )}
      </div>
      {open && (
        <div ref={listRef} className="absolute z-[200] top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-xl overflow-y-auto" style={{ maxHeight: "18rem" }}>
          {filtered.length === 0 && q && (
            <div className="px-3 py-2 text-xs text-gray-500 bg-amber-50">
              "<strong className="text-gray-800">{query}</strong>" — will be added to master on save
            </div>
          )}
          {filtered.map((i, fi) => (
            <button
              key={i.id} type="button"
              data-hilite={fi === hilite ? "true" : undefined}
              onMouseDown={() => selectItem(i)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 border-b border-gray-50 last:border-0 ${fi === hilite ? "bg-blue-50 text-blue-900" : "hover:bg-blue-50"}`}
            >
              <span className="truncate font-medium">{i.name}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {i.unitName || "PCS"} · ₹{Number(isSales ? i.salePrice : i.purchasePrice || i.salePrice || 0).toFixed(0)}
              </span>
            </button>
          ))}
          {isNew && q && filtered.length > 0 && (
            <div className="px-3 py-1.5 text-[10px] text-amber-700 bg-amber-50 border-t border-amber-100">
              ✦ "{query}" — new item, will be automatically added to master on save
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Business type → invoice-level and item-level custom fields config
const BIZ_FIELDS: Record<string, {
  invoiceFields: { key: string; label: string; placeholder?: string; type?: string }[];
  itemFields: { key: string; label: string; placeholder?: string; type?: string }[];
}> = {
  pharmacy: {
    invoiceFields: [
      { key: "drugLicenseNo", label: "Drug License No.", placeholder: "DL/MH/01/2023" },
    ],
    itemFields: [
      { key: "batchNo", label: "Batch No", placeholder: "B-0012" },
      { key: "expiryDate", label: "Expiry Date", type: "month" },
      { key: "mrp", label: "MRP (₹)", type: "number", placeholder: "0.00" },
      { key: "mfgBy", label: "Manufacturer", placeholder: "Cipla Ltd." },
    ],
  },
  electronics: {
    invoiceFields: [],
    itemFields: [
      { key: "serialNo", label: "Serial No", placeholder: "SN-..." },
      { key: "modelNo", label: "Model No", placeholder: "Model" },
      { key: "brand", label: "Brand", placeholder: "Samsung" },
      { key: "warranty", label: "Warranty (months)", type: "number", placeholder: "12" },
    ],
  },
  fabric: {
    invoiceFields: [],
    itemFields: [
      { key: "color", label: "Color", placeholder: "Red/Navy..." },
      { key: "design", label: "Design/Print", placeholder: "Floral/Plain" },
      { key: "widthCm", label: "Width (cm)", type: "number", placeholder: "115" },
      { key: "composition", label: "Composition", placeholder: "100% Cotton" },
    ],
  },
  restaurant: {
    invoiceFields: [
      { key: "tableNo", label: "Table No.", placeholder: "T-01" },
      { key: "coverCount", label: "Cover Count", type: "number", placeholder: "2" },
      { key: "waiter", label: "Waiter Name", placeholder: "Staff name" },
    ],
    itemFields: [],
  },
  auto_parts: {
    invoiceFields: [
      { key: "vehicleRegNo", label: "Vehicle Reg. No.", placeholder: "MH-01-AB-1234" },
      { key: "vehicleModel", label: "Vehicle Model", placeholder: "Maruti Swift 2020" },
    ],
    itemFields: [
      { key: "partNo", label: "Part No.", placeholder: "PT-001" },
      { key: "compatibility", label: "Fits Model", placeholder: "All petrol variants" },
    ],
  },
  jewellery: {
    invoiceFields: [
      { key: "hallmarkNo", label: "Hallmark Cert. No.", placeholder: "HM-..." },
    ],
    itemFields: [
      { key: "purity", label: "Purity/Karat", placeholder: "22K / 916" },
      { key: "grossWeightGm", label: "Gross Wt (gm)", type: "number", placeholder: "10.00" },
      { key: "netWeightGm", label: "Net Wt (gm)", type: "number", placeholder: "9.50" },
      { key: "makingCharges", label: "Making Charges (₹)", type: "number", placeholder: "0" },
    ],
  },
  construction: {
    invoiceFields: [
      { key: "projectName", label: "Project Name", placeholder: "Site name..." },
      { key: "workOrderNo", label: "Work Order No.", placeholder: "WO-2025-001" },
      { key: "siteName", label: "Site / Location", placeholder: "Location" },
    ],
    itemFields: [],
  },
  grocery: {
    invoiceFields: [],
    itemFields: [
      { key: "batchNo", label: "Batch No", placeholder: "B-001" },
      { key: "expiryDate", label: "Expiry Date", type: "month" },
    ],
  },
  hardware: {
    invoiceFields: [],
    itemFields: [
      { key: "brand", label: "Brand", placeholder: "Havells/Anchor..." },
      { key: "modelNo", label: "Model No.", placeholder: "Model" },
    ],
  },
  chemical: {
    invoiceFields: [
      { key: "licenseNo", label: "License No.", placeholder: "PEST/MH/..." },
    ],
    itemFields: [
      { key: "batchNo", label: "Batch No", placeholder: "B-001" },
      { key: "expiryDate", label: "Expiry Date", type: "month" },
    ],
  },
  transport: {
    invoiceFields: [
      { key: "lrNo", label: "LR / GR No.", placeholder: "LR-001" },
      { key: "vehicleNo", label: "Vehicle No.", placeholder: "MH-01-AB-1234" },
      { key: "from", label: "From", placeholder: "Mumbai" },
      { key: "to", label: "To", placeholder: "Delhi" },
    ],
    itemFields: [],
  },
};

const INDIAN_STATES = [
  { name: "Andhra Pradesh", code: "37" }, { name: "Bihar", code: "10" }, { name: "Delhi", code: "07" },
  { name: "Goa", code: "30" }, { name: "Gujarat", code: "24" }, { name: "Haryana", code: "06" },
  { name: "Karnataka", code: "29" }, { name: "Kerala", code: "32" }, { name: "Madhya Pradesh", code: "23" },
  { name: "Maharashtra", code: "27" }, { name: "Punjab", code: "03" }, { name: "Rajasthan", code: "08" },
  { name: "Tamil Nadu", code: "33" }, { name: "Telangana", code: "36" }, { name: "Uttar Pradesh", code: "09" },
  { name: "West Bengal", code: "19" }, { name: "Chhattisgarh", code: "22" }, { name: "Uttarakhand", code: "05" },
  { name: "Himachal Pradesh", code: "02" }, { name: "Jharkhand", code: "20" }, { name: "Odisha", code: "21" },
  { name: "Assam", code: "18" }, { name: "Tripura", code: "16" },
];

interface VoucherItem {
  itemId?: number;
  itemName: string;
  hsnCode: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  rateIncludesGst: boolean;
  discount: number;
  discountType: "percent" | "amount";
  taxRateId?: number;
  taxRate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  customFields?: Record<string, any>;
}

function calcItem(item: VoucherItem, isInterState: boolean): VoucherItem {
  const baseRate = item.rateIncludesGst && item.taxRate > 0
    ? item.rate / (1 + item.taxRate / 100)
    : item.rate;
  const gross = item.quantity * baseRate;
  const discount = item.discountType === "percent" ? gross * (item.discount / 100) : item.discount;
  const taxable = gross - discount;
  const cgst = isInterState ? 0 : taxable * (item.taxRate / 2 / 100);
  const sgst = isInterState ? 0 : taxable * (item.taxRate / 2 / 100);
  const igst = isInterState ? taxable * (item.taxRate / 100) : 0;
  return { ...item, taxableAmount: taxable, cgst, sgst, igst, total: taxable + cgst + sgst + igst };
}

function emptyItem(): VoucherItem {
  return { itemName: "", hsnCode: "", description: "", quantity: 1, unit: "PCS", rate: 0, rateIncludesGst: false, discount: 0, discountType: "percent", taxRate: 0, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
}

interface Props {
  voucherType: "sales/invoices" | "sales/credit-notes" | "purchases/bills" | "purchases/debit-notes";
  title: string;
  listHref: string;
  editId?: number;
  initialData?: any;
}

export default function VoucherForm({ voucherType, title, listHref, editId, initialData }: Props) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isSales = voucherType.startsWith("sales");
  const [showPrintPrompt, setShowPrintPrompt] = useState(false);
  const [savedInfo, setSavedInfo] = useState<{ id: number; number: string }>({ id: 0, number: "" });

  const [parties, setParties] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [partySearch, setPartySearch] = useState("");
  const [serialMode, setSerialMode] = useState<"auto" | "manual">(() => {
    try { return (localStorage.getItem("biz_serial_mode") as any) || "auto"; } catch { return "auto"; }
  });
  const [nextAutoNumber, setNextAutoNumber] = useState<string>("");
  const [dupWarning, setDupWarning] = useState<{ suggested: string } | null>(null);
  const [bizStateCode, setBizStateCode] = useState("");
  const [bizType, setBizType] = useState("");
  const [invoiceCustomFields, setInvoiceCustomFields] = useState<Record<string, any>>({});

  // Credit limit
  const [creditInfo, setCreditInfo] = useState<{ outstanding: number; creditLimit: number } | null>(null);
  const [creditWarning, setCreditWarning] = useState<{ outstanding: number; creditLimit: number; newBill: number } | null>(null);
  const [pendingSubmitPayload, setPendingSubmitPayload] = useState<any>(null);
  const [offlineSaved, setOfflineSaved] = useState(false);

  // Bin docs (restore from bin feature)
  const [binDocs, setBinDocs] = useState<any[]>([]);
  const [showBinModal, setShowBinModal] = useState(false);
  const [binDateAlert, setBinDateAlert] = useState<{ doc: any } | null>(null);
  const [activeBinDocId, setActiveBinDocId] = useState<number | null>(null);
  const BIN_TYPE_MAP: Record<string, string> = {
    "sales/invoices": "sales_invoice",
    "purchases/bills": "purchase_bill",
    "sales/credit-notes": "credit_note",
    "purchases/debit-notes": "debit_note",
  };
  const binVoucherType = BIN_TYPE_MAP[voucherType] || "sales_invoice";
  const [fieldSize, setFieldSizeState] = useState<FieldSize>(() => getFieldSize());
  const applyFieldSize = (s: FieldSize) => { setFieldSizeState(s); saveFieldSize(s); };

  // ── Resizable columns ──────────────────────────────────────────
  const COL_DEFAULTS: Record<string, number> = {
    item: 200, hsn: 88, qty: 70, unit: 70, rate: 160,
    discount: 88, tax: 108, taxable: 88, gst: 88, total: 92,
  };
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const s = localStorage.getItem("erp_form_col_widths");
      return s ? { ...COL_DEFAULTS, ...JSON.parse(s) } : { ...COL_DEFAULTS };
    } catch { return { ...COL_DEFAULTS }; }
  });
  const doStartResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    const sx = e.clientX;
    const sw = colWidths[col];
    const onMove = (me: MouseEvent) => {
      setColWidths(prev => ({ ...prev, [col]: Math.max(44, sw + me.clientX - sx) }));
    };
    const onUp = (me: MouseEvent) => {
      setColWidths(prev => {
        const next = { ...prev, [col]: Math.max(44, sw + me.clientX - sx) };
        localStorage.setItem("erp_form_col_widths", JSON.stringify(next));
        return next;
      });
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  const resetColWidths = () => {
    setColWidths({ ...COL_DEFAULTS });
    localStorage.removeItem("erp_form_col_widths");
  };
  // ──────────────────────────────────────────────────────────────

  // Quick add party
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ name: "", phone: "", gstin: "", address: "", state: "", stateCode: "" });
  const [savedShipAddrs, setSavedShipAddrs] = useState<string[]>([]);
  const [showShipAddrDrop, setShowShipAddrDrop] = useState(false);

  // Linked invoice (for credit-note / debit-note)
  const isReturn = voucherType === "sales/credit-notes" || voucherType === "purchases/debit-notes";
  const linkedVoucherApi = voucherType === "sales/credit-notes" ? "/sales/invoices" : "/purchases/bills";
  const [linkedVouchers, setLinkedVouchers] = useState<any[]>([]);
  const [linkedVoucherId, setLinkedVoucherId] = useState<number | null>(initialData?.linkedVoucherId || null);
  const [linkedVoucherNumber, setLinkedVoucherNumber] = useState<string>(initialData?.linkedVoucherNumber || "");
  const [linkedSearch, setLinkedSearch] = useState(initialData?.linkedVoucherNumber || "");
  const [showLinkedDrop, setShowLinkedDrop] = useState(false);
  const [loadingLinked, setLoadingLinked] = useState(false);

  const [form, setForm] = useState({
    date: fmt.today(),
    voucherNumber: "",
    partyId: "",
    partyName: "",
    billingAddress: "",
    useShippingAddress: false,
    shippingAddress: "",
    placeOfSupply: "",
    transportCharges: 0,
    transportName: "",
    roundOff: 0,
    notes: "",
    termsAndConditions: "",
    status: "posted",
  });
  const [savedTransportNames, setSavedTransportNames] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("erp_transport_names") || "[]"); } catch { return []; }
  });
  const [transportNameOpen, setTransportNameOpen] = useState(false);
  const [lineItems, setLineItems] = useState<VoucherItem[]>([emptyItem()]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set([0]));
  const [isInterState, setIsInterState] = useState(false);
  const [itemsTableH, setItemsTableH] = useState<number>(220);
  const itemsDragRef = useRef<{ startY: number; startH: number } | null>(null);
  const onItemsResizeDown = (e: React.MouseEvent) => {
    e.preventDefault();
    itemsDragRef.current = { startY: e.clientY, startH: itemsTableH };
    const onMove = (me: MouseEvent) => {
      if (!itemsDragRef.current) return;
      const newH = Math.max(80, itemsDragRef.current.startH + me.clientY - itemsDragRef.current.startY);
      setItemsTableH(newH);
    };
    const onUp = () => {
      itemsDragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const [interStateAuto, setInterStateAuto] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const partyType = isSales ? "customer" : "supplier";
    // Load from cache immediately for instant offline UI
    const cachedP = getCachedParties(partyType);
    const cachedIt = getCachedItems();
    const cachedT = getCachedTaxRates();
    const cachedU = getCachedUnits();
    if (cachedP.length) setParties(cachedP);
    if (cachedIt.length) setItems(cachedIt);
    if (cachedT.length) setTaxRates(cachedT);
    if (cachedU.length) setUnits(cachedU);

    const nextNumType = voucherType === "sales/invoices" ? "sales_invoice"
      : voucherType === "sales/credit-notes" ? "credit_note"
      : voucherType === "purchases/bills" ? "purchase_bill"
      : "debit_note";

    Promise.all([
      api.get<any>(`/parties?type=${partyType}&limit=200`),
      api.get<any>("/items?limit=200"),
      api.get<any>("/masters/tax-rates"),
      api.get<any>("/masters/units"),
      api.get<any>("/businesses/current"),
      !editId ? api.get<any>(`/vouchers/next-number?type=${nextNumType}`) : Promise.resolve(null),
    ]).then(([p, it, t, u, biz, nextNumRes]) => {
      setParties(p.data || []);
      setItems(it.data || []);
      setTaxRates(t.data || []);
      setUnits(u.data || []);
      cacheParties(partyType, p.data || []);
      cacheItems(it.data || []);
      cacheTaxRates(t.data || []);
      cacheUnits(u.data || []);
      const mode = biz.serialNumberMode === "manual" ? "manual" : "auto";
      setSerialMode(mode);
      try { localStorage.setItem("biz_serial_mode", mode); } catch {}
      if (biz.stateCode) setBizStateCode(biz.stateCode);
      if (biz.businessType) setBizType(biz.businessType);
      if (nextNumRes?.nextNumber) setNextAutoNumber(nextNumRes.nextNumber);
    }).catch(() => {
      // Offline — already loaded from cache above
    });

    // Fetch bin docs for this voucher type (only for new docs, not edit)
    if (!editId) {
      api.get<any[]>(`/bin?type=${binVoucherType}`).then(data => {
        setBinDocs(Array.isArray(data) ? data : []);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (initialData) {
      setForm(f => ({
        ...f,
        date: initialData.date || fmt.today(),
        voucherNumber: initialData.voucherNumber || "",
        partyId: String(initialData.partyId || ""),
        partyName: initialData.partyName || "",
        billingAddress: initialData.billingAddress || "",
        useShippingAddress: initialData.useShippingAddress || false,
        shippingAddress: initialData.shippingAddress || "",
        placeOfSupply: initialData.placeOfSupply || "",
        transportCharges: Number(initialData.transportCharges || 0),
        transportName: initialData.transportName || "",
        roundOff: Number(initialData.roundOff || 0),
        notes: initialData.notes || "",
        termsAndConditions: initialData.termsAndConditions || "",
        status: initialData.status || "posted",
      }));
      setPartySearch(initialData.partyName || "");
      setIsInterState(initialData.isInterState || false);
      if (initialData.items?.length) {
        const populated = initialData.items.map((i: any) => calcItem({
          itemId: i.itemId,
          itemName: i.itemName,
          hsnCode: i.hsnCode || "",
          description: i.description || "",
          quantity: parseFloat(Number(i.quantity || 0).toFixed(3)),
          unit: i.unit || "PCS",
          rate: parseFloat(Number(i.rate || 0).toFixed(2)),
          rateIncludesGst: false,
          discount: parseFloat(Number(i.discount || 0).toFixed(2)),
          discountType: i.discountType || "percent",
          taxRateId: i.taxRateId,
          taxRate: Number(i.taxRate || 0),
          taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, total: 0,
        }, initialData.isInterState || false));
        setLineItems(populated);
        setSelectedItems(new Set(populated.map((_: any, i: number) => i)));
      }
    }
  }, [initialData]);

  const selectParty = (party: any) => {
    setForm(f => ({
      ...f,
      partyId: String(party.id),
      partyName: party.name,
      billingAddress: [party.address, party.city, party.state, party.pincode].filter(Boolean).join(", "),
      placeOfSupply: party.stateCode || "",
    }));
    setPartySearch(party.name);
    setCreditInfo(null);
    // Load saved shipping addresses for this party
    const addrs = Array.isArray(party.shippingAddresses) ? party.shippingAddresses as string[] : [];
    setSavedShipAddrs(addrs);

    // Auto-detect IGST/CGST+SGST based on state
    const autoInter = !!(party.stateCode && bizStateCode && party.stateCode !== bizStateCode);
    setIsInterState(autoInter);
    setInterStateAuto(autoInter);

    // Credit limit check (sales only)
    if (isSales && Number(party.creditLimit || 0) > 0) {
      api.get<any>(`/parties/${party.id}/balance`).then(bal => {
        setCreditInfo({ outstanding: bal.outstanding, creditLimit: bal.creditLimit });
      }).catch(() => {});
    }

    // Load available invoices/bills for return type vouchers
    if (isReturn) {
      setLoadingLinked(true);
      api.get<any>(`${linkedVoucherApi}?partyId=${party.id}&limit=100`).then(r => {
        setLinkedVouchers(r.data || []);
      }).catch(() => {}).finally(() => setLoadingLinked(false));
    }
  };

  const loadLinkedVoucherItems = async (vId: number) => {
    try {
      const v = await api.get<any>(`${linkedVoucherApi}/${vId}`);
      if (v.items?.length) {
        const populated: VoucherItem[] = v.items.map((i: any) => calcItem({
          itemId: i.itemId,
          itemName: i.itemName,
          hsnCode: i.hsnCode || "",
          description: i.description || "",
          quantity: parseFloat(Number(i.quantity || 0).toFixed(3)),
          unit: i.unit || "PCS",
          rate: parseFloat(Number(i.rate || 0).toFixed(2)),
          rateIncludesGst: false,
          discount: parseFloat(Number(i.discount || 0).toFixed(2)),
          discountType: i.discountType || "percent",
          taxRateId: i.taxRateId,
          taxRate: Number(i.taxRate || 0),
          taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, total: 0,
          customFields: i.customFields,
        }, isInterState));
        setLineItems(populated);
        setSelectedItems(new Set(populated.map((_: any, i: number) => i)));
      }
    } catch { /* ignore */ }
  };

  /* ── Smart item-row setter: handles both master select AND custom name ── */
  const setItemInRow = (idx: number, sel: { itemId?: number; itemName: string; item?: any }) => {
    setLineItems(prev => {
      const next = [...prev];
      const updated = { ...next[idx] };
      if (sel.item && sel.itemId) {
        const found = sel.item;
        updated.itemId    = found.id;
        updated.itemName  = found.name;
        updated.hsnCode   = found.hsnCode || "";
        updated.rate      = Number(isSales ? found.salePrice : (found.purchasePrice || found.salePrice) || 0);
        updated.taxRateId = found.taxRateId;
        updated.unit      = found.unitName || "PCS";
        const tr = taxRates.find((t: any) => t.id === found.taxRateId);
        if (tr) updated.taxRate = Number(tr.rate);
      } else {
        updated.itemId   = undefined;
        updated.itemName = sel.itemName;
      }
      next[idx] = calcItem(updated, isInterState);
      return next;
    });
  };

  const updateItem = (idx: number, field: keyof VoucherItem, value: any) => {
    setLineItems(prev => {
      const next = [...prev];
      const updated = { ...next[idx], [field]: value };
      if (field === "itemId") {
        const found = items.find(i => i.id === Number(value));
        if (found) {
          updated.itemName = found.name;
          updated.hsnCode = found.hsnCode || "";
          updated.rate = Number(found.salePrice || found.purchasePrice || 0);
          updated.taxRateId = found.taxRateId;
          updated.unit = found.unitName || "PCS";
          const tr = taxRates.find(t => t.id === found.taxRateId);
          if (tr) updated.taxRate = Number(tr.rate);
        }
      }
      if (field === "taxRateId") {
        const id = Number(value);
        if (id === -1) {
          updated.taxRate = 0; // custom mode — user will type rate
        } else {
          const tr = taxRates.find(t => t.id === id);
          updated.taxRate = tr ? Number(tr.rate) : 0; // reset to 0 when "None" selected
        }
      }
      next[idx] = calcItem(updated, isInterState);
      return next;
    });
  };

  useEffect(() => {
    setLineItems(prev => prev.map(i => calcItem(i, isInterState)));
  }, [isInterState]);

  const addRow = (focusAfter = false) => {
    const newIdx = lineItems.length;
    setLineItems(prev => [...prev, emptyItem()]);
    setSelectedItems(prev => new Set([...prev, newIdx]));
    if (focusAfter) {
      setTimeout(() => {
        // Focus the ItemCombobox input of the newly added row
        const el = document.querySelector(`[data-row="${newIdx}"][data-field="itemname"]`) as HTMLInputElement;
        if (el) el.focus();
      }, 60);
    }
  };

  const handleNumericFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleItemEnter = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (idx === lineItems.length - 1) {
      addRow(true);
    } else {
      const nextEl = document.querySelector(`[data-row="${idx + 1}"][data-field="qty"]`) as HTMLInputElement;
      if (nextEl) nextEl.focus();
    }
  };

  const removeRow = (idx: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
    setSelectedItems(prev => {
      const next = new Set<number>();
      prev.forEach(i => { if (i < idx) next.add(i); else if (i > idx) next.add(i - 1); });
      return next;
    });
  };

  const toggleItem = (idx: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const activeItems = lineItems.filter((_, idx) => selectedItems.has(idx));
  const subTotal = activeItems.reduce((s, i) => {
    const baseRate = i.rateIncludesGst && i.taxRate > 0 ? i.rate / (1 + i.taxRate / 100) : i.rate;
    return s + i.quantity * baseRate;
  }, 0);
  const totalDiscount = activeItems.reduce((s, i) => {
    const baseRate = i.rateIncludesGst && i.taxRate > 0 ? i.rate / (1 + i.taxRate / 100) : i.rate;
    return s + (i.discountType === "percent" ? i.quantity * baseRate * i.discount / 100 : i.discount);
  }, 0);
  const taxableAmount = activeItems.reduce((s, i) => s + i.taxableAmount, 0);
  const totalCgst = activeItems.reduce((s, i) => s + i.cgst, 0);
  const totalSgst = activeItems.reduce((s, i) => s + i.sgst, 0);
  const totalIgst = activeItems.reduce((s, i) => s + i.igst, 0);
  const totalTax = totalCgst + totalSgst + totalIgst;
  const grandTotal = taxableAmount + totalTax + (form.transportCharges || 0) + (form.roundOff || 0);

  const handleBinDocSelect = (doc: any) => {
    setShowBinModal(false);
    setBinDateAlert({ doc });
  };

  const handleBinDateConfirm = async (useToday: boolean) => {
    if (!binDateAlert) return;
    const { doc } = binDateAlert;
    setBinDateAlert(null);
    setLoading(true);
    try {
      const full = await api.get<any>(`/${voucherType}/${doc.id}`);
      const date = useToday ? fmt.today() : (full.date || fmt.today());
      setForm(f => ({
        ...f, date,
        voucherNumber: full.voucherNumber || "",
        partyId: String(full.partyId || ""),
        partyName: full.partyName || "",
        billingAddress: full.billingAddress || "",
        useShippingAddress: full.useShippingAddress || false,
        shippingAddress: full.shippingAddress || "",
        placeOfSupply: full.placeOfSupply || "",
        transportCharges: Number(full.transportCharges || 0),
        transportName: full.transportName || "",
        roundOff: Number(full.roundOff || 0),
        notes: full.notes || "",
        termsAndConditions: full.termsAndConditions || "",
        status: "posted",
      }));
      setPartySearch(full.partyName || "");
      setIsInterState(full.isInterState || false);
      if (full.items?.length) {
        const populated = full.items.map((i: any) => calcItem({
          itemId: i.itemId, itemName: i.itemName,
          hsnCode: i.hsnCode || "", description: i.description || "",
          quantity: parseFloat(Number(i.quantity || 0).toFixed(3)), unit: i.unit || "PCS",
          rate: parseFloat(Number(i.rate || 0).toFixed(2)), rateIncludesGst: false,
          discount: parseFloat(Number(i.discount || 0).toFixed(2)), discountType: i.discountType || "percent",
          taxRateId: i.taxRateId, taxRate: Number(i.taxRate || 0),
          taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, total: 0,
        }, full.isInterState || false));
        setLineItems(populated);
        setSelectedItems(new Set(populated.map((_: any, i: number) => i)));
      }
      setActiveBinDocId(doc.id);
      setBinDocs(prev => prev.filter(d => d.id !== doc.id));
    } catch {
      setError("Could not load bin doc — please try again");
    } finally {
      setLoading(false);
    }
  };

  const doSave = async (payload: any) => {
    setLoading(true); setError("");
    try {
      // Auto-create items typed directly (no itemId) into the items master
      const updatedItems = [...(payload.items || [])];
      const newlyCreated: any[] = [];
      const itemSaveErrors: string[] = [];
      for (let i = 0; i < updatedItems.length; i++) {
        const it = updatedItems[i];
        if (!it.itemId && it.itemName?.trim()) {
          try {
            // Resolve unit symbol → unitId (so item is properly linked to units master)
            const matchedUnit = units.find((u: any) =>
              u.symbol?.toLowerCase() === (it.unit || "PCS").toLowerCase()
            );
            // Resolve taxRateId: prefer direct taxRateId, fallback: match taxRate % to master
            let resolvedTaxRateId = (it.taxRateId && it.taxRateId > 0) ? it.taxRateId : undefined;
            if (!resolvedTaxRateId && it.taxRate > 0) {
              const matchedTR = taxRates.find((t: any) => Math.abs(Number(t.rate) - it.taxRate) < 0.01);
              if (matchedTR) resolvedTaxRateId = matchedTR.id;
            }
            const created = await api.post<any>("/items", {
              name: it.itemName.trim(),
              type: "goods",
              hsnCode: it.hsnCode?.trim() || undefined,
              unitId: matchedUnit?.id || undefined,
              taxRateId: resolvedTaxRateId,
              salePrice: isSales ? String(it.rate) : undefined,
              purchasePrice: !isSales ? String(it.rate) : undefined,
            });
            if (created?.id) {
              updatedItems[i] = { ...it, itemId: created.id };
              newlyCreated.push({
                ...created,
                unitName: matchedUnit?.symbol || it.unit || "PCS",
                taxRate: it.taxRate || 0,
              });
            }
          } catch (itemErr: any) {
            // Non-fatal: voucher still saves; log so user can debug
            const errMsg = itemErr?.message || "Unknown error";
            itemSaveErrors.push(`"${it.itemName}" could not be saved to master: ${errMsg}`);
            console.warn("[Item auto-save failed]", it.itemName, itemErr);
          }
        }
      }
      payload.items = updatedItems;

      // Update local items state + cache so new items appear immediately in next use
      if (newlyCreated.length > 0) {
        setItems(prev => {
          const merged = [...prev, ...newlyCreated.filter(nc => !prev.find((p: any) => p.id === nc.id))];
          cacheItems(merged);
          return merged;
        });
      }

      const targetId = activeBinDocId || editId;
      let savedVoucherId: number | null = null;
      let savedVoucherNum = "";
      if (targetId) {
        const updated = await api.patch<any>(`/${voucherType}/${targetId}`, payload);
        savedVoucherId = targetId;
        savedVoucherNum = updated?.voucherNumber || "";
      } else {
        const created = await api.post<any>(`/${voucherType}`, payload);
        savedVoucherId = created?.id || null;
        savedVoucherNum = created?.voucherNumber || "";
      }
      // Auto-save transport name for future suggestions
      if (form.transportName?.trim()) {
        const tName = form.transportName.trim();
        if (!savedTransportNames.includes(tName)) {
          const updated = [...savedTransportNames, tName];
          setSavedTransportNames(updated);
          try { localStorage.setItem("erp_transport_names", JSON.stringify(updated)); } catch {}
        }
      }
      // Auto-save new ship-to address to party (for future auto-fill)
      if (form.useShippingAddress && form.shippingAddress.trim() && form.partyId) {
        const newAddr = form.shippingAddress.trim();
        if (!savedShipAddrs.includes(newAddr)) {
          const updated = [...savedShipAddrs, newAddr];
          api.patch(`/parties/${form.partyId}`, { shippingAddresses: updated }).catch(() => {});
          setSavedShipAddrs(updated);
        }
      }
      // Show print prompt instead of immediately navigating
      if (savedVoucherId) {
        setSavedInfo({ id: savedVoucherId, number: savedVoucherNum });
        setShowPrintPrompt(true);
        // Show item master save warnings (non-blocking) if any items failed to auto-save
        if (itemSaveErrors.length > 0) {
          setError(`Voucher saved, but some items could not be added to master:\n${itemSaveErrors.join("\n")}`);
        }
      } else {
        navigate(listHref);
      }
    } catch (err: any) {
      // Duplicate number error from server
      if (err instanceof ApiError && err.status === 409) {
        const suggested = err.data?.suggestedNumber || "";
        setDupWarning({ suggested });
        setError(err.message || "Voucher number already exists");
        return;
      }
      // Network/offline error → save to offline queue
      if (isOfflineError(err) && !editId) {
        const partyLabel = form.partyName || "Unknown Party";
        const typeLabel = voucherType.replace(/\//g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        saveDraft({
          label: `${typeLabel} — ${partyLabel} (Draft)`,
          endpoint: `/${voucherType}`,
          method: "POST",
          payload,
          voucherType,
        });
        setError("");
        setOfflineSaved(true);
        setTimeout(() => navigate(listHref), 2500);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPartyId = parseInt(form.partyId, 10);
    if (!parsedPartyId || isNaN(parsedPartyId)) { setError("Please select a party"); return; }
    if (activeItems.length === 0) { setError("Please add at least one item"); return; }
    setError("");

    const itemsToSend = activeItems.map(i => ({
      ...i, quantity: Number(i.quantity) || 0, rate: Number(i.rate) || 0,
      discount: Number(i.discount) || 0, taxRate: Number(i.taxRate) || 0,
      customFields: i.customFields && Object.keys(i.customFields).length > 0 ? i.customFields : undefined,
      taxRateId: (i.taxRateId && i.taxRateId > 0) ? i.taxRateId : undefined,
    }));
    // Auto-compute round off so grand total is a whole number
    const baseTotal = taxableAmount + totalTax + Number(form.transportCharges || 0);
    const frac = baseTotal - Math.floor(baseTotal);
    const autoRoundOff = parseFloat((frac < 0.5 ? -frac : (1 - frac)).toFixed(2));

    const payload: any = {
      ...form, partyId: parsedPartyId,
      items: itemsToSend,
      customFields: Object.keys(invoiceCustomFields).length > 0 ? invoiceCustomFields : undefined,
      transportCharges: Number(form.transportCharges),
      roundOff: autoRoundOff,
      linkedVoucherId: linkedVoucherId || undefined,
    };
    if (serialMode === "manual") {
      if (!form.voucherNumber.trim()) {
        setError("Voucher number is required in manual mode");
        return;
      }
      payload.voucherNumber = form.voucherNumber.trim();
    }
    setDupWarning(null);

    // Credit limit check (sales only, not on edit)
    if (isSales && !editId && creditInfo && creditInfo.creditLimit > 0) {
      const total = creditInfo.outstanding + grandTotal;
      if (total > creditInfo.creditLimit) {
        setCreditWarning({ outstanding: creditInfo.outstanding, creditLimit: creditInfo.creditLimit, newBill: grandTotal });
        setPendingSubmitPayload(payload);
        return;
      }
    }

    await doSave(payload);
  };

  const createQuickParty = async () => {
    if (!quickAddForm.name.trim()) return;
    setQuickAddSaving(true);
    try {
      const partyType = isSales ? "customer" : "supplier";
      const created = await api.post<any>("/parties", {
        name: quickAddForm.name.trim(),
        type: partyType,
        phone: quickAddForm.phone || undefined,
        gstin: quickAddForm.gstin || undefined,
        address: quickAddForm.address || undefined,
        state: quickAddForm.state || undefined,
        stateCode: quickAddForm.stateCode || undefined,
      });
      setParties(prev => [...prev, created]);
      selectParty(created);
      setShowQuickAdd(false);
      setQuickAddForm({ name: "", phone: "", gstin: "", address: "", state: "", stateCode: "" });
    } catch (err: any) {
      if (isOfflineError(err)) {
        // Save the quick party as an offline draft
        const partyType = isSales ? "customer" : "supplier";
        const tempParty = { id: -Date.now(), name: quickAddForm.name.trim(), type: partyType };
        saveDraft({
          label: `New ${partyType === "supplier" ? "Supplier" : "Customer"}: ${quickAddForm.name.trim()}`,
          endpoint: "/parties",
          method: "POST",
          tempId: tempParty.id,
          payload: {
            name: quickAddForm.name.trim(), type: partyType,
            phone: quickAddForm.phone || undefined,
            gstin: quickAddForm.gstin || undefined,
            address: quickAddForm.address || undefined,
            state: quickAddForm.state || undefined,
            stateCode: quickAddForm.stateCode || undefined,
          },
        });
        // Add party locally so user can continue the voucher
        setParties(prev => [...prev, tempParty as any]);
        selectParty(tempParty as any);
        setShowQuickAdd(false);
        setQuickAddForm({ name: "", phone: "", gstin: "", address: "", state: "", stateCode: "" });
      } else {
        setError("Could not create party: " + err.message);
      }
    } finally {
      setQuickAddSaving(false);
    }
  };

  const inputPad = fieldSize === "sm" ? "py-1" : fieldSize === "lg" ? "py-3" : "py-2";
  const inputCls = `border border-gray-300 rounded-lg px-3 ${inputPad} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full`;

  const fsCls = fieldSize === "sm"
    ? "[&_.fs-input]:py-0.5 [&_.fs-input]:text-xs [&_.fs-select]:py-0.5 [&_.fs-select]:text-xs"
    : fieldSize === "lg"
    ? "[&_.fs-input]:py-2.5 [&_.fs-select]:py-2.5"
    : "";

  return (
    <>
      {/* ── Print Prompt Modal (after save) ── */}
      {showPrintPrompt && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Saved!</h3>
            {savedInfo.number && <p className="text-sm text-gray-500 mt-1 font-mono">{savedInfo.number}</p>}
            <p className="text-gray-500 text-sm mt-3 mb-5">Would you like to print or download as PDF?</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowPrintPrompt(false); navigate(listHref); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 active:bg-gray-100"
              >
                Later
              </button>
              <button
                onClick={() => { setShowPrintPrompt(false); navigate(`/${voucherType}/${savedInfo.id}?print=1`); }}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 active:bg-blue-800"
              >
                Print / PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit limit warning modal */}
      {creditWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Credit Limit Exceeded</h3>
                  <p className="text-sm text-gray-500">This bill will exceed the customer's credit limit</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2 text-sm mb-4">
                <div className="flex justify-between"><span className="text-gray-600">Credit Limit</span><span className="font-semibold text-gray-900">{fmt.currency(creditWarning.creditLimit)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Outstanding Balance</span><span className="font-semibold text-amber-700">{fmt.currency(creditWarning.outstanding)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">This Bill</span><span className="font-semibold text-blue-700">{fmt.currency(creditWarning.newBill)}</span></div>
                <div className="border-t border-amber-200 pt-2 flex justify-between">
                  <span className="text-gray-700 font-medium">Total After Bill</span>
                  <span className="font-bold text-red-600">{fmt.currency(creditWarning.outstanding + creditWarning.newBill)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Exceeds by</span>
                  <span className="text-red-600 font-medium">{fmt.currency((creditWarning.outstanding + creditWarning.newBill) - creditWarning.creditLimit)}</span>
                </div>
              </div>
              {user?.role === "staff" ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
                  You don't have permission to override credit limits. Please contact your admin.
                </div>
              ) : (
                <p className="text-sm text-gray-600 mb-4">As an admin, you can override this limit and save the bill.</p>
              )}
              <div className="flex gap-3">
                <button onClick={() => { setCreditWarning(null); setPendingSubmitPayload(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                  Cancel
                </button>
                {user?.role !== "staff" && (
                  <button onClick={() => { setCreditWarning(null); doSave(pendingSubmitPayload); }}
                    className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium">
                    Override & Save
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Party Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">
                    New {isSales ? "Customer" : "Supplier"}
                  </h3>
                  <p className="text-sm text-gray-400 mt-0.5">
                    This will be permanently saved to {isSales ? "Customer" : "Supplier"} list
                  </p>
                </div>
                <button onClick={() => setShowQuickAdd(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Naam *</label>
                  <input
                    className={inputCls}
                    value={quickAddForm.name}
                    onChange={e => setQuickAddForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Party ka naam"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      className={inputCls}
                      value={quickAddForm.phone}
                      onChange={e => setQuickAddForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="9999999999"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                    <input
                      className={inputCls}
                      value={quickAddForm.gstin}
                      onChange={e => setQuickAddForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                      placeholder="27AAAAA0000A1Z5"
                      maxLength={15}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State (for GST)</label>
                  <select
                    className={inputCls}
                    value={quickAddForm.state}
                    onChange={e => {
                      const st = INDIAN_STATES.find(s => s.name === e.target.value);
                      setQuickAddForm(f => ({ ...f, state: e.target.value, stateCode: st?.code || "" }));
                    }}
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address (optional)</label>
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={quickAddForm.address}
                    onChange={e => setQuickAddForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Shop no., gali, shahar..."
                  />
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                  ✓ Full details can be edited later from Masters → {isSales ? "Customers" : "Suppliers"}
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button type="button" onClick={() => setShowQuickAdd(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button type="button" onClick={createQuickParty} disabled={quickAddSaving || !quickAddForm.name.trim()}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  {quickAddSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {isSales ? "Customer" : "Supplier"} Banao & Select Karo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .erp-items-table input, .erp-items-table select {
          padding-top: ${fieldSize === "sm" ? "2px" : fieldSize === "lg" ? "10px" : "6px"} !important;
          padding-bottom: ${fieldSize === "sm" ? "2px" : fieldSize === "lg" ? "10px" : "6px"} !important;
          font-size: ${fieldSize === "sm" ? "11px" : fieldSize === "lg" ? "15px" : "13px"} !important;
        }
      `}</style>
      <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault(); }} className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{editId ? "Edit" : "New"} {title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Field size toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 mr-1">
              <span className="text-xs text-gray-400 pl-1.5 pr-1">Size:</span>
              {(["sm", "md", "lg"] as FieldSize[]).map(s => (
                <button key={s} type="button" onClick={() => applyFieldSize(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${fieldSize === s ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {s === "sm" ? "Chota" : s === "md" ? "Normal" : "Bada"}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => navigate(listHref)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {editId ? "Update" : "Save"} {title}
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
        {offlineSaved && (
          <div className="bg-orange-50 border border-orange-200 text-orange-800 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
            <CloudOff className="w-4 h-4 flex-shrink-0" />
            <span>Offline — draft saved. Submit from "Offline Drafts" when you're back online.</span>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 gap-4">
          {/* Serial Number */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Voucher Number</label>
              <button type="button" onClick={() => setSerialMode(m => m === "auto" ? "manual" : "auto")}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                {serialMode === "auto" ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                {serialMode === "auto" ? "Auto" : "Manual"}
              </button>
            </div>
            {serialMode === "auto" ? (
              <input className={inputCls + " bg-gray-50 text-gray-400"}
                value={nextAutoNumber || ""}
                placeholder="Auto-generated"
                readOnly />
            ) : (
              <div>
                <input className={inputCls} value={form.voucherNumber}
                  onChange={e => { setForm(f => ({ ...f, voucherNumber: e.target.value })); setDupWarning(null); }}
                  placeholder={nextAutoNumber || "Enter number manually"} />
                {nextAutoNumber && !form.voucherNumber && (
                  <div className="text-xs text-gray-400 mt-1">Suggested: <span className="font-mono text-blue-500">{nextAutoNumber}</span>
                    <button type="button" className="ml-2 text-blue-500 underline" onClick={() => setForm(f => ({ ...f, voucherNumber: nextAutoNumber }))}>Use this</button>
                  </div>
                )}
              </div>
            )}
            {dupWarning && (
              <div className="mt-2 bg-yellow-50 border border-yellow-300 rounded-lg p-2 text-xs text-yellow-800">
                ⚠️ This number already exists!
                <button type="button" className="ml-2 text-blue-600 underline font-medium"
                  onClick={() => { setForm(f => ({ ...f, voucherNumber: dupWarning.suggested })); setDupWarning(null); }}>
                  Use suggested: {dupWarning.suggested}
                </button>
              </div>
            )}
            {/* Bin doc restore button */}
            {!editId && binDocs.length > 0 && (
              <button type="button"
                onClick={() => setShowBinModal(true)}
                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-50 border-2 border-amber-400 text-amber-800 rounded-lg text-sm font-semibold hover:bg-amber-100 transition-colors shadow-sm">
                <Archive className="w-4 h-4" />
                Bin se lo ({binDocs.length} docs available)
              </button>
            )}
            {activeBinDocId && (
              <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-300 rounded-lg text-xs text-green-800">
                <Archive className="w-3 h-3" />
                Bin doc restoring — it will appear in the main list once saved
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" className={inputCls} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          </div>

          {/* Party */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Party *</label>
            <PartySelect
              parties={parties}
              value={partySearch}
              onSelect={selectParty}
              showDetails={true}
              placeholder={`Search ${isSales ? "customer" : "supplier"}...`}
              onAddNew={name => {
                if (!navigator.onLine) { setError("Offline — please connect to the internet before creating a new party. Select an existing party or save a draft."); return; }
                setQuickAddForm(f => ({ ...f, name })); setShowQuickAdd(true);
              }}
              addNewLabel={`Add as new ${isSales ? "Customer" : "Supplier"}`}
            />
            {/* Credit limit indicator */}
            {creditInfo && creditInfo.creditLimit > 0 && (
              <div className={`mt-2 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 ${creditInfo.outstanding >= creditInfo.creditLimit ? "bg-red-50 border border-red-200 text-red-700" : creditInfo.outstanding >= creditInfo.creditLimit * 0.8 ? "bg-amber-50 border border-amber-200 text-amber-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span>Credit Limit: {fmt.currency(creditInfo.creditLimit)} · Outstanding: {fmt.currency(creditInfo.outstanding)} · Available: {fmt.currency(Math.max(0, creditInfo.creditLimit - creditInfo.outstanding))}</span>
              </div>
            )}
          </div>

          {/* Place of Supply + GST type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Place of Supply</label>
            <select className={inputCls} value={form.placeOfSupply} onChange={e => setForm(f => ({ ...f, placeOfSupply: e.target.value }))}>
              <option value="">Select State</option>
              {INDIAN_STATES.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
            </select>
            <div className="flex items-center gap-2 mt-2">
              {/* Auto-detected GST badge */}
              {interStateAuto !== null && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isInterState ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                  {isInterState ? "⚡ IGST (Inter-State)" : "✓ CGST+SGST (Intra-State)"} · Auto
                </span>
              )}
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer ml-auto">
                <input type="checkbox" checked={isInterState} onChange={e => { setIsInterState(e.target.checked); setInterStateAuto(null); }} className="rounded" />
                Override: IGST
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
            <textarea className={inputCls} rows={2} value={form.billingAddress} onChange={e => setForm(f => ({ ...f, billingAddress: e.target.value }))} />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mb-2">
              <input type="checkbox" checked={form.useShippingAddress} onChange={e => setForm(f => ({ ...f, useShippingAddress: e.target.checked }))} className="rounded" />
              Different shipping address
            </label>
            {form.useShippingAddress && (
              <div className="relative">
                {savedShipAddrs.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <span className="text-xs text-gray-500 self-center">Saved:</span>
                    {savedShipAddrs.map((addr, i) => (
                      <button key={i} type="button"
                        onClick={() => setForm(f => ({ ...f, shippingAddress: addr }))}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${form.shippingAddress === addr ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600"}`}>
                        {addr.length > 35 ? addr.slice(0, 35) + "…" : addr}
                      </button>
                    ))}
                  </div>
                )}
                <textarea className={inputCls} rows={2} value={form.shippingAddress}
                  onChange={e => setForm(f => ({ ...f, shippingAddress: e.target.value }))}
                  placeholder="Shipping address — will be saved for this customer..." />
                {form.shippingAddress.trim() && !savedShipAddrs.includes(form.shippingAddress.trim()) && (
                  <p className="text-xs text-green-600 mt-1">✓ This new address will be saved with the customer on save</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Linked Invoice Reference (Credit Note / Debit Note only) ── */}
        {isReturn && (
          <div className="bg-white rounded-xl border border-amber-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-amber-600" />
              <h3 className="font-semibold text-amber-800 text-sm">
                {voucherType === "sales/credit-notes" ? "Original Sales Invoice (Reference)" : "Original Purchase Bill (Reference)"}
              </h3>
              <span className="text-xs text-amber-600 ml-auto">(Optional but recommended)</span>
            </div>

            {!form.partyId ? (
              <p className="text-xs text-gray-400 italic">Select a party first — then you can search for the original invoice</p>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    className="border border-amber-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-400 pr-10"
                    placeholder={`Type invoice number or select from list...`}
                    value={linkedSearch}
                    onChange={e => { setLinkedSearch(e.target.value); setShowLinkedDrop(true); }}
                    onFocus={() => setShowLinkedDrop(true)}
                    onBlur={() => setTimeout(() => setShowLinkedDrop(false), 150)}
                  />
                  {loadingLinked && (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                  {showLinkedDrop && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-white border border-amber-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {linkedVouchers.filter(v =>
                        !linkedSearch || v.voucherNumber?.toLowerCase().includes(linkedSearch.toLowerCase()) || v.partyName?.toLowerCase().includes(linkedSearch.toLowerCase())
                      ).slice(0, 30).map(v => (
                        <div
                          key={v.id}
                          onMouseDown={e => {
                            e.preventDefault();
                            setLinkedVoucherId(v.id);
                            setLinkedVoucherNumber(v.voucherNumber);
                            setLinkedSearch(v.voucherNumber);
                            setShowLinkedDrop(false);
                          }}
                          className={`px-3 py-2.5 hover:bg-amber-50 cursor-pointer text-sm border-b border-gray-50 last:border-0 ${linkedVoucherId === v.id ? "bg-amber-50" : ""}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-mono font-semibold text-amber-800">{v.voucherNumber}</span>
                              <span className="text-xs text-gray-400 ml-2">{fmt.date(v.date)}</span>
                            </div>
                            <span className="text-xs font-semibold text-gray-700">{fmt.currency(v.grandTotal)}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 flex gap-2">
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${v.status === "paid" ? "bg-green-100 text-green-700" : v.status === "partial" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{v.status?.toUpperCase()}</span>
                            {v.balanceDue > 0 && <span className="text-red-500">Balance: {fmt.currency(v.balanceDue)}</span>}
                          </div>
                        </div>
                      ))}
                      {linkedVouchers.filter(v => !linkedSearch || v.voucherNumber?.toLowerCase().includes(linkedSearch.toLowerCase())).length === 0 && (
                        <div className="px-3 py-4 text-sm text-gray-400 text-center">No invoices found for this party</div>
                      )}
                    </div>
                  )}
                </div>

                {linkedVoucherId && (
                  <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                    <Link2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <div className="flex-1 text-sm">
                      <span className="text-amber-700 font-medium">Reference:</span>
                      <span className="font-mono font-bold text-amber-900 ml-2">{linkedVoucherNumber}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadLinkedVoucherItems(linkedVoucherId)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
                      title="Original invoice ke saare items copy kare (Full Return)"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Full Return (Items Load)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLinkedVoucherId(null); setLinkedVoucherNumber(""); setLinkedSearch(""); }}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <p className="text-xs text-gray-400">
                  Click "Full Return" to automatically load all items from the original invoice.
                  For partial return, adjust items manually.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Invoice-level business type custom fields */}
        {bizType && BIZ_FIELDS[bizType]?.invoiceFields?.length > 0 && (
          <div className="bg-white rounded-xl border border-blue-200 p-5">
            <h3 className="font-semibold text-blue-800 text-sm mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Extra Details
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {BIZ_FIELDS[bizType].invoiceFields.map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input
                    type={f.type || "text"}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={f.placeholder || ""}
                    value={invoiceCustomFields[f.key] || ""}
                    onChange={e => setInvoiceCustomFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Items table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden erp-items-table">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">Items</h3>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isInterState ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                {isInterState ? "IGST" : "CGST + SGST"}
              </span>
              <span className="text-xs text-gray-400 hidden sm:inline">✓ = Include in total</span>
              <span className="text-xs text-gray-300">│</span>
              <span className="text-xs text-gray-400 hidden sm:inline">↔ Drag headers to resize</span>
              <button type="button" onClick={resetColWidths} className="text-xs text-blue-500 hover:text-blue-700 underline">Reset</button>
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto" style={{ height: itemsTableH }}>
            <table className="text-sm" style={{ tableLayout: "fixed", width: `${32 + Object.values(colWidths).reduce((a, b) => a + b, 0) + 32}px`, minWidth: "100%" }}>
              <colgroup>
                <col style={{ width: 32 }} />
                <col style={{ width: colWidths.item }} />
                <col style={{ width: colWidths.hsn }} />
                <col style={{ width: colWidths.qty }} />
                <col style={{ width: colWidths.unit }} />
                <col style={{ width: colWidths.tax }} />
                <col style={{ width: colWidths.rate }} />
                <col style={{ width: colWidths.discount }} />
                <col style={{ width: colWidths.taxable }} />
                <col style={{ width: colWidths.gst }} />
                <col style={{ width: colWidths.total }} />
                <col style={{ width: 32 }} />
              </colgroup>
              <thead className="bg-gray-50 text-gray-600 text-xs select-none">
                <tr>
                  <th className="px-3 py-2.5">✓</th>
                  {([
                    { key: "item", label: "Item", align: "left" },
                    { key: "hsn", label: "HSN", align: "left" },
                    { key: "qty", label: "Qty", align: "right" },
                    { key: "unit", label: "Unit", align: "left" },
                  ] as const).map(col => (
                    <th key={col.key} className={`relative py-2.5 px-2 text-${col.align} overflow-hidden`}>
                      <span>{col.label}</span>
                      <div onMouseDown={e => doStartResize(col.key, e)}
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize flex items-center justify-end pr-0.5 hover:bg-blue-100 group"
                        title="Drag to resize">
                        <div className="w-px h-4 bg-gray-300 group-hover:bg-blue-500 rounded" />
                      </div>
                    </th>
                  ))}
                  <th className="relative py-2.5 px-2 text-center overflow-hidden">
                    <span>Tax</span>
                    <div onMouseDown={e => doStartResize("tax", e)}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize flex items-center justify-end pr-0.5 hover:bg-blue-100 group"
                      title="Drag to resize">
                      <div className="w-px h-4 bg-gray-300 group-hover:bg-blue-500 rounded" />
                    </div>
                  </th>
                  <th className="relative py-2.5 px-2 text-right overflow-hidden">
                    <div>Rate (Before GST)</div>
                    <div className="font-normal text-gray-400 text-[10px]">Rate (After GST)</div>
                    <div onMouseDown={e => doStartResize("rate", e)}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize flex items-center justify-end pr-0.5 hover:bg-blue-100 group"
                      title="Drag to resize">
                      <div className="w-px h-4 bg-gray-300 group-hover:bg-blue-500 rounded" />
                    </div>
                  </th>
                  {([
                    { key: "discount", label: "Discount", align: "right" },
                    { key: "taxable", label: "Taxable", align: "right" },
                    { key: "gst", label: isInterState ? "IGST" : "CGST+SGST", align: "right" },
                    { key: "total", label: "Total", align: "right" },
                  ] as const).map(col => (
                    <th key={col.key} className={`relative py-2.5 px-2 text-${col.align} overflow-hidden`}>
                      <span>{col.label}</span>
                      {col.key !== "total" && (
                        <div onMouseDown={e => doStartResize(col.key, e)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize flex items-center justify-end pr-0.5 hover:bg-blue-100 group"
                          title="Drag to resize">
                          <div className="w-px h-4 bg-gray-300 group-hover:bg-blue-500 rounded" />
                        </div>
                      )}
                    </th>
                  ))}
                  <th className="py-2.5 px-1"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lineItems.map((item, idx) => {
                  const selected = selectedItems.has(idx);
                  return (
                    <tr key={idx} className={`${selected ? "" : "opacity-40 bg-gray-50"}`}>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={selected} onChange={() => toggleItem(idx)} className="w-4 h-4 rounded text-blue-600" />
                      </td>
                      <td className="px-2 py-1.5">
                        <ItemCombobox
                          masterItems={items}
                          value={item.itemName}
                          itemId={item.itemId}
                          isSales={isSales}
                          onChange={sel => setItemInRow(idx, sel)}
                          rowIdx={idx}
                        />
                        {/* Item-level business type fields */}
                        {bizType && BIZ_FIELDS[bizType]?.itemFields?.length > 0 && (
                          <div className="mt-1.5 grid grid-cols-2 gap-1">
                            {BIZ_FIELDS[bizType].itemFields.map(f => (
                              <div key={f.key}>
                                <label className="block text-[10px] text-gray-400 mb-0.5">{f.label}</label>
                                <input
                                  type={f.type || "text"}
                                  className="border border-blue-100 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-400 bg-blue-50/40"
                                  placeholder={f.placeholder || ""}
                                  value={(item.customFields || {})[f.key] || ""}
                                  onChange={e => {
                                    const cf = { ...(item.customFields || {}), [f.key]: e.target.value };
                                    updateItem(idx, "customFields", cf);
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <input className="border border-gray-200 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                          data-row={idx} data-field="hsn"
                          value={item.hsnCode} onChange={e => updateItem(idx, "hsnCode", e.target.value)} placeholder="HSN" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.001"
                          className="border border-gray-200 rounded px-2 py-1.5 text-sm w-full text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                          data-row={idx} data-field="qty"
                          value={item.quantity}
                          onFocus={handleNumericFocus}
                          onKeyDown={e => handleItemEnter(e, idx)}
                          onChange={e => updateItem(idx, "quantity", Number(e.target.value))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <select className="border border-gray-200 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)}>
                          {units.map(u => <option key={u.id} value={u.symbol}>{u.symbol}</option>)}
                          <option value={item.unit}>{item.unit}</option>
                        </select>
                      </td>
                      {/* Tax column — moved before Rate */}
                      <td className="px-2 py-1.5">
                        {taxRates.length === 0 || item.taxRateId === -1 ? (
                          <div className={taxRates.length > 0 ? "flex items-center gap-1" : ""}>
                            {taxRates.length > 0 && (
                              <button type="button" title="Back to dropdown"
                                onClick={() => updateItem(idx, "taxRateId" as any, undefined)}
                                className="text-xs text-gray-400 hover:text-red-500 px-1 flex-shrink-0">✕</button>
                            )}
                            <input type="number" min="0" max="100" step="0.5" placeholder="GST %"
                              className="border border-blue-300 rounded px-2 py-1.5 text-sm w-full text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                              value={item.taxRate || ""}
                              onFocus={handleNumericFocus}
                              onChange={e => {
                                const rate = parseFloat(e.target.value) || 0;
                                setLineItems(prev => {
                                  const next = [...prev];
                                  next[idx] = calcItem({ ...next[idx], taxRate: rate }, isInterState);
                                  return next;
                                });
                              }} />
                          </div>
                        ) : (
                          <select className="border border-gray-200 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={item.taxRateId || ""}
                            onChange={e => updateItem(idx, "taxRateId" as any, e.target.value ? Number(e.target.value) : undefined)}>
                            <option value="">None</option>
                            {taxRates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            <option value="-1">Custom %…</option>
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {/* Rate Before GST */}
                        <div className="relative mb-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">B</span>
                          <input type="number" min="0" step="any"
                            className="border border-gray-200 rounded pl-5 pr-2 py-1.5 text-sm w-full text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={parseFloat(item.rate.toFixed(2))}
                            onFocus={handleNumericFocus}
                            onKeyDown={e => handleItemEnter(e, idx)}
                            onChange={e => updateItem(idx, "rate", parseFloat(e.target.value) || 0)} />
                        </div>
                        {/* Rate After GST — auto-computes from rate + taxRate */}
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-green-500 pointer-events-none">A</span>
                          <input type="number" min="0" step="any"
                            className="border border-green-200 bg-green-50 rounded pl-5 pr-2 py-1.5 text-sm w-full text-right focus:outline-none focus:ring-1 focus:ring-green-400"
                            value={item.taxRate > 0 ? parseFloat((item.rate * (1 + item.taxRate / 100)).toFixed(2)) : parseFloat(item.rate.toFixed(2))}
                            onChange={e => {
                              const afterGst = parseFloat(e.target.value) || 0;
                              // Store full precision to avoid back-rounding errors (e.g. 40→38.0952→40.00 not 38.10→40.01)
                              const beforeGst = item.taxRate > 0 ? afterGst / (1 + item.taxRate / 100) : afterGst;
                              updateItem(idx, "rate", parseFloat(beforeGst.toFixed(6)));
                            }} />
                        </div>
                        {item.taxRate > 0 && (
                          <div className="text-[10px] text-gray-400 mt-0.5 text-right">GST {item.taxRate}%</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <input type="number" min="0" step="0.01"
                            className="border border-gray-200 rounded px-2 py-1.5 text-sm w-16 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={item.discount}
                            onFocus={handleNumericFocus}
                            onKeyDown={e => handleItemEnter(e, idx)}
                            onChange={e => updateItem(idx, "discount", Number(e.target.value))} />
                          <select className="border border-gray-200 rounded px-1 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            tabIndex={-1}
                            value={item.discountType} onChange={e => updateItem(idx, "discountType", e.target.value)}>
                            <option value="percent">%</option>
                            <option value="amount">₹</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {item.discount > 0 && (() => {
                          const gross = item.quantity * item.rate;
                          const discAmt = item.discountType === "amount" ? item.discount : parseFloat((gross * item.discount / 100).toFixed(2));
                          return <div className="text-[10px] text-red-400 leading-tight">-{fmt.number(discAmt)}</div>;
                        })()}
                        <div className="text-xs text-gray-700">{fmt.number(item.taxableAmount)}</div>
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs">
                        {isInterState
                          ? <span className="text-orange-600">{fmt.number(item.igst)}</span>
                          : <span className="text-blue-600">{fmt.number(item.cgst + item.sgst)}</span>
                        }
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold text-gray-900">{fmt.number(item.total)}</td>
                      <td className="px-2 py-1.5">
                        <button type="button" onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100">
            <button type="button" onClick={() => addRow(true)} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <Plus className="w-4 h-4" /> Add Item Row
            </button>
          </div>
          {/* Vertical resize handle */}
          <div
            onMouseDown={onItemsResizeDown}
            className="h-3 cursor-row-resize select-none flex items-center justify-center border-t border-gray-100 hover:bg-blue-50 active:bg-blue-100 transition-colors group"
            title="Drag to resize items area"
          >
            <div className="w-12 h-1 rounded-full bg-gray-300 group-hover:bg-blue-400 transition-colors" />
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-5">
          {/* Left panel — notes, transport name, T&C, status+save */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea tabIndex={52} className={inputCls + " bg-white"} rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes for customer..." />
            </div>
            {/* Transport Name — autocomplete */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Transport Name</label>
              <input
                tabIndex={53}
                type="text"
                className={inputCls + " bg-white"}
                value={form.transportName}
                placeholder="e.g. SAFEXPRESS, VRL..."
                autoComplete="off"
                onFocus={() => setTransportNameOpen(true)}
                onBlur={() => setTimeout(() => setTransportNameOpen(false), 150)}
                onChange={e => setForm(f => ({ ...f, transportName: e.target.value }))}
              />
              {transportNameOpen && (
                <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {savedTransportNames
                    .filter(n => !form.transportName || n.toLowerCase().includes(form.transportName.toLowerCase()))
                    .map(name => (
                      <div key={name}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setForm(f => ({ ...f, transportName: name })); setTransportNameOpen(false); }}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-800">
                        {name}
                      </div>
                    ))}
                  {savedTransportNames.filter(n => !form.transportName || n.toLowerCase().includes(form.transportName.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-400">Type to add — will appear in list after save</div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
              <textarea tabIndex={54} className={inputCls + " bg-white"} rows={2} value={form.termsAndConditions} onChange={e => setForm(f => ({ ...f, termsAndConditions: e.target.value }))} />
            </div>
            {/* Status + Save side by side */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select tabIndex={55} className={inputCls + " bg-white"} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="draft">Draft</option>
                  <option value="posted">Posted</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <button tabIndex={56} type="submit" disabled={loading}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 whitespace-nowrap">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {editId ? "Update" : "Save"} {title}
              </button>
            </div>
          </div>

          {/* Right panel — summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm space-y-2">
            {totalDiscount > 0 && (
              <div className="flex justify-between text-red-500 text-xs"><span>Discount</span><span>-{fmt.currency(totalDiscount)}</span></div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Taxable Amount</span>
              <span className="font-medium">{fmt.currency(taxableAmount)}</span>
            </div>
            {!isInterState && totalCgst > 0 && (
              <>
                <div className="flex justify-between text-blue-600 text-xs"><span>CGST</span><span>{fmt.currency(totalCgst)}</span></div>
                <div className="flex justify-between text-blue-600 text-xs"><span>SGST</span><span>{fmt.currency(totalSgst)}</span></div>
              </>
            )}
            {isInterState && totalIgst > 0 && (
              <div className="flex justify-between text-orange-600 text-xs"><span>IGST</span><span>{fmt.currency(totalIgst)}</span></div>
            )}
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600">Round Off</span>
                <button type="button" tabIndex={-1}
                  onClick={() => {
                    const baseTotal = taxableAmount + totalTax;
                    const frac = baseTotal - Math.floor(baseTotal);
                    const ro = frac < 0.5 ? -frac : (1 - frac);
                    setForm(f => ({ ...f, roundOff: parseFloat(ro.toFixed(2)) }));
                  }}
                  className="text-[10px] px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded font-medium border border-blue-200">
                  Auto
                </button>
              </div>
              <input type="number" step="any" tabIndex={-1}
                className="w-24 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.roundOff} onFocus={handleNumericFocus}
                onChange={e => setForm(f => ({ ...f, roundOff: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Transport</span>
              <input type="number" step="0.01" tabIndex={51}
                className="w-24 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.transportCharges} onFocus={handleNumericFocus}
                onChange={e => setForm(f => ({ ...f, transportCharges: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="flex justify-between font-bold text-base border-t-2 border-gray-300 pt-2 mt-1">
              <span>Grand Total</span>
              <span className="text-blue-700">{fmt.currency(taxableAmount + totalTax + (form.roundOff || 0) + (form.transportCharges || 0))}</span>
            </div>
          </div>
        </div>
      </form>

      {/* ── Bin Docs Modal ── */}
      {showBinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-amber-600" />
                <h2 className="text-base font-bold text-gray-900">Bin se Doc Select Karo</h2>
              </div>
              <button type="button" onClick={() => setShowBinModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="px-5 pt-3 text-xs text-gray-500">These docs are in the bin — select, edit and save to restore them automatically.</p>
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {binDocs.map(doc => (
                <button key={doc.id} type="button"
                  onClick={() => handleBinDocSelect(doc)}
                  className="w-full text-left px-4 py-3 border border-gray-200 rounded-xl hover:border-amber-400 hover:bg-amber-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-gray-900">{doc.voucherNumber}</span>
                    <span className="text-sm font-semibold text-gray-700">{fmt.currency(doc.grandTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">{doc.partyName || "—"}</span>
                    <span className="text-xs text-gray-400">{doc.date}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Bin Date Alert ── */}
      {binDateAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <CalendarClock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Date Notice</h3>
                <p className="text-xs text-gray-500">{binDateAlert.doc.voucherNumber}</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-1">
              Original date of this doc: <span className="font-semibold text-gray-900">{binDateAlert.doc.date}</span>
            </p>
            <p className="text-sm text-gray-700 mb-5">
              Fill today's date?
            </p>
            <div className="flex gap-3">
              <button type="button"
                onClick={() => handleBinDateConfirm(true)}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors">
                Yes, Today's Date
              </button>
              <button type="button"
                onClick={() => handleBinDateConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors">
                Nahi, Purani Date
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
