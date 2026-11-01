export interface Envelope {
  rate: number;
  db: Float32Array;
}
export interface Pick {
  start: number;
  end: number;
  score: number;
}

const SILENT = 0.15;
const STEP = 0.5;
const SNAP = 1;
const WEAK = 0.4;

function percentile(values: Float32Array, p: number): number {
  const s = Float32Array.from(values).sort();
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
}

export function activity(env: Envelope): Float32Array {
  const floor = percentile(env.db, 0.1);
  const peak = Math.max(floor + 6, percentile(env.db, 0.95));
  return env.db.map((d) =>
    Math.min(1, Math.max(0, (d - floor) / (peak - floor))),
  );
}

function quietNear(env: Envelope, t: number, lo: number, hi: number): number {
  const from = Math.max(0, Math.round(Math.max(lo, t - SNAP) * env.rate));
  const to = Math.min(
    env.db.length - 1,
    Math.round(Math.min(hi, t + SNAP) * env.rate),
  );
  let best = Math.round(t * env.rate),
    quiet = Infinity;
  for (let i = from; i <= to; i++) {
    const d = env.db[i] + Math.abs(i / env.rate - t) * 0.5;
    if (d < quiet) {
      quiet = d;
      best = i;
    }
  }
  return Math.min(hi, Math.max(lo, best / env.rate));
}

export function goodBits(env: Envelope, length: number, count = 3): Pick[] {
  const n = env.db.length;
  const duration = n / env.rate;
  const w = Math.round(length * env.rate);
  if (n === 0 || w <= 0 || w >= n) return [];
  const act = activity(env);
  const sumA = new Float64Array(n + 1),
    sumQ = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    sumA[i + 1] = sumA[i] + act[i];
    sumQ[i + 1] = sumQ[i] + (act[i] < SILENT ? 1 : 0);
  }
  const stepFrames = Math.max(1, Math.round(STEP * env.rate));
  const scored: { at: number; score: number }[] = [];
  for (let at = 0; at + w <= n; at += stepFrames) {
    const mean = (sumA[at + w] - sumA[at]) / w;
    const quiet = (sumQ[at + w] - sumQ[at]) / w;
    scored.push({ at, score: mean - 0.3 * quiet });
  }
  if (n - w > 0 && (n - w) % stepFrames) {
    const at = n - w;
    scored.push({
      at,
      score: (sumA[n] - sumA[at]) / w - 0.3 * ((sumQ[n] - sumQ[at]) / w),
    });
  }
  scored.sort((a, b) => b.score - a.score || a.at - b.at);

  const picks: Pick[] = [];
  for (const c of scored) {
    if (picks.length >= count) break;
    if (picks.length && c.score < picks[0].score * WEAK) break;
    const s = c.at / env.rate,
      e = (c.at + w) / env.rate;
    if (picks.some((p) => s < p.end && e > p.start)) continue;
    const start = quietNear(env, s, 0, duration);
    const end = quietNear(env, e, start + length * 0.75, duration);
    if (picks.some((p) => start < p.end && end > p.start)) continue;
    picks.push({
      start: Math.round(start * 10) / 10,
      end: Math.round(end * 10) / 10,
      score: c.score,
    });
  }
  return picks;
}

export function lengthsFor(duration: number | null): number[] {
  if (!duration) return [];
  return [15, 30, 60].filter((l) => l <= duration * 0.8);
}
