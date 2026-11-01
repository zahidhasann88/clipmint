export const VAD_RATE = 16000;
export const VAD_CHUNK = 512;
export const VAD_CONTEXT = 64;

export interface Region {
  start: number;
  end: number;
}

const ON = 0.5;
const OFF = 0.35;
const MIN_SILENCE = 0.3;
const MIN_SPEECH = 0.25;
const PAD = 0.2;

export function speechRegions(
  probs: ArrayLike<number>,
  step = VAD_CHUNK / VAD_RATE,
  duration = probs.length * step,
): Region[] {
  const raw: Region[] = [];
  let start: number | null = null,
    quietSince: number | null = null;
  for (let i = 0; i < probs.length; i++) {
    const t = i * step,
      p = probs[i];
    if (start == null) {
      if (p >= ON) {
        start = t;
        quietSince = null;
      }
    } else if (p < OFF) {
      quietSince ??= t;
      if (t + step - quietSince >= MIN_SILENCE) {
        raw.push({ start, end: quietSince });
        start = null;
        quietSince = null;
      }
    } else {
      quietSince = null;
    }
  }
  if (start != null) raw.push({ start, end: quietSince ?? duration });
  const out: Region[] = [];
  for (const r of raw) {
    if (r.end - r.start < MIN_SPEECH) continue;
    const s = Math.max(0, r.start - PAD),
      e = Math.min(duration, r.end + PAD);
    const last = out[out.length - 1];
    if (last && s <= last.end) last.end = Math.max(last.end, e);
    else out.push({ start: s, end: e });
  }
  return out;
}

export function speechWithin(regions: Region[], a: number, b: number): number {
  let n = 0;
  for (const r of regions)
    n += Math.max(0, Math.min(b, r.end) - Math.max(a, r.start));
  return n;
}

export function keepSpeech(
  audio: Float32Array,
  regions: Region[],
  rate = VAD_RATE,
): Float32Array {
  const out = new Float32Array(audio.length);
  for (const r of regions) {
    const a = Math.max(0, Math.floor(r.start * rate)),
      b = Math.min(audio.length, Math.ceil(r.end * rate));
    out.set(audio.subarray(a, b), a);
  }
  return out;
}

export function onSpeech<T extends { start: number; end: number }>(
  segments: T[],
  regions: Region[],
): T[] {
  return segments.filter(
    (s) =>
      speechWithin(regions, s.start - 0.3, s.end + 0.3) >=
      Math.min(0.25, (s.end - s.start) * 0.3),
  );
}
