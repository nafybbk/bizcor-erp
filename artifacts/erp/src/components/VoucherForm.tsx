import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { api, fmt, isOfflineError, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { saveDraft } from "@/lib/offlineQueue";
import { cacheParties, getCachedParties, cacheItems, getCachedItems, cacheUnits, getCachedUnits, cacheTaxRates, getCachedTaxRates } from "@/lib/masterCache";
import { getFieldSize, saveFieldSize, type FieldSize } from "@/lib/uiPrefs";
import { Plus, Trash2, Loader2, ToggleLeft, ToggleRight, AlertTriangle, X, CloudOff, Link2, RefreshCw } from "lucide-react";
import PartySelect from "@/components/PartySelect";

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
    roundOff: 0,
    notes: "",
    termsAndConditions: "",
    status: "posted",
  });
  const [lineItems, setLineItems] = useState<VoucherItem[]>([emptyItem()]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set([0]));
  const [isInterState, setIsInterState] = useState(false);
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
        roundOff: Number(initialData.roundOff || 0),
        notes: initialData.notes || "",
        termsAndConditions: initialData.termsAndConditions || "",
        status: initialData.status || "posted",
      }));
      setPartySearch(initialData.partyName || "");
      setIsInterState(initialData.isInterState || false);
      if (initialData.items?.length) {
        const populated = initialData.items.map((i: any) => ({
          itemId: i.itemId,
          itemName: i.itemName,
          hsnCode: i.hsnCode || "",
          description: i.description || "",
          quantity: Number(i.quantity),
          unit: i.unit || "PCS",
          rate: Number(i.rate),
          rateIncludesGst: false,
          discount: Number(i.discount || 0),
          discountType: i.discountType || "percent",
          taxRateId: i.taxRateId,
          taxRate: Number(i.taxRate || 0),
          taxableAmount: Number(i.taxableAmount || 0),
          cgst: Number(i.cgst || 0),
          sgst: Number(i.sgst || 0),
          igst: Number(i.igst || 0),
          total: Number(i.total || 0),
        }));
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
        const populated: VoucherItem[] = v.items.map((i: any) => ({
          itemId: i.itemId,
          itemName: i.itemName,
          hsnCode: i.hsnCode || "",
          description: i.description || "",
          quantity: Number(i.quantity),
          unit: i.unit || "PCS",
          rate: Number(i.rate),
          rateIncludesGst: false,
          discount: Number(i.discount || 0),
          discountType: i.discountType || "percent",
          taxRateId: i.taxRateId,
          taxRate: Number(i.taxRate || 0),
          taxableAmount: Number(i.taxableAmount || 0),
          cgst: Number(i.cgst || 0),
          sgst: Number(i.sgst || 0),
          igst: Number(i.igst || 0),
          total: Number(i.total || 0),
          customFields: i.customFields,
        }));
        setLineItems(populated);
        setSelectedItems(new Set(populated.map((_: any, i: number) => i)));
      }
    } catch { /* ignore */ }
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
        const el = document.querySelector(`[data-row="${newIdx}"][data-field="qty"]`) as HTMLInputElement;
        if (el) el.focus();
      }, 50);
    }
  };

  const handleNumericFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (Number(e.target.value) === 0) {
      e.target.value = "";
    } else {
      e.target.select();
    }
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

  const doSave = async (payload: any) => {
    setLoading(true); setError("");
    try {
      if (editId) await api.patch(`/${voucherType}/${editId}`, payload);
      else await api.post(`/${voucherType}`, payload);
      // Auto-save new ship-to address to party (for future auto-fill)
      if (form.useShippingAddress && form.shippingAddress.trim() && form.partyId) {
        const newAddr = form.shippingAddress.trim();
        if (!savedShipAddrs.includes(newAddr)) {
          const updated = [...savedShipAddrs, newAddr];
          api.patch(`/parties/${form.partyId}`, { shippingAddresses: updated }).catch(() => {});
          setSavedShipAddrs(updated);
        }
      }
      navigate(listHref);
    } catch (err: any) {
      // Duplicate number error from server
      if (err instanceof ApiError && err.status === 409) {
        const suggested = err.data?.suggestedNumber || "";
        setDupWarning({ suggested });
        setError(err.message || "Voucher number duplicate hai");
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
    const payload: any = {
      ...form, partyId: parsedPartyId,
      items: itemsToSend,
      customFields: Object.keys(invoiceCustomFields).length > 0 ? invoiceCustomFields : undefined,
      transportCharges: Number(form.transportCharges),
      roundOff: Number(form.roundOff),
      linkedVoucherId: linkedVoucherId || undefined,
    };
    if (serialMode === "manual") {
      if (!form.voucherNumber.trim()) {
        setError("Manual mode mein voucher number daalna zaroori hai");
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
        setError("Party create nahi ho saka: " + err.message);
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
                    Naya {isSales ? "Customer" : "Supplier"} Banao
                  </h3>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Ye {isSales ? "Customer" : "Supplier"} list mein permanent save ho jayega
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">State (GST ke liye)</label>
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
                  ✓ Baad mein Masters → {isSales ? "Customers" : "Suppliers"} se poori details edit kar sakte hain
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
            <span>Offline hai — draft save ho gaya. Internet aane par "Offline Drafts" se submit karo.</span>
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
                ⚠️ Yeh number pehle se exist karta hai!
                <button type="button" className="ml-2 text-blue-600 underline font-medium"
                  onClick={() => { setForm(f => ({ ...f, voucherNumber: dupWarning.suggested })); setDupWarning(null); }}>
                  Use suggested: {dupWarning.suggested}
                </button>
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
                if (!navigator.onLine) { setError("Offline hai — pehle internet se connect ho, phir naya party banao. Existing party select karo ya draft save karo."); return; }
                setQuickAddForm(f => ({ ...f, name })); setShowQuickAdd(true);
              }}
              addNewLabel={`ko naya ${isSales ? "Customer" : "Supplier"} banao`}
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
                  placeholder="Shipping address likhein — save hone par is customer ke liye save ho jayega..." />
                {form.shippingAddress.trim() && !savedShipAddrs.includes(form.shippingAddress.trim()) && (
                  <p className="text-xs text-green-600 mt-1">✓ Yeh naya address save hone par is customer ke saath save ho jayega</p>
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
              <span className="text-xs text-amber-600 ml-auto">(Optional lekin recommended)</span>
            </div>

            {!form.partyId ? (
              <p className="text-xs text-gray-400 italic">Pehle party select karein — phir original invoice dhundh sakte hain</p>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    className="border border-amber-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-400 pr-10"
                    placeholder={`Invoice number type karein ya list mein se chunein...`}
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
                        <div className="px-3 py-4 text-sm text-gray-400 text-center">Koi invoice nahi mila is party ke liye</div>
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
                  "Full Return" button dabaane se original invoice ke saare items automatically load ho jayenge.
                  Partial return ke liye items manually adjust karein.
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
          <div className="overflow-x-auto">
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
                        <select className="border border-gray-200 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500 mb-1"
                          value={item.itemId || ""}
                          onChange={e => updateItem(idx, "itemId" as any, e.target.value)}>
                          <option value="">-- Select Item --</option>
                          {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                        <input className="border border-gray-200 rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Or type item name" value={item.itemName}
                          onChange={e => updateItem(idx, "itemName", e.target.value)} />
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
                            value={item.rate}
                            onFocus={handleNumericFocus}
                            onKeyDown={e => handleItemEnter(e, idx)}
                            onChange={e => updateItem(idx, "rate", parseFloat(e.target.value) || 0)} />
                        </div>
                        {/* Rate After GST — auto-computes from rate + taxRate */}
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-green-500 pointer-events-none">A</span>
                          <input type="number" min="0" step="any"
                            className="border border-green-200 bg-green-50 rounded pl-5 pr-2 py-1.5 text-sm w-full text-right focus:outline-none focus:ring-1 focus:ring-green-400"
                            value={item.taxRate > 0 ? parseFloat(((item.rate) * (1 + item.taxRate / 100)).toFixed(2)) : item.rate}
                            onChange={e => {
                              const afterGst = parseFloat(e.target.value) || 0;
                              const beforeGst = item.taxRate > 0 ? afterGst / (1 + item.taxRate / 100) : afterGst;
                              updateItem(idx, "rate", parseFloat(beforeGst.toFixed(2)));
                            }} />
                        </div>
                        {item.taxRate > 0 && (
                          <div className="text-[10px] text-gray-400 mt-0.5 text-right">GST {item.taxRate}%</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <input type="number" min="0" step="0.01" className="border border-gray-200 rounded px-2 py-1.5 text-sm w-16 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={item.discount}
                            onFocus={handleNumericFocus}
                            onKeyDown={e => handleItemEnter(e, idx)}
                            onChange={e => updateItem(idx, "discount", Number(e.target.value))} />
                          <select className="border border-gray-200 rounded px-1 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={item.discountType} onChange={e => updateItem(idx, "discountType", e.target.value)}>
                            <option value="percent">%</option>
                            <option value="amount">₹</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs text-gray-600">{fmt.number(item.taxableAmount)}</td>
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
            <button type="button" onClick={() => addRow()} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <Plus className="w-4 h-4" /> Add Item Row
            </button>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea className={inputCls + " bg-white"} rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes for customer..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
              <textarea className={inputCls + " bg-white"} rows={2} value={form.termsAndConditions} onChange={e => setForm(f => ({ ...f, termsAndConditions: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className={inputCls + " bg-white"} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="posted">Posted</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Sub Total</span><span className="font-medium">{fmt.currency(subTotal)}</span></div>
            {totalDiscount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{fmt.currency(totalDiscount)}</span></div>}
            <div className="flex justify-between"><span className="text-gray-600">Taxable Amount</span><span>{fmt.currency(taxableAmount)}</span></div>
            {!isInterState && totalCgst > 0 && (
              <>
                <div className="flex justify-between text-blue-600"><span>CGST</span><span>{fmt.currency(totalCgst)}</span></div>
                <div className="flex justify-between text-blue-600"><span>SGST</span><span>{fmt.currency(totalSgst)}</span></div>
              </>
            )}
            {isInterState && totalIgst > 0 && <div className="flex justify-between text-orange-600"><span>IGST</span><span>{fmt.currency(totalIgst)}</span></div>}
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Transport Charges</span>
              <input type="number" step="0.01" className="w-28 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.transportCharges} onChange={e => setForm(f => ({ ...f, transportCharges: Number(e.target.value) }))} />
            </div>
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600">Round Off</span>
                <button
                  type="button"
                  onClick={() => {
                    const baseTotal = taxableAmount + totalTax + (form.transportCharges || 0);
                    const frac = baseTotal - Math.floor(baseTotal);
                    const ro = frac < 0.5 ? -frac : (1 - frac);
                    setForm(f => ({ ...f, roundOff: parseFloat(ro.toFixed(2)) }));
                  }}
                  className="text-[10px] px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded font-medium border border-blue-200 transition-colors"
                  title="Auto-calculate round off"
                >Auto</button>
              </div>
              <input type="number" step="any" className="w-28 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.roundOff} onChange={e => setForm(f => ({ ...f, roundOff: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-base">
              <span>Grand Total</span>
              <span className="text-blue-700">{fmt.currency(Math.round(grandTotal))}</span>
            </div>
            {/* GST breakdown */}
            <div className={`text-xs text-center py-1 rounded-full font-medium ${isInterState ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"}`}>
              {isInterState ? `IGST: ${fmt.currency(totalIgst)}` : `CGST: ${fmt.currency(totalCgst)}  +  SGST: ${fmt.currency(totalSgst)}`}
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
