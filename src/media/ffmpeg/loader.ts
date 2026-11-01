"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";

export interface CoreManifest {
  core: string;
  worker: string;
  wasmParts: string[];
  wasmSize: number;
}

type LoadState = "idle" | "loading" | "loaded" | "error";
let ffmpegInstance: FFmpeg | null = null;
let loadState: LoadState = "idle";
let loadPromise: Promise<FFmpeg> | null = null;
let loadError: string | null = null;

const MANIFEST_URL = "/ffmpeg/manifest.json";

export async function assembleWasm(
  manifest: CoreManifest,
  fetcher: typeof fetch = fetch,
): Promise<Blob> {
  const parts = await Promise.all(
    manifest.wasmParts.map(async (path) => {
      const res = await fetcher(path);
      if (!res.ok) throw new Error(`${path} returned HTTP ${res.status}`);
      return res.arrayBuffer();
    }),
  );
  const blob = new Blob(parts, { type: "application/wasm" });
  if (blob.size !== manifest.wasmSize) {
    throw new Error(
      `encoder download incomplete (${blob.size} of ${manifest.wasmSize} bytes)`,
    );
  }
  return blob;
}

async function createInstance(): Promise<FFmpeg> {
  const ff = new FFmpeg();
  const absolute = (url: string) => new URL(url, window.location.origin).href;
  let wasmURL: string | null = null;
  try {
    const res = await fetch(MANIFEST_URL);
    if (!res.ok) throw new Error(`${MANIFEST_URL} returned HTTP ${res.status}`);
    const manifest = (await res.json()) as CoreManifest;
    wasmURL = URL.createObjectURL(await assembleWasm(manifest));
    await ff.load({
      coreURL: absolute(manifest.core),
      wasmURL,
      classWorkerURL: absolute(manifest.worker),
    });
  } catch (err) {
    try {
      ff.terminate();
    } catch {}
    loadState = "error";
    loadError = err instanceof Error ? err.message : String(err);
    throw new Error(
      `The encoder failed to load (${loadError}). Check your connection, then retry. ` +
        `It is only downloaded the first time you process a file.`,
    );
  } finally {
    if (wasmURL) URL.revokeObjectURL(wasmURL);
  }
  ffmpegInstance = ff;
  loadState = "loaded";
  return ff;
}

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance && loadState === "loaded") return ffmpegInstance;
  if (loadPromise) return loadPromise;
  loadState = "loading";
  loadError = null;
  loadPromise = createInstance();
  try {
    return await loadPromise;
  } catch (e) {
    loadPromise = null;
    throw e;
  }
}

export function disposeFFmpeg() {
  try {
    ffmpegInstance?.terminate();
  } catch {}
  ffmpegInstance = null;
  loadPromise = null;
  loadState = "idle";
}
