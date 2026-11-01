"use client";
import { usePeaks } from "./use-peaks";
import { clock, formatSize } from "@/media/recipe";
import type { FileFacts } from "@/lib/registry";
import { cn } from "@/lib/utils";

export function detailLine(f: FileFacts): string | null {
  if (f.engine === "video") {
    if (!f.width || !f.height) return null;
    return `${Math.min(f.width, f.height)}p`;
  }
  const ch =
    f.channels === 1
      ? "mono"
      : f.channels === 2
        ? "stereo"
        : f.channels
          ? `${f.channels} ch`
          : null;
  const rate = f.sampleRate ? `${+(f.sampleRate / 1000).toFixed(1)} kHz` : null;
  return [ch, rate].filter(Boolean).join(" · ") || null;
}

export function factChips(f: FileFacts): string[] {
  return [
    f.ext.toUpperCase() || "?",
    f.duration != null ? clock(f.duration) : "…",
    formatSize(f.size),
    detailLine(f),
  ].filter((x): x is string => !!x);
}

export function FileChips({
  items,
  tone,
  label = "File details",
}: {
  items: string[];
  tone: "card" | "mat" | "mat-accent";
  label?: string;
}) {
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {items.map((t, i) => (
        <li
          key={i}
          className={cn(
            "rounded-full px-2.5 py-[5px] text-[13px] font-extrabold",
            tone === "card"
              ? i === 0
                ? "bg-ink text-bg"
                : "bg-surface"
              : tone === "mat-accent" && i === 0
                ? "bg-accent text-on-accent"
                : "bg-mat-chip",
          )}
        >
          {t}
        </li>
      ))}
    </ul>
  );
}

export function MiniWave({
  blob,
  bars = 40,
  progress = 0,
  height = 36,
  tone = "split",
}: {
  blob: Blob | null;
  bars?: number;
  progress?: number;
  height?: number;
  tone?: "split" | "solid";
}) {
  const peaks = usePeaks(blob, bars);
  return (
    <div
      aria-hidden="true"
      className="flex flex-1 items-center gap-0.5"
      style={{ height }}
    >
      {Array.from({ length: bars }, (_, i) => {
        const p = peaks ? peaks[i] : 0.12;
        const on = tone === "solid" || i / bars < progress;
        return (
          <span
            key={i}
            className="flex-1 rounded-sm"
            style={{
              height: Math.max(4, Math.round(p * height)),
              background: on ? "var(--primary)" : "var(--wave-off)",
            }}
          />
        );
      })}
    </div>
  );
}
