"use client";
import { processAudio } from "@/media/audio/engine";
import { wavSamples } from "@/media/files/wav";
import type { Envelope } from "@/media/highlights";

const RATE = 10;
const DECODE_MAX = 120 * 1024 * 1024;
const cache = new WeakMap<Blob, Promise<Envelope | null>>();

function envelope(samples: Float32Array[], sampleRate: number): Envelope {
  const per = Math.max(1, Math.round(sampleRate / RATE));
  const len = samples[0]?.length ?? 0;
  const db = new Float32Array(Math.floor(len / per));
  for (let f = 0; f < db.length; f++) {
    let sum = 0;
    for (const ch of samples)
      for (let i = f * per, end = i + per; i < end; i++) sum += ch[i] * ch[i];
    const rms = Math.sqrt(sum / (per * samples.length));
    db[f] = rms > 3e-5 ? 20 * Math.log10(rms) : -90;
  }
  return { rate: RATE, db };
}

async function viaBrowser(file: Blob): Promise<Envelope | null> {
  if (file.size > DECODE_MAX) return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(await file.arrayBuffer());
    return envelope(
      Array.from({ length: audio.numberOfChannels }, (_, i) =>
        audio.getChannelData(i),
      ),
      audio.sampleRate,
    );
  } catch {
    return null;
  } finally {
    ctx.close().catch(() => {});
  }
}

async function viaFFmpeg(
  file: File,
  signal?: AbortSignal,
): Promise<Envelope | null> {
  try {
    const wav = await processAudio(
      file,
      {
        outputFormat: "wav",
        sampleRate: 8000,
        channels: 1,
        trimStart: null,
        trimEnd: null,
      },
      undefined,
      signal,
    );
    return envelope([wavSamples(await wav.blob.arrayBuffer())], 8000);
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    return null;
  }
}

export function loudness(
  file: File,
  signal?: AbortSignal,
): Promise<Envelope | null> {
  const hit = cache.get(file);
  if (hit) return hit;
  const job = (async () => {
    const env = (await viaBrowser(file)) ?? (await viaFFmpeg(file, signal));
    return env && env.db.length > 0 && env.db.some((d) => d > -90) ? env : null;
  })();
  job.catch(() => cache.delete(file));
  cache.set(file, job);
  return job;
}
