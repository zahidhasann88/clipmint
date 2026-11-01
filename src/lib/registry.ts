import type { IconName } from "@/components/desk/icons";
import {
  SUPPORTED_AUDIO_INPUT_EXTS,
  SUPPORTED_VIDEO_INPUT_EXTS,
} from "@/media/formats";

export type Engine = "audio" | "video";

export type RecipeSection =
  | "format"
  | "quality"
  | "sampleRate"
  | "channels"
  | "fade"
  | "loudness"
  | "speed"
  | "denoise"
  | "silence"
  | "rotate"
  | "crop"
  | "social"
  | "fill"
  | "music"
  | "captions"
  | "transcript"
  | "size"
  | "squeeze"
  | "sound"
  | "videoFormat"
  | "gifSize"
  | "gifFps"
  | "crossfade"
  | "mergeVideo"
  | "overlay"
  | "blur"
  | "textcut"
  | "thumbnail"
  | "range";

export type AudioFormat =
  | "mp3"
  | "wav"
  | "flac"
  | "ogg"
  | "opus"
  | "m4a"
  | "aac";
export type VideoSize = "1080p" | "720p" | "480p";
export type Squeeze = "chat" | "email" | "custom";
export type Loudness = "off" | "voice" | "music" | "gentle";

export interface Recipe {
  format: AudioFormat;
  bitrate: number;
  sampleRate: 44100 | 48000;
  channels: 1 | 2;
  size: VideoSize;
  squeeze: Squeeze;
  sharpness: number;
  sound: boolean;
  videoFormat: "mp4" | "webm" | "gif";
  fadeIn: number;
  fadeOut: number;
  loudness: Loudness;
  gifWidth: 320 | 480 | 640;
  gifFps: 10 | 15 | 24;
  speed: Speed;
  rotate: 0 | 90 | 180 | 270;
  flip: "none" | "h" | "v";
  aspect: Aspect;
  cropPos: 0 | 0.5 | 1;
  follow: boolean;
  fill: "crop" | "blur" | "bars";
  platform: Platform;
  denoise: "light" | "voice" | "strong";
  silence: "ends" | "pauses";
  captionSize: "S" | "M" | "L";
  captionStyle: "classic" | "pop" | "word" | "box";
  captionColor: "yellow" | "mint" | "pink" | "white";
  captionPos: "bottom" | "middle";
  speechModel: "tiny" | "base";
  transcriptFormat: "txt" | "srt" | "vtt";
  language: string;
  musicMode: "mix" | "replace";
  musicVolume: number;
  originalVolume: number;
  frame: "none" | "crop" | "social";
  captions: boolean;
  clean: boolean;
  trimSilence: boolean;
  output: "file" | "audio" | "text";
  merge: boolean;
  crossfade: number;
  transition: number;
  mergeFit: "bars" | "crop";
  beatSync: boolean;
  overlayOn: boolean;
  overlayText: string;
  overlayPlace: "top" | "middle" | "bottom";
  overlayWhen: "all" | "start" | "end";
  logoCorner: "tl" | "tr" | "bl" | "br";
  logoSize: "S" | "M" | "L";
  blurFaces: boolean;
  textCut: boolean;
  fillers: boolean;
}
export type Aspect = "9:16" | "1:1" | "4:5" | "16:9";
export const ASPECT_RATIO: Record<Aspect, number> = {
  "9:16": 9 / 16,
  "1:1": 1,
  "4:5": 4 / 5,
  "16:9": 16 / 9,
};

export type Platform =
  | "tiktok"
  | "reels"
  | "shorts"
  | "igfeed"
  | "facebook"
  | "x"
  | "wastatus";
