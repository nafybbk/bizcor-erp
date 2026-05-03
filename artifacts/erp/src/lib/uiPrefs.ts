export type FieldSize = "sm" | "md" | "lg";

const FIELD_SIZE_KEY = "erp_field_size";
const REPORT_COLS_PREFIX = "erp_report_cols_";

export function getFieldSize(): FieldSize {
  return (localStorage.getItem(FIELD_SIZE_KEY) as FieldSize) || "md";
}

export function saveFieldSize(size: FieldSize): void {
  localStorage.setItem(FIELD_SIZE_KEY, size);
}

export function getVisibleCols(reportKey: string, allCols: string[]): string[] {
  const stored = localStorage.getItem(REPORT_COLS_PREFIX + reportKey);
  if (!stored) return allCols;
  try {
    const parsed: string[] = JSON.parse(stored);
    const valid = parsed.filter(c => allCols.includes(c));
    return valid.length > 0 ? valid : allCols;
  } catch {
    return allCols;
  }
}

export function saveVisibleCols(reportKey: string, cols: string[]): void {
  localStorage.setItem(REPORT_COLS_PREFIX + reportKey, JSON.stringify(cols));
}
