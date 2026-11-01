export function clampRatio(ratio: unknown): number | null {
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) return null;
  if (ratio < 0) return 0;
  if (ratio > 1) return 1;
  return ratio;
}

export function progressLabel(ratio: number | null): string {
  return ratio === null ? "Encoding…" : `Encoding ${Math.round(ratio * 100)}%`;
}
