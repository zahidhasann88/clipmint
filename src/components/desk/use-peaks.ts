"use client";
import { useEffect, useState } from "react";

const MAX_BYTES = 120 * 1024 * 1024;
const RESOLUTION = 2000;
const cache = new WeakMap<Blob, Promise<Float32Array | null>>();

function decode(blob: Blob): Promise<Float32Array | null> {
  const hit = cache.get(blob);
  if (hit) return hit;
  const job = (async () => {
    if (blob.size > MAX_BYTES) return null;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    try {
      const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
      const chans = Array.from({ length: audio.numberOfChannels }, (_, i) =>
        audio.getChannelData(i),
      );
      const len = chans[0].length;
      const block = Math.max(1, Math.floor(len / RESOLUTION));
      const out = new Float32Array(Math.ceil(len / block));
      for (let b = 0; b < out.length; b++) {
        let peak = 0;
        const from = b * block,
          to = Math.min(len, from + block);
        for (const ch of chans)
          for (let i = from; i < to; i += 4) {
            const v = Math.abs(ch[i]);
            if (v > peak) peak = v;
          }
        out[b] = peak;
      }
      let max = 1e-6;
      for (const v of out) if (v > max) max = v;
      for (let i = 0; i < out.length; i++) out[i] = Math.sqrt(out[i] / max); // sqrt lifts quiet passages so they stay visible
      return out;
    } catch {
      return null;
    } finally {
      ctx.close().catch(() => {});
    }
  })();
  cache.set(blob, job);
  return job;
}

export function usePeaks(
  blob: Blob | null | undefined,
  bars: number,
): number[] | null {
  const [raw, setRaw] = useState<Float32Array | null>(null);
  useEffect(() => {
    setRaw(null);
    if (!blob) return;
    let live = true;
    decode(blob).then((p) => {
      if (live) setRaw(p);
    });
    return () => {
      live = false;
    };
  }, [blob]);
  if (!raw || bars <= 0) return null;
  const out: number[] = new Array(bars);
  const step = raw.length / bars;
  for (let i = 0; i < bars; i++) {
    let p = 0;
    for (
      let j = Math.floor(i * step),
        end = Math.max(j + 1, Math.floor((i + 1) * step));
      j < end && j < raw.length;
      j++
    )
      if (raw[j] > p) p = raw[j];
    out[i] = p;
  }
  return out;
}