export interface PlatformSpec {
  name: string;
  width: number;
  height: number;
  maxSeconds: number | null;
  maxBytes: number | null;
  fps: number;
}
export const PLATFORMS: Record<Platform, PlatformSpec> = {
  tiktok: {
    name: "TikTok",
    width: 1080,
    height: 1920,
    maxSeconds: 600,
    maxBytes: null,
    fps: 30,
  },
  reels: {
    name: "Instagram Reels",
    width: 1080,
    height: 1920,
    maxSeconds: 180,
    maxBytes: null,
    fps: 30,
  },
  shorts: {
    name: "YouTube Shorts",
    width: 1080,
    height: 1920,
    maxSeconds: 180,
    maxBytes: null,
    fps: 30,
  },
  igfeed: {
    name: "Instagram post",
    width: 1080,
    height: 1350,
    maxSeconds: 60,
    maxBytes: null,
    fps: 30,
  },
  facebook: {
    name: "Facebook",
    width: 1080,
    height: 1350,
    maxSeconds: null,
    maxBytes: null,
    fps: 30,
  },
  x: {
    name: "X",
    width: 1280,
    height: 720,
    maxSeconds: 140,
    maxBytes: 512e6,
    fps: 30,
  },
  wastatus: {
    name: "WhatsApp Status",
    width: 1080,
    height: 1920,
    maxSeconds: 60,
    maxBytes: 16e6,
    fps: 30,
  },
};
export type Speed = 0.5 | 0.75 | 1 | 1.5 | 2 | 4;

export interface FileFacts {
  name: string;
  ext: string;
  size: number;
  engine: Engine | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  sampleRate: number | null;
  channels: number | null;
}

export interface Shelf {
  id: string;
  name: string;
  icon: IconName;
  tint: string;
  engine: Engine;
}

export interface Tool {
  shelf: string;
  output?: Engine | "text";
  id: string;
  name: string;
  icon: IconName;
  accepts: readonly string[];
  recipe: RecipeSection[];
  defaults?: Partial<Recipe>;
  suggestWhen?: (file: FileFacts) => boolean;
  soon?: boolean;
  multi?: boolean;
}

export const SHELVES: Shelf[] = [
  {
    id: "audio",
    name: "Audio",
    icon: "note",
    tint: "var(--tint-audio)",
    engine: "audio",
  },
  {
    id: "video",
    name: "Video",
    icon: "film",
    tint: "var(--tint-video)",
    engine: "video",
  },
];

const AUDIO_IN = SUPPORTED_AUDIO_INPUT_EXTS;
const VIDEO_IN = SUPPORTED_VIDEO_INPUT_EXTS;
const MB = 1e6;

export const SQUEEZE_TARGET_BYTES: Record<
  Exclude<Squeeze, "custom">,
  number
> = { chat: 25 * MB, email: 10 * MB };

