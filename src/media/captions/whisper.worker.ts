/// <reference lib="webworker" />

import {
  AutoModel,
  Tensor,
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type PreTrainedModel,
} from "@huggingface/transformers";
import { fetchJoined, isSplit } from "./split-files";
import {
  alignWords,
  wordsToSegments,
  type Segment,
  type TimedWord,
} from "./format";
import {
  VAD_CHUNK,
  VAD_CONTEXT,
  VAD_RATE,
  keepSpeech,
  onSpeech,
  speechRegions,
  speechWithin,
} from "./vad";

declare const self: DedicatedWorkerGlobalScope;

const WINDOW = 30;
const RATE = VAD_RATE;

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";
env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = {
  match: async (key: string | Request) => {
    const url = typeof key === "string" ? key : key.url;
    return (await isSplit(url)) ? fetchJoined(url) : undefined;
  },
  put: async () => {
    /* the browser's HTTP cache keeps these */
  },
};

let asr: Promise<{
  run: AutomaticSpeechRecognitionPipeline;
  device: string;
}> | null = null;
let asrModel: string | null = null;
let vad: Promise<PreTrainedModel> | null = null;
let runtimeSet = false;

async function runtime(gpu: boolean) {
  if (runtimeSet) return;
  runtimeSet = true;
  const onnx = env.backends.onnx as {
    wasm?: { wasmPaths?: unknown; numThreads?: number };
  };
  if (!onnx.wasm) return;
  onnx.wasm.numThreads = 1;
  if (gpu) {
    const res = await fetchJoined("/ort/ort-wasm-simd-threaded.asyncify.wasm");
    const wasm = new Blob([await res.arrayBuffer()], {
      type: "application/wasm",
    });
    onnx.wasm.wasmPaths = {
      mjs: "/ort/ort-wasm-simd-threaded.asyncify.mjs",
      wasm: URL.createObjectURL(wasm),
    };
  } else {
    onnx.wasm.wasmPaths = {
      mjs: "/ort/ort-wasm-simd-threaded.mjs",
      wasm: "/ort/ort-wasm-simd-threaded.wasm",
    };
  }
}

async function gpuUsable(cpuOnly: boolean): Promise<boolean> {
  if (cpuOnly) return false;
  const nav = self.navigator as Navigator & {
    gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> };
  };
  const adapter = await nav.gpu?.requestAdapter().catch(() => null);
  return !!adapter && adapter.features.has("shader-f16");
}

function loadAsr(gpu: boolean, model: string): NonNullable<typeof asr> {
  if (asr && asrModel !== model) {
    const old = asr;
    asr = null;
    old
      .then((a) =>
        (a.run as unknown as { dispose?: () => Promise<void> }).dispose?.(),
      )
      .catch(() => {});
  }
  asrModel = model;
  asr ??= (async () => {
    const progress = (p: {
      status: string;
      loaded?: number;
      total?: number;
    }) => {
      if (p.status === "progress" && p.total)
        self.postMessage({
          type: "progress",
          stage: "download",
          ratio: (p.loaded ?? 0) / p.total,
        });
    };
    const make = async (device: "webgpu" | "wasm") => {
      const dtype =
        device === "webgpu"
          ? { encoder_model: "fp16", decoder_model_merged: "fp16" }
          : { encoder_model: "q8", decoder_model_merged: "q8" };
      return (await pipeline(
        "automatic-speech-recognition",
        `whisper-${model}`,
        { device, dtype, progress_callback: progress } as never,
      )) as AutomaticSpeechRecognitionPipeline;
    };
    if (gpu) {
      try {
        return { run: await make("webgpu"), device: "webgpu" };
      } catch {
        /* fall back to the CPU */
      }
    }
    return { run: await make("wasm"), device: "wasm" };
  })();
  asr.catch(() => {
    asr = null;
  });
  return asr;
}

function loadVad(): NonNullable<typeof vad> {
  vad ??= AutoModel.from_pretrained("silero-vad", {
    config: { model_type: "custom" },
    dtype: "fp32",
    device: "wasm",
  } as never);
  vad.catch(() => {
    vad = null;
  });
  return vad;
}

