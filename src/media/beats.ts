import type { Range } from "./recipe";

const HOP = 0.01;
const MIN_BPM = 70,
  MAX_BPM = 180;

function onsets(samples: Float32Array, rate: number): Float32Array {
  const per = Math.max(1, Math.round(rate * HOP));
  const n = Math.floor(samples.length / per);
  const flux = new Float32Array(n);
  let last = 0;
  for (let f = 0; f < n; f++) {
    let sum = 0;
    for (let i = f * per, end = i + per; i < end; i++)
      sum += samples[i] * samples[i];
    const level = Math.log1p(1000 * Math.sqrt(sum / per));
    flux[f] = Math.max(0, level - last);
    last = level;
  }
  return flux;
}

export function beatTimes(samples: Float32Array, rate: number): number[] {
  const flux = onsets(samples, rate);
  if (flux.length < 200) return [];
  const lo = Math.round(60 / MAX_BPM / HOP),
    hi = Math.round(60 / MIN_BPM / HOP);
  let best = 0,
    period = 0;
  for (let lag = lo; lag <= hi; lag++) {
    let sum = 0;
    for (let i = lag; i < flux.length; i++) sum += flux[i] * flux[i - lag];
    const score = sum / (flux.length - lag);
    if (score > best * 1.02) {
      best = score;
      period = lag;
    }
  }
  if (!period || !best) return [];
  let phase = 0,
    top = -1;
  for (let p = 0; p < period; p++) {
    let sum = 0;
    for (let i = p; i < flux.length; i += period) sum += flux[i];
    if (sum > top) {
      top = sum;
      phase = p;
    }
  }
  const out: number[] = [];
  for (let i = phase; i < flux.length; i += period) out.push(i * HOP);
  return out;
}

export interface BeatPiece extends Range {
  clip: number;
}

export function beatPieces(
  beats: number[],
  clips: Range[],
  maxPieces = 40,
  minLength = 0.7,
): BeatPiece[] {
  if (beats.length < 2 || !clips.length) return [];
  const gap = beats[1] - beats[0];
  const every = Math.max(1, Math.ceil(minLength / gap));
  const pos = clips.map((c) => c.start);
  const out: BeatPiece[] = [];
  let clip = 0;
  for (
    let b = 0;
    b + every < beats.length && out.length < maxPieces;
    b += every
  ) {
    const len = beats[b + every] - beats[b];
    let tries = 0;
    while (tries < clips.length && pos[clip] + len > clips[clip].end + 1e-3) {
      clip = (clip + 1) % clips.length;
      tries++;
    }
    if (tries === clips.length) break;
    out.push({ clip, start: pos[clip], end: pos[clip] + len });
    pos[clip] += len;
    clip = (clip + 1) % clips.length;
  }
  return out;
}
