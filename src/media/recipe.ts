import type {
  AudioJobOptions,
  VideoJobOptions,
  VideoMergeOptions,
} from "@/media/ffmpeg/commands";
import {
  ASPECT_RATIO,
  PLATFORMS,
  SQUEEZE_TARGET_BYTES,
  type FileFacts,
  type Recipe,
  type VideoSize,
} from "@/lib/registry";

export interface Range {
  start: number;
  end: number;
}

export const LOSSLESS: Recipe["format"][] = ["wav", "flac"];
export const AUDIO_BITRATES = [64, 96, 128, 160, 192, 224, 256, 320] as const;
export const QUALITY_PRESETS = [
  { id: "small", name: "Small", kbps: 96, leaf: 16 },
  { id: "balanced", name: "Balanced", kbps: 192, leaf: 22 },
  { id: "crisp", name: "Crisp", kbps: 320, leaf: 28 },
] as const;

const BOX: Record<VideoSize, { w: number; h: number }> = {
  "1080p": { w: 1920, h: 1080 },
  "720p": { w: 1280, h: 720 },
  "480p": { w: 854, h: 480 },
};
const ASSUMED_FPS = 30;

const selected = (range: Range | null, facts: FileFacts) =>
  range ? Math.max(0, range.end - range.start) : (facts.duration ?? 0);
const isWhole = (range: Range | null, facts: FileFacts) =>
  !range ||
  !facts.duration ||
  (range.start <= 0.001 && Math.abs(range.end - facts.duration) < 0.1);

export const LUFS: Record<Exclude<Recipe["loudness"], "off">, number> = {
  voice: -16,
  music: -14,
  gentle: -23,
};

export function audioJob(
  recipe: Recipe,
  facts: FileFacts,
  range: Range | null,
): AudioJobOptions {
  const cleans = recipe.clean,
    trimsSilence = recipe.trimSilence;
  const fades = recipe.fadeIn > 0 || recipe.fadeOut > 0;
  const whole =
    isWhole(range, facts) && !(recipe.fadeOut > 0 && facts.duration);
  const r =
    range ?? (facts.duration ? { start: 0, end: facts.duration } : null);
  const f = recipe.format;
  return {
    outputFormat: f,
    mp3Bitrate: f === "mp3" ? recipe.bitrate : undefined,
    aacBitrate: f === "m4a" || f === "aac" ? `${recipe.bitrate}k` : undefined,
    bitrate: f === "ogg" || f === "opus" ? recipe.bitrate : undefined,
    sampleRate: f === "opus" ? null : recipe.sampleRate,
    channels: recipe.channels,
    trimStart: whole || !r ? null : r.start,
    trimEnd: whole || !r ? null : r.end,
    fadeIn: fades ? recipe.fadeIn : null,
    fadeOut: fades ? recipe.fadeOut : null,
    loudness: recipe.loudness === "off" ? null : LUFS[recipe.loudness],
    tempo: recipe.speed !== 1 ? recipe.speed : null,
    denoise: cleans ? { level: recipe.denoise } : null,
    silence: trimsSilence ? { mode: recipe.silence, pause: 0.6 } : null,
    crossfade: recipe.merge && recipe.crossfade > 0 ? recipe.crossfade : null,
  };
}

export const DENOISE_MODEL: Record<Recipe["denoise"], string | null> = {
  light: null,
  voice: "sh",
  strong: "sh",
};

export function estimateAudioBytes(
  recipe: Recipe,
  facts: FileFacts,
  range: Range | null,
): number | null {
  const d = selected(range, facts) / (recipe.speed || 1);
  if (!d) return null;
  if (recipe.format === "wav")
    return Math.round(recipe.sampleRate * recipe.channels * 2 * d + 44);
  if (recipe.format === "flac")
    return Math.round(recipe.sampleRate * recipe.channels * 2 * d * 0.6);
  return Math.round(((recipe.bitrate * 1000) / 8) * d * 1.01);
}

export function turned(
  facts: FileFacts,
  recipe: Pick<Recipe, "rotate">,
): FileFacts {
  return recipe.rotate === 90 || recipe.rotate === 270
    ? { ...facts, width: facts.height, height: facts.width }
    : facts;
}

export type FrameUse = "social" | "crop" | null;