export const TOOLS: Tool[] = [
  {
    shelf: "audio",
    id: "export",
    name: "Export",
    icon: "sliders",
    accepts: AUDIO_IN,
    recipe: ["format", "quality", "sampleRate", "channels"],
  },
  {
    shelf: "audio",
    id: "fade",
    name: "Fade",
    icon: "fade",
    accepts: AUDIO_IN,
    recipe: ["fade"],
    defaults: { fadeIn: 2, fadeOut: 3 },
  },
  {
    shelf: "audio",
    id: "speed",
    name: "Speed",
    icon: "speed",
    accepts: AUDIO_IN,
    recipe: ["speed"],
    defaults: { speed: 1.5 },
  },
  {
    shelf: "audio",
    id: "cleanup",
    name: "Clean up",
    icon: "wand",
    accepts: AUDIO_IN,
    recipe: ["denoise"],
    defaults: { denoise: "voice" },
  },
  {
    shelf: "audio",
    id: "silence",
    name: "Trim silences",
    icon: "silence",
    accepts: AUDIO_IN,
    recipe: ["silence"],
    defaults: { silence: "pauses" },
  },
  {
    shelf: "audio",
    id: "transcribe",
    name: "Transcribe",
    icon: "text",
    accepts: AUDIO_IN,
    output: "text",
    recipe: ["transcript"],
  },
  {
    shelf: "audio",
    id: "merge",
    name: "Merge",
    icon: "merge",
    accepts: AUDIO_IN,
    multi: true,
    recipe: ["crossfade"],
  },
  {
    shelf: "audio",
    id: "normalize",
    name: "Normalize",
    icon: "level",
    accepts: AUDIO_IN,
    recipe: ["loudness"],
    defaults: { loudness: "voice" },
  },

  {
    shelf: "video",
    id: "export",
    name: "Export",
    icon: "squeeze",
    accepts: VIDEO_IN,
    recipe: ["squeeze", "size", "sound", "videoFormat"],
  },
  {
    shelf: "video",
    id: "merge",
    name: "Merge",
    icon: "merge",
    accepts: VIDEO_IN,
    multi: true,
    recipe: ["mergeVideo"],
  },
  {
    shelf: "video",
    id: "social",
    name: "For social",
    icon: "phone",
    accepts: VIDEO_IN,
    recipe: ["social", "fill"],
    defaults: {
      platform: "reels",
      fill: "blur",
      squeeze: "custom",
      sharpness: 70,
    },
    suggestWhen: (f) => !!f.width && !!f.height && f.height > f.width,
  },
  {
    shelf: "video",
    id: "captions",
    name: "Captions",
    icon: "cc",
    accepts: VIDEO_IN,
    recipe: ["captions"],
    defaults: { captionSize: "M", squeeze: "custom", sharpness: 70 },
  },
  {
    shelf: "video",
    id: "textcut",
    name: "Cut by text",
    icon: "text",
    accepts: VIDEO_IN,
    recipe: ["textcut"],
  },
  {
    shelf: "video",
    id: "overlay",
    name: "Text & logo",
    icon: "plus",
    accepts: VIDEO_IN,
    recipe: ["overlay"],
    defaults: { squeeze: "custom", sharpness: 70 },
  },
  {
    shelf: "video",
    id: "blur",
    name: "Blur faces",
    icon: "wand",
    accepts: VIDEO_IN,
    recipe: ["blur"],
    defaults: { squeeze: "custom", sharpness: 70 },
  },
  {
    shelf: "video",
    id: "thumbnail",
    name: "Thumbnail",
    icon: "crop",
    accepts: VIDEO_IN,
    recipe: ["thumbnail"],
  },
  {
    shelf: "video",
    id: "jumpcut",
    name: "Jump cuts",
    icon: "silence",
    accepts: VIDEO_IN,
    recipe: ["silence"],
    defaults: { silence: "pauses" },
  },
  {
    shelf: "video",
    id: "crop",
    name: "Crop",
    icon: "crop",
    accepts: VIDEO_IN,
    recipe: ["crop"],
    defaults: { aspect: "1:1", cropPos: 0.5, squeeze: "custom", sharpness: 60 },
  },
  {
    shelf: "video",
    id: "speed",
    name: "Speed",
    icon: "speed",
    accepts: VIDEO_IN,
    recipe: ["speed"],
    defaults: { speed: 2, squeeze: "custom", sharpness: 60 },
  },
  {
    shelf: "video",
    id: "cleansound",
    name: "Clean sound",
    icon: "wand",
    accepts: VIDEO_IN,
    recipe: ["denoise"],
    defaults: { denoise: "voice", squeeze: "custom", sharpness: 70 },
  },
  {
    shelf: "video",
    id: "music",
    name: "Add music",
    icon: "music",
    accepts: VIDEO_IN,
    recipe: ["music"],
    defaults: {
      musicMode: "mix",
      musicVolume: 0.8,
      originalVolume: 0.6,
      squeeze: "custom",
      sharpness: 60,
    },
  },
  {
    shelf: "video",
    id: "gif",
    name: "To GIF",
    icon: "gif",
    accepts: VIDEO_IN,
    recipe: ["gifSize", "gifFps"],
    defaults: { videoFormat: "gif", sound: false },
    suggestWhen: (f) => f.duration != null && f.duration <= 6,
  },
  {
    shelf: "video",
    id: "rotate",
    name: "Rotate",
    icon: "rotate",
    accepts: VIDEO_IN,
    recipe: ["rotate"],
    defaults: { rotate: 90, squeeze: "custom", sharpness: 60 },
  },
  {
    shelf: "video",
    id: "extract",
    name: "Extract audio",
    icon: "note",
    accepts: VIDEO_IN,
    output: "audio",
    recipe: ["format", "quality", "sampleRate", "channels"],
    defaults: { format: "mp3", bitrate: 192 },
  },
];

export const TOOL_ALIASES: Record<string, string> = {
  "audio/convert": "audio/export",
  "audio/trim": "audio/export",
  "audio/wav-mp3": "audio/export",
  "audio/quality": "audio/export",
  "video/compress": "video/export",
  "video/share": "video/export",
  "video/resize": "video/export",
  "video/trim": "video/export",
  "video/mute": "video/export",
};

