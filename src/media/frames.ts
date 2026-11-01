import type { Range } from "./recipe";

export interface ScoredFrame {
  t: number;
  score: number;
}

export function frameScore(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  const n = width * height;
  const lum = new Float32Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) {
    lum[i] =
      0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    mean += lum[i];
  }
  mean /= n;
  let spread = 0,
    edges = 0;
  for (let i = 0; i < n; i++) spread += (lum[i] - mean) ** 2;
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      edges += Math.abs(
        4 * lum[i] -
          lum[i - 1] -
          lum[i + 1] -
          lum[i - width] -
          lum[i + width],
      );
    }
  const exposed = mean < 30 || mean > 230 ? 0.25 : 1;
  return exposed * (Math.sqrt(spread / n) + edges / n / 4);
}

export function pickFrames(
  frames: ScoredFrame[],
  count: number,
  minGap: number,
): ScoredFrame[] {
  const out: ScoredFrame[] = [];
  for (const f of frames.slice().sort((a, b) => b.score - a.score)) {
    if (out.length >= count) break;
    if (out.every((o) => Math.abs(o.t - f.t) >= minGap)) out.push(f);
  }
  return out.sort((a, b) => a.t - b.t);
}

const SAMPLES = 24;
const THUMB_W = 240;

function openVideo(file: File): Promise<{ v: HTMLVideoElement; done: () => void }> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  const done = () => {
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  };
  return new Promise((ok, fail) => {
    v.onloadeddata = () => ok({ v, done });
    v.onerror = () => {
      done();
      fail(new Error("This browser can't show frames from this video."));
    };
  });
}

const seek = (v: HTMLVideoElement, t: number) =>
  new Promise<void>((ok) => {
    v.onseeked = () => ok();
    v.currentTime = t;
  });

export interface FramePick {
  t: number;
  url: string;
}

export async function findFrames(
  file: File,
  range: Range,
  signal: AbortSignal,
  count = 6,
): Promise<FramePick[]> {
  const { v, done } = await openVideo(file);
  try {
    const w = THUMB_W,
      h = Math.max(2, Math.round((w * v.videoHeight) / v.videoWidth));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    const len = range.end - range.start;
    const seen: (ScoredFrame & { url: string })[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      const t = range.start + (len * (i + 0.5)) / SAMPLES;
      await seek(v, Math.min(t, (v.duration || range.end) - 0.04));
      g.drawImage(v, 0, 0, w, h);
      seen.push({
        t,
        score: frameScore(g.getImageData(0, 0, w, h).data, w, h),
        url: c.toDataURL("image/jpeg", 0.7),
      });
    }
    const picked = pickFrames(seen, count, len / (count * 2));
    return picked.map((p) => ({
      t: p.t,
      url: seen.find((s) => s.t === p.t)!.url,
    }));
  } finally {
    done();
  }
}

export async function saveFrame(
  file: File,
  t: number,
  format: "jpg" | "png",
): Promise<Blob> {
  const { v, done } = await openVideo(file);
  try {
    await seek(v, t);
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((ok) =>
      c.toBlob(ok, format === "png" ? "image/png" : "image/jpeg", 0.92),
    );
    if (!blob) throw new Error("Couldn't save this frame.");
    return blob;
  } finally {
    done();
  }
}