export function cropped(
  facts: FileFacts,
  recipe: Pick<Recipe, "aspect">,
): FileFacts {
  if (!facts.width || !facts.height) return facts;
  const a = ASPECT_RATIO[recipe.aspect];
  const w = Math.min(facts.width, facts.height * a),
    h = Math.min(facts.height, facts.width / a);
  return {
    ...facts,
    width: Math.floor(w / 2) * 2,
    height: Math.floor(h / 2) * 2,
  };
}

export const FAST_WORKLOAD = 2.5e9;

export function outputDims(
  size: VideoSize,
  facts: FileFacts,
): { w: number; h: number; scaled: boolean } | null {
  if (!facts.width || !facts.height) return null;
  const box =
    facts.height > facts.width ? { w: BOX[size].h, h: BOX[size].w } : BOX[size];
  const fit = Math.min(box.w / facts.width, box.h / facts.height, 1);
  const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
  return {
    w: even(facts.width * fit),
    h: even(facts.height * fit),
    scaled: fit < 1,
  };
}

export function sizeAboveSource(size: VideoSize, facts: FileFacts): boolean {
  const next: Partial<Record<VideoSize, VideoSize>> = {
    "1080p": "720p",
    "720p": "480p",
  };
  const smaller = next[size];
  return !!smaller && outputDims(smaller, facts)?.scaled === false;
}

export const crfFor = (sharpness: number) =>
  Math.round(34 - (Math.min(100, Math.max(0, sharpness)) / 100) * 16);

const bppAt = (crf: number) => 0.07 * Math.pow(2, (23 - crf) / 6);

interface VideoPlan {
  job: VideoJobOptions;
  estimate: number | null;
  dims: { w: number; h: number } | null;
}

export function videoPlan(
  recipe: Recipe,
  source: FileFacts,
  range: Range | null,
  use: FrameUse = null,
  music = false,
  cleans = false,
  captions = false,
): VideoPlan {
  const whole = isWhole(range, source);
  const spec = use === "social" ? PLATFORMS[recipe.platform] : null;
  const facts =
    use === "crop"
      ? cropped(turned(source, recipe), recipe)
      : turned(source, recipe);
  const d = selected(range, source) / (recipe.speed || 1);
  const dims = spec
    ? { w: spec.width, h: spec.height, scaled: true }
    : outputDims(recipe.size, facts);
  const audioKbps = !recipe.sound ? 0 : recipe.squeeze === "custom" ? 128 : 96;
  const pixels = dims ? dims.w * dims.h : 1280 * 720;
  const sourceKbps = facts.duration
    ? (facts.size * 8) / facts.duration / 1000
    : Infinity;
  const pixelRatio =
    facts.width && facts.height ? pixels / (facts.width * facts.height) : 1;
  const crfKbps = (crf: number) =>
    Math.min(
      (pixels * ASSUMED_FPS * bppAt(crf)) / 1000,
      sourceKbps * pixelRatio * Math.pow(2, (23 - crf) / 6),
    );

  let crf: number | null =
    recipe.squeeze === "custom" || spec ? crfFor(recipe.sharpness) : 23;
  let targetVideoKbps: number | null = null;
  let videoKbps = crfKbps(crf);
  const limit =
    spec?.maxBytes ??
    (!spec && recipe.squeeze !== "custom"
      ? SQUEEZE_TARGET_BYTES[recipe.squeeze]
      : null);
  if (limit && d > 0) {
    const budget = (limit * 0.92 * 8) / d / 1000 - audioKbps;
    if (crfKbps(23) > budget) {
      targetVideoKbps = Math.max(120, Math.floor(budget));
      videoKbps = targetVideoKbps;
      crf = null;
    }
  }
  const frame: VideoJobOptions["frame"] = spec
    ? {
        aspect: spec.width / spec.height,
        mode: recipe.fill,
        pos: 0.5,
        width: spec.width,
        height: spec.height,
      }
    : use === "crop"
      ? {
          aspect: ASPECT_RATIO[recipe.aspect],
          mode: "crop",
          pos: recipe.cropPos,
        }
      : null;
  if (recipe.videoFormat === "gif") {
    const w = facts.width
      ? Math.min(recipe.gifWidth, facts.width)
      : recipe.gifWidth;
    const h =
      facts.width && facts.height
        ? Math.round((w * facts.height) / facts.width)
        : Math.round((w * 9) / 16);
    return {
      job: {
        outputFormat: "gif",
        preset: "balanced",
        resizePreset: "original",
        removeAudio: true,
        gif: { fps: recipe.gifFps, width: recipe.gifWidth },
        speed: recipe.speed,
        rotate: recipe.rotate,
        flip: recipe.flip === "none" ? null : recipe.flip,
        frame,
        maxFps: null,
        trimStart: whole ? null : range!.start,
        trimEnd: whole ? null : range!.end,
      },
      estimate: d > 0 ? Math.round(w * h * recipe.gifFps * d * 0.05) : null,
      dims: { w, h },
    };
  }
  if (recipe.videoFormat === "webm" && !targetVideoKbps) videoKbps *= 1.25;
  if (
    !targetVideoKbps &&
    (dims ? dims.w * dims.h : 1280 * 720) * ASSUMED_FPS * d > FAST_WORKLOAD
  )
    videoKbps *= 1.3;
  const job: VideoJobOptions = {
    outputFormat: recipe.videoFormat,
    preset: "balanced",
    customCrf: crf,
    targetVideoKbps,
    audioBitrate: recipe.sound ? `${audioKbps}k` : null,
    resizePreset: spec ? "original" : dims?.scaled ? recipe.size : "original",
    speed: recipe.speed,
    rotate: recipe.rotate,
    flip: recipe.flip === "none" ? null : recipe.flip,
    frame,
    maxFps: spec?.fps ?? null,
    speedMode:
      (dims ? dims.w * dims.h : 1280 * 720) * ASSUMED_FPS * d > FAST_WORKLOAD
        ? "fast"
        : "normal",
    music:
      music && recipe.sound !== false
        ? {
            mode: recipe.musicMode,
            volume: recipe.musicVolume,
            originalVolume: recipe.originalVolume,
            duration: d,
          }
        : null,
    denoise: cleans ? { level: recipe.denoise } : null,
    subtitles: captions ? {} : null,
    removeAudio: !recipe.sound,
    trimStart: whole ? null : range!.start,
    trimEnd: whole ? null : range!.end,
  };
  return {
    job,
    estimate:
      d > 0 ? Math.round((((videoKbps + audioKbps) * 1000) / 8) * d) : null,
    dims: dims ? { w: dims.w, h: dims.h } : null,
  };
}

