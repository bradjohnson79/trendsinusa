import 'server-only';

export function applyMinThreshold<T extends { clicks?: number; impressions?: number }>(
  rows: T[],
  params: { minClicks: number; minImpressions: number },
): T[] {
  return rows.filter((r) => (r.clicks ?? 0) >= params.minClicks && (r.impressions ?? 0) >= params.minImpressions);
}

export function clampTopN<T>(rows: T[], n: number): T[] {
  return rows.slice(0, Math.max(0, n));
}

