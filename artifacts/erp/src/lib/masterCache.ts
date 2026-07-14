const KEYS = {
  parties_customer: "erp_cache_parties_customer",
  parties_supplier: "erp_cache_parties_supplier",
  parties_all: "erp_cache_parties_all",
  items: "erp_cache_items",
  units: "erp_cache_units",
  taxRates: "erp_cache_taxrates",
  hsn: "erp_cache_hsn",
};

function save(key: string, data: any[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, at: Date.now() }));
  } catch {}
}

function load(key: string): any[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw).data || [];
  } catch { return []; }
}

export function cacheParties(type: "customer" | "supplier" | "all", data: any[]) {
  save(type === "all" ? KEYS.parties_all : KEYS[`parties_${type}`], data);
}
export function getCachedParties(type: "customer" | "supplier" | "all"): any[] {
  return load(type === "all" ? KEYS.parties_all : KEYS[`parties_${type}`]);
}

export function cacheItems(data: any[]) { save(KEYS.items, data); }
export function getCachedItems(): any[] { return load(KEYS.items); }

export function cacheUnits(data: any[]) { save(KEYS.units, data); }
export function getCachedUnits(): any[] { return load(KEYS.units); }

export function cacheTaxRates(data: any[]) { save(KEYS.taxRates, data); }
export function getCachedTaxRates(): any[] { return load(KEYS.taxRates); }

export function cacheHsn(data: any[]) { save(KEYS.hsn, data); }
export function getCachedHsn(): any[] { return load(KEYS.hsn); }

export function getCacheInfo(): { parties: number; items: number; units: number; taxRates: number; lastUpdated: string | null } {
  try {
    const raw = localStorage.getItem(KEYS.items);
    const at = raw ? JSON.parse(raw).at : null;
    return {
      parties: (load(KEYS.parties_customer).length + load(KEYS.parties_supplier).length),
      items: load(KEYS.items).length,
      units: load(KEYS.units).length,
      taxRates: load(KEYS.taxRates).length,
      lastUpdated: at ? new Date(at).toLocaleString("en-IN") : null,
    };
  } catch { return { parties: 0, items: 0, units: 0, taxRates: 0, lastUpdated: null }; }
}

export function clearMasterCache() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}
