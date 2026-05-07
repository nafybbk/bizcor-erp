export function formatPrintNumber(voucherNumber: string, biz: any): string {
  const showPrefix = biz?.printShowPrefix !== false;
  const showSeries = biz?.printShowSeries !== false;
  const showZeros  = biz?.printShowZeros  !== false;

  if (showPrefix && showSeries && showZeros) return voucherNumber;

  const sep = biz?.numberSeparator || "-";
  const parts = voucherNumber.split(sep);
  let remaining = [...parts];

  if (!showPrefix && remaining.length > 0 && isNaN(Number(remaining[0]))) {
    remaining = remaining.slice(1);
  }

  if (!showSeries && remaining.length > 1 && /^\d$/.test(remaining[0])) {
    remaining = remaining.slice(1);
  }

  if (!showZeros && remaining.length > 0) {
    remaining[remaining.length - 1] = String(parseInt(remaining[remaining.length - 1], 10) || 0);
  }

  return remaining.join(sep);
}
