"use client";
import type { FaceDetector } from "@mediapipe/tasks-vision";
import type { Range } from "@/media/recipe";
import type { FaceBox } from "@/media/ffmpeg/commands";

export interface TrackKey {
  t: number;
  x: number;
  y: number;
}

let detector: Promise<FaceDetector> | null = null;

function getDetector(): Promise<FaceDetector> {
  detector ??= (async () => {
    const { FilesetResolver, FaceDetector } =
      await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks("/mediapipe");
    const make = (delegate: "GPU" | "CPU") =>
      FaceDetector.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: "/models/face/blaze_face_short_range.tflite",
          delegate,
        },
        runningMode: "IMAGE",
        minDetectionConfidence: MIN_SCORE,
      });
    try {
      return await make("GPU");
    } catch {
      return make("CPU");
    }
  })();
  detector.catch(() => {
    detector = null;
  });
  return detector;
}

const MAX_SAMPLES = 90;
const MIN_SCORE = 0.7;
const MIN_HITS = 3,
  MIN_SHARE = 0.2;
const HOLD = 1;
const MAX_KEYS = 32;

export async function trackFaces(
  file: File,
  range: Range,
  signal: AbortSignal,
  onProgress?: (ratio: number) => void,
): Promise<TrackKey[] | null> {
  const det = await getDetector();
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  try {
    await new Promise<void>((ok, fail) => {
      v.onloadeddata = () => ok();
      v.onerror = () =>
        fail(new Error("This video can't be read for face tracking."));
    });
    const len = Math.max(0.1, range.end - range.start);
    const step = Math.max(0.4, len / MAX_SAMPLES);
    const raw: FaceSample[] = [];
    for (let t = range.start; t <= range.end + 1e-3; t += step) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      await new Promise<void>((ok) => {
        v.onseeked = () => ok();
        v.currentTime = Math.min(t, (v.duration || range.end) - 0.04);
      });
      const faces = det.detect(v).detections;
      let best: { x: number; y: number; a: number } | null = null;
      for (const f of faces) {
        const b = f.boundingBox;
        if (!b) continue;
        const a = b.width * b.height;
        if (!best || a > best.a)
          best = {
            x: (b.originX + b.width / 2) / v.videoWidth,
            y: (b.originY + b.height / 2.4) / v.videoHeight,
            a,
          };
      }
      raw.push({ t, x: best?.x ?? null, y: best?.y ?? null });
      onProgress?.(Math.min(1, (t - range.start) / len));
    }
    return facePath(raw);
  } finally {
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}

export interface FaceAt {
  t: number;
  faces: { x: number; y: number; w: number; h: number }[];
}

const MAX_FACES = 6;
const SAME_FACE = 0.25;
const BLUR_SCORE = 0.45;

// Tracks are matched by nearest position. A face seen once still gets a track:
// for hiding people, an extra blur is safer than a missed one.
export function faceTracks(samples: FaceAt[]): FaceBox[][] {
  const tracks: FaceBox[][] = [];
  for (const s of samples) {
    const taken = new Set<FaceBox[]>();
    for (const f of s.faces) {
      let best: FaceBox[] | null = null,
        near = SAME_FACE;
      for (const tr of tracks) {
        if (taken.has(tr)) continue;
        const k = tr[tr.length - 1];
        const d = Math.hypot(k.x - f.x, k.y - f.y);
        if (d < near) {
          near = d;
          best = tr;
        }
      }
      const key = { t: s.t, ...f };
      if (best) best.push(key);
      else {
        best = [key];
        tracks.push(best);
      }
      taken.add(best);
    }
  }
  return tracks
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_FACES)
    .map((tr) => {
      const every = Math.max(1, Math.ceil(tr.length / MAX_KEYS));
      const keys = tr.filter((_, i) => i % every === 0);
      if (keys[keys.length - 1] !== tr[tr.length - 1])
        keys.push(tr[tr.length - 1]);
      return keys;
    });
}

export async function trackAllFaces(
  file: File,
  range: Range,
  signal: AbortSignal,
  onProgress?: (ratio: number) => void,
): Promise<FaceBox[][]> {
  const det = await getDetector();
  await det.setOptions({ minDetectionConfidence: BLUR_SCORE });
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  try {
    await new Promise<void>((ok, fail) => {
      v.onloadeddata = () => ok();
      v.onerror = () =>
        fail(new Error("This video can't be read to find faces."));
    });
    const len = Math.max(0.1, range.end - range.start);
    const step = Math.max(0.25, len / 240);
    const out: FaceAt[] = [];
    for (let t = range.start; t <= range.end + 1e-3; t += step) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      await new Promise<void>((ok) => {
        v.onseeked = () => ok();
        v.currentTime = Math.min(t, (v.duration || range.end) - 0.04);
      });
      const faces = det.detect(v).detections.flatMap((f) => {
        const b = f.boundingBox;
        return b
          ? [
              {
                x: (b.originX + b.width / 2) / v.videoWidth,
                y: (b.originY + b.height / 2) / v.videoHeight,
                w: b.width / v.videoWidth,
                h: b.height / v.videoHeight,
              },
            ]
          : [];
      });
      out.push({ t: +t.toFixed(3), faces });
      onProgress?.(Math.min(1, (t - range.start) / len));
    }
    return faceTracks(out);
  } finally {
    await det.setOptions({ minDetectionConfidence: MIN_SCORE });
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}

export interface FaceSample {
  t: number;
  x: number | null;
  y: number | null;
}

export function facePath(raw: FaceSample[]): TrackKey[] | null {
  const hits = raw.filter((r) => r.x != null).length;
  if (hits < MIN_HITS || hits < raw.length * MIN_SHARE) return null;
  const filled = raw.map((r) => {
    if (r.x != null) return r as { t: number; x: number; y: number };
    let near: (typeof raw)[number] | null = null;
    for (const o of raw)
      if (
        o.x != null &&
        Math.abs(o.t - r.t) <= HOLD &&
        (!near || Math.abs(o.t - r.t) < Math.abs(near.t - r.t))
      )
        near = o;
    return { t: r.t, x: near?.x ?? 0.5, y: near?.y ?? 0.5 };
  });
  const smooth = filled.map((r, i) => {
    const win = filled.slice(Math.max(0, i - 3), i + 4);
    return {
      t: r.t,
      x: win.reduce((s, w) => s + w.x, 0) / win.length,
      y: win.reduce((s, w) => s + w.y, 0) / win.length,
    };
  });
  const every = Math.max(1, Math.ceil(smooth.length / MAX_KEYS));
  const keys = smooth.filter((_, i) => i % every === 0);
  if (keys[keys.length - 1] !== smooth[smooth.length - 1])
    keys.push(smooth[smooth.length - 1]);
  return keys.map((k) => ({
    t: +k.t.toFixed(3),
    x: +k.x.toFixed(4),
    y: +k.y.toFixed(4),
  }));
}
