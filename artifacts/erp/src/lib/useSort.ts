import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

function getValue(obj: any, key: string): any {
  return key.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

/**
 * Generic client-side sort hook for list/table pages.
 * Click a column to sort by it; click again to flip direction.
 */
export function useSort<T extends Record<string, any>>(data: T[], defaultKey: string | null = null, defaultDir: SortDir = "asc") {
  const [sortKey, setSortKey] = useState<string | null>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const copy = [...data];
    copy.sort((a, b) => {
      let av = getValue(a, sortKey);
      let bv = getValue(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return sortDir === "asc" ? -1 : 1;
      if (bv == null) return sortDir === "asc" ? 1 : -1;

      const an = typeof av === "number" ? av : Number(av);
      const bn = typeof bv === "number" ? bv : Number(bv);
      const bothNumeric = av !== "" && bv !== "" && !isNaN(an) && !isNaN(bn);
      if (bothNumeric) {
        return sortDir === "asc" ? an - bn : bn - an;
      }
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggleSort };
}
