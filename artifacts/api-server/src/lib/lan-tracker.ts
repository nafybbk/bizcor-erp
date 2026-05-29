const _recentIPs = new Map<string, number>();
const WINDOW_MS = 5 * 60 * 1000;

export function trackIP(ip: string): void {
  if (!ip || ip === "::1" || ip === "127.0.0.1") return;
  _recentIPs.set(ip, Date.now());
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of _recentIPs) if (v < cutoff) _recentIPs.delete(k);
}

export function getActiveClients(): { ip: string; lastSeenMinutesAgo: number }[] {
  const cutoff = Date.now() - WINDOW_MS;
  return Array.from(_recentIPs.entries())
    .filter(([, t]) => t >= cutoff)
    .sort((a, b) => b[1] - a[1])
    .map(([ip, lastSeen]) => ({ ip, lastSeenMinutesAgo: Math.floor((Date.now() - lastSeen) / 60000) }));
}

export function canConnectLan(ip: string, maxClients: number): boolean {
  if (!ip || ip === "::1" || ip === "127.0.0.1") return true;
  if (_recentIPs.has(ip)) return true;
  return getActiveClients().length < maxClients;
}

export function parseLanLimit(features: string[]): number {
  const f = (features || []).find(x => x.startsWith("LAN:"));
  return f ? (parseInt(f.match(/(\d+)/)?.[1] || "0") || 0) : 0;
}