async function speechProbabilities(audio: Float32Array): Promise<Float32Array> {
  const model = await loadVad();
  const sr = new Tensor("int64", BigInt64Array.from([BigInt(RATE)]), []);
  let state = new Tensor("float32", new Float32Array(2 * 128), [2, 1, 128]);
  const steps = Math.ceil(audio.length / VAD_CHUNK);
  const probs = new Float32Array(steps);
  const buf = new Float32Array(VAD_CONTEXT + VAD_CHUNK);
  for (let i = 0; i < steps; i++) {
    buf.copyWithin(0, VAD_CHUNK);
    buf.fill(0, VAD_CONTEXT);
    buf.set(audio.subarray(i * VAD_CHUNK, (i + 1) * VAD_CHUNK), VAD_CONTEXT);
    const out = (await model({
      input: new Tensor("float32", buf.slice(), [1, buf.length]),
      sr,
      state,
    })) as { output: Tensor; stateN: Tensor };
    probs[i] = (out.output.data as Float32Array)[0];
    state = out.stateN;
    if (i % 200 === 0)
      self.postMessage({ type: "progress", stage: "speech", ratio: i / steps });
  }
  return probs;
}

type Chunk = { timestamp: [number, number | null]; text: string };

self.onmessage = async (
  e: MessageEvent<{
    audio: Float32Array;
    language: string;
    model?: string;
    cpu?: boolean;
  }>,
) => {
  try {
    const gpu = await gpuUsable(!!e.data.cpu);
    await runtime(gpu);
    const total = e.data.audio.length / RATE;

    const regions = speechRegions(
      await speechProbabilities(e.data.audio),
      VAD_CHUNK / RATE,
      total,
    );
    if (speechWithin(regions, 0, total) < 0.3) {
      self.postMessage({ type: "done", segments: [], device: "none" });
      return;
    }
    const audio = keepSpeech(e.data.audio, regions);

    const { run, device } = await loadAsr(
      gpu,
      e.data.model === "base" ? "base" : "tiny",
    );
    const segments: Segment[] = [];
    let wordTimes = true;
    for (let at = 0; at < total; at += WINDOW) {
      if (speechWithin(regions, at, at + WINDOW) >= 0.2) {
        const slice = audio.subarray(
          Math.floor(at * RATE),
          Math.min(audio.length, Math.floor((at + WINDOW) * RATE)),
        );
        const hear = (stamps: boolean | "word") =>
          run(slice, {
            return_timestamps: stamps,
            task: "transcribe",
            language: e.data.language || "en",
          } as never) as unknown as Promise<{ chunks?: Chunk[]; text: string }>;
        let out: { chunks?: Chunk[]; text: string };
        try {
          out = await hear(wordTimes ? "word" : true);
        } catch (err) {
          if (!wordTimes) throw err;
          wordTimes = false;
          out = await hear(true);
        }
        if (wordTimes) {
          const words: TimedWord[] = [];
          for (const c of out.chunks ?? []) {
            if (/^\s*[[(].*[\])]\s*$/.test(c.text)) continue;
            const start = at + (c.timestamp[0] ?? 0);
            words.push({
              start,
              end: at + (c.timestamp[1] ?? (c.timestamp[0] ?? 0) + 0.3),
              text: c.text,
            });
          }
          segments.push(...wordsToSegments(alignWords(words, audio, RATE)));
        } else
        for (const c of out.chunks ?? [
          { timestamp: [0, slice.length / RATE], text: out.text },
        ]) {
          const text = c.text.trim();
          if (!text || /^\[.*\]$|^\(.*\)$/.test(text)) continue;
          const start = at + (c.timestamp[0] ?? 0);
          const end =
            at + (c.timestamp[1] ?? Math.min(WINDOW, slice.length / RATE));
          segments.push({ start, end: Math.max(end, start + 0.4), text });
        }
      }
      self.postMessage({
        type: "progress",
        stage: "listen",
        ratio: Math.min(1, (at + WINDOW) / total),
      });
    }

    self.postMessage({
      type: "done",
      segments: onSpeech(segments, regions),
      device,
    });
  } catch (err) {
    self.postMessage({
      type: "error",
      message: (err as Error)?.message || String(err),
    });
  }
};
