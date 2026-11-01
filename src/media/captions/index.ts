"use client";
import { processAudio } from "@/media/audio/engine";
import { wavSamples } from "@/media/files/wav";
import type { Range } from "@/media/recipe";
import { realSpeech, type Segment } from "./format";

export type { Segment } from "./format";
export { realSpeech, toSRT, toText, toVTT } from "./format";
export type CaptionStage = "audio" | "download" | "speech" | "listen";

const STALL_MS = 90_000;

let worker: Worker | null = null;
function getWorker(): Worker {
  worker ??= new Worker(new URL("./whisper.worker.ts", import.meta.url), {
    type: "module",
  });
  return worker;
}
export function stopCaptions() {
  worker?.terminate();
  worker = null;
}

export const LANGUAGES: [string, string][] = [
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["pt", "Portuguese"],
  ["it", "Italian"],
  ["nl", "Dutch"],
  ["ru", "Russian"],
  ["tr", "Turkish"],
  ["ar", "Arabic"],
  ["hi", "Hindi"],
  ["bn", "Bengali"],
  ["ur", "Urdu"],
  ["id", "Indonesian"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zh", "Chinese"],
];

export type SpeechModel = "tiny" | "base";

let served: Promise<SpeechModel[]> | null = null;
export function speechModels(): Promise<SpeechModel[]> {
  served ??= fetch("/models/speech.json")
    .then((r) => (r.ok ? r.json() : { models: ["tiny"] }))
    .then((j: { models?: string[] }) =>
      (j.models ?? ["tiny"]).filter(
        (m): m is SpeechModel => m === "tiny" || m === "base",
      ),
    )
    .catch(() => ["tiny"] as SpeechModel[]);
  return served;
}

export const MODEL_MB: Record<SpeechModel, [number, number]> = {
  tiny: [41, 76],
  base: [77, 146],
};

export async function transcribe(
  file: File,
  range: Range | null,
  signal: AbortSignal,
  onProgress?: (stage: CaptionStage, ratio: number | null) => void,
  language = "en",
  model: SpeechModel = "tiny",
): Promise<{ segments: Segment[]; device: string }> {
  onProgress?.("audio", null);
  const wav = await processAudio(
    file,
    {
      outputFormat: "wav",
      sampleRate: 16000,
      channels: 1,
      trimStart: range ? range.start : null,
      trimEnd: range ? range.end : null,
    },
    undefined,
    signal,
  );
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  const audio = wavSamples(await wav.blob.arrayBuffer());
  const offset = range?.start ?? 0;
  const use = (await speechModels()).includes(model) ? model : "tiny";
  const run = (cpu: boolean) =>
    listen(audio.slice(), language, use, cpu, signal, onProgress);
  let heard: { segments: Segment[]; device: string };
  try {
    heard = await run(false);
  } catch (e) {
    if ((e as Error)?.name !== "StallError") throw e;
    heard = await run(true);
  }
  return {
    segments: realSpeech(heard.segments).map((s) => ({
      ...s,
      start: s.start + offset,
      end: s.end + offset,
      words: s.words?.map((w) => ({
        ...w,
        start: w.start + offset,
        end: w.end + offset,
      })),
    })),
    device: heard.device,
  };
}

function listen(
  audio: Float32Array,
  language: string,
  model: SpeechModel,
  cpu: boolean,
  signal: AbortSignal,
  onProgress?: (stage: CaptionStage, ratio: number | null) => void,
): Promise<{ segments: Segment[]; device: string }> {
  if (cpu) stopCaptions();
  const w = getWorker();
  return new Promise((resolve, reject) => {
    let last = Date.now();
    const watch = setInterval(() => {
      if (Date.now() - last < STALL_MS) return;
      finish();
      stopCaptions();
      const err = new Error(
        cpu
          ? "Captions stopped responding. Try a shorter clip, or close other tabs."
          : "The speech model stalled on the GPU.",
      );
      if (!cpu) err.name = "StallError";
      reject(err);
    }, 5000);
    const onAbort = () => {
      finish();
      stopCaptions();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const finish = () => {
      clearInterval(watch);
      signal.removeEventListener("abort", onAbort);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    w.onmessage = (
      e: MessageEvent<{
        type: string;
        stage?: CaptionStage;
        ratio?: number;
        segments?: Segment[];
        device?: string;
        message?: string;
      }>,
    ) => {
      last = Date.now();
      const m = e.data;
      if (m.type === "progress") onProgress?.(m.stage!, m.ratio ?? null);
      else if (m.type === "done") {
        finish();
        resolve({ segments: m.segments!, device: m.device! });
      } else if (m.type === "error") {
        finish();
        stopCaptions();
        reject(new Error(`Captions failed: ${m.message}`));
      }
    };
    w.onerror = (e) => {
      finish();
      stopCaptions();
      reject(
        new Error(
          `Captions failed: ${e.message || "the speech model didn't load"}`,
        ),
      );
    };
    w.postMessage({ audio, language, model, cpu }, [audio.buffer]);
  });
}
