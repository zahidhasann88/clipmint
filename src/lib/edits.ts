import { BASE_RECIPE, PLATFORMS, SIZE_ORDER, getTool, recipeFor, type Engine, type FileFacts, type Recipe, type RecipeSection, type Tool } from "./registry";

export interface EditCtx {
  engine: Engine;
  music: File | null;
  logo?: File | null;
  range: { start: number; end: number } | null;
  duration: number | null;
  count: number;
}

export interface EditDef {
  on: (r: Recipe, c: EditCtx) => boolean;
  enable?: (r: Recipe) => Partial<Recipe>;
  disable?: Partial<Recipe>;
  label: (r: Recipe, c: EditCtx) => string;
  own?: RecipeSection[];
  skipped?: (r: Recipe, c: EditCtx) => string | null;
}

const m = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const trimmed = (c: EditCtx) => !!c.range && !!c.duration && (c.range.start > 0.05 || c.range.end < c.duration - 0.05);

const notAudioOnly = (r: Recipe) => (r.output === "audio" ? "not in audio only" : null);
const picture = (r: Recipe) => notAudioOnly(r);
const sound = (r: Recipe) => notAudioOnly(r) ?? (r.videoFormat === "gif" ? "a GIF has no sound" : null);
const audioEdit = (r: Recipe, c: EditCtx) => (r.output === "text" ? "not in a transcript" : c.count > 1 && r.merge ? "not when merging" : null);

const speed: EditDef = {
  on: (r) => r.speed !== 1,
  enable: (r) => ({ speed: r.speed !== 1 ? r.speed : 1.5 }),
  disable: { speed: 1 },
  label: (r) => `Speed ${r.speed}×`,
  own: ["speed"],
};
const trim: EditDef = {
  on: (_r, c) => trimmed(c),
  label: (_r, c) => `Trim ${m(c.range!.start)}–${m(c.range!.end)}`,
};
const clean = (name: string): EditDef => ({
  on: (r) => r.clean,
  enable: () => ({ clean: true }),
  disable: { clean: false },
  label: (r) => `${name} · ${r.denoise}`,
  own: ["denoise"],
});

export const EDITS: Record<string, EditDef> = {
  // ── Audio ──
  "audio/trim": trim,
  "audio/fade": {
    on: (r) => r.fadeIn > 0 || r.fadeOut > 0,
    enable: () => ({ fadeIn: 2, fadeOut: 3 }),
    disable: { fadeIn: 0, fadeOut: 0 },
    label: (r) => `Fade ${r.fadeIn ? `in ${r.fadeIn}s` : ""}${r.fadeIn && r.fadeOut ? " · " : ""}${r.fadeOut ? `out ${r.fadeOut}s` : ""}`,
    own: ["fade"],
    skipped: (r) => (r.output === "text" ? "not in a transcript" : null),
  },
  "audio/speed": { ...speed, enable: (r) => ({ speed: r.speed !== 1 ? r.speed : 1.5 }), skipped: audioEdit },
  "audio/cleanup": { ...clean("Clean up"), skipped: audioEdit },
  "audio/silence": {
    on: (r) => r.trimSilence,
    enable: () => ({ trimSilence: true }),
    disable: { trimSilence: false },
    label: (r) => (r.silence === "ends" ? "Trim quiet ends" : "Shorten pauses"),
    own: ["silence"],
    skipped: audioEdit,
  },
  "audio/normalize": {
    on: (r) => r.loudness !== "off",
    enable: (r) => ({ loudness: r.loudness !== "off" ? r.loudness : "voice" }),
    disable: { loudness: "off" },
    label: (r) => `Loudness · ${r.loudness}`,
    own: ["loudness"],
    skipped: (r) => (r.output === "text" ? "not in a transcript" : null),
  },
  "audio/transcribe": {
    on: (r) => r.output === "text",
    enable: () => ({ output: "text" }),
    disable: { output: "file" },
    label: (r) => `Transcript .${r.transcriptFormat}`,
    own: ["transcript"],
    skipped: (r, c) => (c.count > 1 && r.merge ? "not when merging" : null),
  },
  "audio/merge": {
    on: (r, c) => r.merge && c.count > 1,
    enable: () => ({ merge: true }),
    disable: { merge: false },
    label: (r, c) => `Merge ${c.count} files${r.crossfade ? ` · ${r.crossfade}s crossfade` : ""}`,
    own: ["crossfade"],
  },
  "video/merge": {
    on: (r, c) => r.merge && c.count > 1,
    enable: () => ({ merge: true }),
    disable: { merge: false, beatSync: false },
    label: (r, c) => `Merge ${c.count} clips${r.beatSync ? " · on the beat" : r.transition ? ` · ${r.transition}s fade` : ""}`,
    own: ["mergeVideo"],
    skipped: (r) => notAudioOnly(r) ?? (r.videoFormat === "gif" ? "not in a GIF" : null),
  },
  "video/overlay": {
    on: (r) => r.overlayOn,
    enable: () => ({ overlayOn: true }),
    disable: { overlayOn: false },
    label: (r, c) => [r.overlayText.trim() ? "Text" : null, c.logo ? "Logo" : null].filter(Boolean).join(" & ") || "Text & logo",
    own: ["overlay"],
    skipped: (r, c) => picture(r) ?? (r.videoFormat === "gif" ? "not in a GIF" : !r.overlayText.trim() && !c.logo ? "add text or a logo" : null),
  },
  "video/blur": {
    on: (r) => r.blurFaces,
    enable: () => ({ blurFaces: true }),
    disable: { blurFaces: false },
    label: () => "Blur faces",
    own: ["blur"],
    skipped: picture,
  },
  "video/textcut": {
    on: (r) => r.textCut || r.fillers,
    enable: () => ({ textCut: true }),
    disable: { textCut: false, fillers: false },
    label: (r) => (r.fillers ? (r.textCut ? "Cut by text · no fillers" : "No filler words") : "Cut by text"),
    own: ["textcut"],
  },
  "video/trim": trim,
  "video/speed": { ...speed, enable: (r) => ({ speed: r.speed !== 1 ? r.speed : 2 }) },
  "video/rotate": {
    on: (r) => r.rotate !== 0 || r.flip !== "none",
    enable: (r) => (r.rotate || r.flip !== "none" ? {} : { rotate: 90 }),
    disable: { rotate: 0, flip: "none" },
    label: (r) => [r.rotate ? `Turn ${r.rotate}°` : null, r.flip === "h" ? "Mirror" : r.flip === "v" ? "Flip" : null].filter(Boolean).join(" · "),
    own: ["rotate"],
    skipped: picture,
  },
  "video/crop": {
    on: (r) => r.frame === "crop",
    enable: () => ({ frame: "crop" }),
    disable: { frame: "none" },
    label: (r) => `Crop ${r.aspect}${r.follow ? " · follows faces" : ""}`,
    own: ["crop"],
    skipped: picture,
  },
  "video/social": {
    on: (r) => r.frame === "social",
    enable: () => ({ frame: "social" }),
    disable: { frame: "none" },
    label: (r) => `For ${PLATFORMS[r.platform].name}`,
    own: ["social", "fill"],
    skipped: picture,
  },
  "video/music": {
    on: (_r, c) => !!c.music,
    label: (_r, c) => `Music · ${c.music?.name ?? ""}`,
    skipped: sound,
  },
  "video/captions": {
    on: (r) => r.captions,
    enable: () => ({ captions: true }),
    disable: { captions: false },
    label: (r) => `Captions · ${r.captionStyle === "word" ? "one word" : r.captionStyle}`,
    own: ["captions"],
    skipped: (r) => notAudioOnly(r) ?? (r.videoFormat === "gif" ? "not in a GIF" : null),
  },
  "video/cleansound": { ...clean("Clean sound"), skipped: sound },
  "video/jumpcut": {
    on: (r) => r.trimSilence,
    enable: () => ({ trimSilence: true }),
    disable: { trimSilence: false },
    label: (r) => (r.silence === "ends" ? "Trim quiet ends" : "Jump cuts"),
    own: ["silence"],
  },
  "video/extract": {
    on: (r) => r.output === "audio",
    enable: () => ({ output: "audio" }),
    disable: { output: "file" },
    label: (r) => `Audio only · ${r.format.toUpperCase()}`,
    own: ["format", "quality", "sampleRate", "channels"],
  },
  "video/gif": {
    on: (r) => r.videoFormat === "gif",
    enable: () => ({ videoFormat: "gif" }),
    disable: { videoFormat: "mp4" },
    label: (r) => `GIF · ${r.gifWidth}px`,
    own: ["gifSize", "gifFps"],
    skipped: notAudioOnly,
  },
};

