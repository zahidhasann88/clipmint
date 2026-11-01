"use client";
import { processVideo } from "@/media/video/engine";
import { videoPlanFor, type Range } from "@/media/recipe";
import { denoiseModel } from "@/media/models";
import type { FileFacts, Recipe } from "@/lib/registry";

export const SAMPLE_SECONDS = 2;
export const SAMPLE_MAX_BYTES = 200e6;

export interface SampleResult {
  bytes: number;
  seconds: number;
}

export async function sampleVideo(
  file: File,
  recipe: Recipe,
  facts: FileFacts,
  range: Range | null,
  signal: AbortSignal,
  music?: File | null,
): Promise<SampleResult> {
  const full = range ?? { start: 0, end: facts.duration ?? 0 };
  const len = full.end - full.start;
  if (len <= 0) throw new Error("No length to sample.");
  const take = Math.min(SAMPLE_SECONDS, len);
  const start = full.start + (len - take) / 2;
  const whole = videoPlanFor(recipe, facts, range, !!music).job;
  const { job } = videoPlanFor(
    recipe,
    facts,
    { start, end: start + take },
    !!music,
  );
  job.speedMode = whole.speedMode;
  const model = recipe.clean ? await denoiseModel(recipe.denoise) : null;
  const t0 = performance.now();
  let encodeAt: number | null = null;
  const res = await processVideo(
    file,
    job,
    { width: facts.width, height: facts.height },
    (_r, msg) => {
      if (encodeAt == null && /^Encoding/.test(msg))
        encodeAt = performance.now();
    },
    signal,
    music,
    model,
  );
  const t1 = performance.now();
  const io = ((encodeAt ?? t0) - t0) / 1000,
    enc = (t1 - (encodeAt ?? t0)) / 1000;
  return {
    bytes: Math.round(res.blob.size * (len / take)),
    seconds: io + enc * (len / take),
  };
}
