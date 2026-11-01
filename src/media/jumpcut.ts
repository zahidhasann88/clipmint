import { activity, type Envelope } from "./highlights";
import type { Range } from "./recipe";

const QUIET = 0.15;
const MIN_KEEP = 0.15;

export function keepSpans(
  env: Envelope,
  range: Range,
  mode: "ends" | "pauses",
  minPause = 0.6,
  pad = 0.15,
): Range[] {
  const act = activity(env);
  const from = Math.max(0, Math.floor(range.start * env.rate)),
    to = Math.min(act.length, Math.ceil(range.end * env.rate));
  if (to - from < 2) return [range];
  const runs: Range[] = [];
  let at: number | null = null;
  for (let i = from; i <= to; i++) {
    const quiet = i < to && act[i] < QUIET;
    if (quiet && at == null) at = i;
    else if (!quiet && at != null) {
      runs.push({
        start: Math.max(range.start, at / env.rate),
        end: Math.min(range.end, i / env.rate),
      });
      at = null;
    }
  }
  const touchesStart = (r: Range) => r.start <= range.start + 1 / env.rate;
  const touchesEnd = (r: Range) => r.end >= range.end - 1 / env.rate;
  const cuts: Range[] = [];
  for (const r of runs) {
    const edgeStart = touchesStart(r),
      edgeEnd = touchesEnd(r);
    if (edgeStart && edgeEnd) return [range];
    if (edgeStart) {
      if (r.end - r.start > pad)
        cuts.push({ start: range.start, end: r.end - pad });
      continue;
    }
    if (edgeEnd) {
      if (r.end - r.start > pad)
        cuts.push({ start: r.start + pad, end: range.end });
      continue;
    }
    if (mode === "pauses" && r.end - r.start >= minPause)
      cuts.push({ start: r.start + pad, end: r.end - pad });
  }
  const keep: Range[] = [];
  let t = range.start;
  for (const c of cuts) {
    if (c.start - t >= MIN_KEEP)
      keep.push({ start: round(t), end: round(c.start) });
    t = Math.max(t, c.end);
  }
  if (range.end - t >= MIN_KEEP)
    keep.push({ start: round(t), end: round(range.end) });
  return keep.length ? keep : [range];
}

const round = (s: number) => Math.round(s * 1000) / 1000;

export const keptSeconds = (spans: Range[]) =>
  spans.reduce((n, s) => n + s.end - s.start, 0);
