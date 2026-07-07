import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

interface CacheEntry<T> {
  data: T;
  ts: number;
}

export function useTabCache<T>(key: string) {
  const [entry, setEntry] = useState<CacheEntry<T> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(`bizcor_tab_${key}`)
      .then((raw) => { if (raw) setEntry(JSON.parse(raw)); })
      .catch(() => {});
  }, [key]);

  const saveCache = useCallback(
    (data: T) => {
      const newEntry: CacheEntry<T> = { data, ts: Date.now() };
      setEntry(newEntry);
      AsyncStorage.setItem(`bizcor_tab_${key}`, JSON.stringify(newEntry)).catch(() => {});
    },
    [key],
  );

  return { cachedData: entry?.data ?? null, lastUpdated: entry?.ts ?? null, saveCache };
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