export function exportSections(
  output: Engine | "text",
  r: Pick<Recipe, "videoFormat" | "frame">,
): RecipeSection[] {
  if (output === "text") return ["transcript"];
  if (output === "audio")
    return ["format", "quality", "sampleRate", "channels"];
  if (r.videoFormat === "gif") return ["gifSize", "gifFps"];
  return r.frame === "social"
    ? ["squeeze", "sound", "videoFormat"]
    : ["squeeze", "size", "sound", "videoFormat"];
}

export const BASE_RECIPE: Recipe = {
  format: "mp3",
  bitrate: 192,
  sampleRate: 44100,
  channels: 2,
  size: "1080p",
  squeeze: "custom",
  sharpness: 50,
  sound: true,
  videoFormat: "mp4",
  fadeIn: 0,
  fadeOut: 0,
  loudness: "off",
  gifWidth: 480,
  gifFps: 15,
  speed: 1,
  rotate: 0,
  flip: "none",
  denoise: "voice",
  silence: "pauses",
  captionSize: "M",
  transcriptFormat: "srt",
  language: "en",
  captionStyle: "pop",
  captionColor: "yellow",
  captionPos: "bottom",
  speechModel: "tiny",
  aspect: "1:1",
  cropPos: 0.5,
  follow: false,
  fill: "blur",
  platform: "reels",
  musicMode: "mix",
  musicVolume: 0.8,
  originalVolume: 0.6,
  frame: "none",
  captions: false,
  clean: false,
  trimSilence: false,
  output: "file",
  merge: false,
  crossfade: 0,
  transition: 0,
  mergeFit: "bars",
  beatSync: false,
  overlayOn: false,
  overlayText: "",
  overlayPlace: "bottom",
  overlayWhen: "all",
  logoCorner: "tr",
  logoSize: "M",
  blurFaces: false,
  textCut: false,
  fillers: false,
};

export const toolKey = (t: Pick<Tool, "shelf" | "id">) => `${t.shelf}/${t.id}`;
export function getTool(key: string | null | undefined): Tool | null {
  if (!key) return null;
  const k = TOOL_ALIASES[key] ?? key;
  return TOOLS.find((t) => toolKey(t) === k) ?? null;
}
export const getShelf = (id: string) => SHELVES.find((s) => s.id === id)!;
export function accepts(
  tool: Tool,
  facts: Pick<FileFacts, "ext" | "engine">,
): boolean {
  if (tool.accepts.includes(facts.ext)) return true;
  return (
    !ALL_INPUT_EXTS.includes(facts.ext) &&
    facts.engine === getShelf(tool.shelf).engine &&
    tool.accepts.length > 2
  );
}

export function engineFor(ext: string, mime: string): Engine | null {
  if (VIDEO_IN.includes(ext)) return "video";
  if (AUDIO_IN.includes(ext)) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}

export const ALL_INPUT_EXTS = Array.from(
  new Set(TOOLS.flatMap((t) => t.accepts)),
);

export function suggestionsFor(
  facts: FileFacts,
  preferred?: string | null,
  count = 1,
): { main: Tool | null; others: Tool[] } {
  const fits = TOOLS.filter(
    (t) => !t.soon && accepts(t, facts) && (!t.multi || count > 1),
  );
  const pre = preferred
    ? fits.find((t) => t === getTool(preferred))
    : undefined;
  const main =
    pre ?? fits.find((t) => t.suggestWhen?.(facts)) ?? fits[0] ?? null;
  return { main, others: fits.filter((t) => t !== main) };
}

export function recipeFor(tool: Tool, facts: FileFacts): Recipe {
  const fromSource: Partial<Recipe> = {};
  if (facts.sampleRate === 48000) fromSource.sampleRate = 48000;
  if (facts.channels === 1) fromSource.channels = 1;
  if (facts.height && facts.width && (tool.output ?? "video") === "video") {
    const short = Math.min(facts.width, facts.height);
    fromSource.size = short <= 480 ? "480p" : short <= 720 ? "720p" : "1080p";
  }
  const r = { ...BASE_RECIPE, ...fromSource, ...tool.defaults };
  if (
    fromSource.size &&
    SIZE_ORDER.indexOf(r.size) < SIZE_ORDER.indexOf(fromSource.size)
  )
    r.size = fromSource.size;
  if (r.format === "opus") r.sampleRate = 48000;
  return r;
}
export const SIZE_ORDER: VideoSize[] = ["1080p", "720p", "480p"];