export function videoMergePlan(
  recipe: Recipe,
  first: FileFacts,
  seconds: number,
  bytes: number,
): Omit<VideoMergeOptions, "music"> {
  const { job, dims } = videoPlan(
    recipe,
    { ...first, duration: seconds, size: bytes },
    null,
  );
  return {
    outputFormat: job.outputFormat,
    preset: job.preset,
    customCrf: job.customCrf,
    targetVideoKbps: job.targetVideoKbps,
    audioBitrate: job.audioBitrate,
    speedMode: job.speedMode,
    width: dims?.w ?? 1280,
    height: dims?.h ?? 720,
    fps: 30,
    fit: recipe.mergeFit,
    transition: recipe.transition > 0 ? recipe.transition : null,
    sound: recipe.sound,
  };
}

export function formatSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(bytes >= 1e10 ? 0 : 1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(bytes >= 1e8 ? 0 : 1)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return `${bytes} B`;
}

export function savings(before: number, after: number): string {
  if (!before) return "";
  const p = Math.round((1 - after / before) * 100);
  return p >= 0 ? `−${p}%` : `+${-p}%`;
}

export function clock(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "0:00";
  const t = Math.round(sec);
  const m = Math.floor(t / 60),
    s = t % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function clockTenths(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) sec = 0;
  const t = Math.round(sec * 10) / 10;
  const m = Math.floor(t / 60),
    s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export function parseClock(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const parts = t.split(":");
  if (
    parts.length > 3 ||
    parts.some((p) => !/^\d*(\.\d*)?$/.test(p) || p === "" || p === ".")
  )
    return null;
  const n = parts.reduce((acc, p) => acc * 60 + parseFloat(p), 0);
  return Number.isFinite(n) ? n : null;
}

export function timeLeft(sec: number | null): string | null {
  if (sec == null || !Number.isFinite(sec)) return null;
  if (sec < 5) return "almost done";
  if (sec < 90) return `about ${Math.round(sec)} s left`;
  return `about ${Math.round(sec / 60)} min left`;
}

export function videoPlanFor(
  recipe: Recipe,
  facts: FileFacts,
  range: Range | null,
  music = false,
): VideoPlan {
  const use: FrameUse = recipe.frame === "none" ? null : recipe.frame;
  return videoPlan(
    recipe,
    facts,
    range,
    use,
    music,
    recipe.clean,
    recipe.captions,
  );
}