for (const key of ["video/speed", "video/rotate", "video/crop", "video/social", "video/captions", "video/cleansound", "video/jumpcut", "video/overlay", "video/blur", "video/textcut"]) {
  const e = EDITS[key], own = e.skipped;
  e.skipped = (r, c) => (c.count > 1 && r.merge ? "not when merging" : own?.(r, c) ?? null);
}

export function outputKind(engine: Engine, r: Recipe): "audio" | "video" | "text" {
  if (engine === "video") return r.output === "audio" ? "audio" : "video";
  return r.output === "text" ? "text" : "audio";
}

export const merging = (engine: Engine, r: Recipe, count: number) =>
  r.merge && count > 1 && (engine === "audio" ? r.output !== "text" : r.output !== "audio" && r.videoFormat !== "gif");

export interface ActiveEdit { key: string; label: string; skipped: string | null }

export function activeEdits(r: Recipe, c: EditCtx, tools: Tool[]): ActiveEdit[] {
  const out: ActiveEdit[] = [];
  for (const key of [`${c.engine}/trim`, ...tools.map((t) => `${t.shelf}/${t.id}`)]) {
    const e = EDITS[key];
    if (!e || !e.on(r, c)) continue;
    out.push({ key, label: e.label(r, c), skipped: e.skipped?.(r, c) ?? null });
  }
  return out;
}

export function toggle(key: string, on: boolean, r: Recipe): Partial<Recipe> {
  const e = EDITS[key];
  if (!e) return {};
  return on ? e.enable?.(r) ?? {} : e.disable ?? {};
}

export function startRecipe(facts: FileFacts, saved: Partial<Recipe>, tool?: Tool | null, route?: Partial<Recipe>): Recipe {
  const fromFile = recipeFor({ ...(tool ?? getTool("audio/export")!), defaults: undefined }, facts);
  const r: Recipe = { ...fromFile, ...saved };
  Object.assign(r, route);
  for (const k of ["frame", "captions", "clean", "trimSilence", "output", "merge", "beatSync", "overlayOn", "blurFaces", "textCut", "fillers", "speed", "rotate", "flip", "fadeIn", "fadeOut", "loudness", "videoFormat", "sound"] as const) {
    if (route && k in route) continue;
    if (k === "videoFormat") { if (r.videoFormat === "gif") r.videoFormat = "mp4"; continue; }
    (r as unknown as Record<string, unknown>)[k] = BASE_RECIPE[k];
  }
  if (facts.width && facts.height && SIZE_ORDER.indexOf(r.size) < SIZE_ORDER.indexOf(fromFile.size)) r.size = fromFile.size;
  if (r.format === "opus") r.sampleRate = 48000;
  return r;
}
