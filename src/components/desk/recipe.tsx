"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Icon, Leaf, PauseGlyph, PlayGlyph } from "./icons";
import { FilePick } from "./mat";
import {
  ASPECT_RATIO,
  PLATFORMS,
  SIZE_ORDER,
  exportSections,
  getShelf,
  type Aspect,
  type AudioFormat,
  type FileFacts,
  type Platform,
  type Recipe,
  type RecipeSection,
  type Tool,
} from "@/lib/registry";
import {
  AUDIO_BITRATES,
  LOSSLESS,
  LUFS,
  QUALITY_PRESETS,
  clock,
  formatSize,
  savings,
  sizeAboveSource,
  turned,
  type Range,
} from "@/media/recipe";
import { AUDIO_FORMATS as AUDIO_INPUTS } from "@/media/formats";
import {
  LANGUAGES,
  MODEL_MB,
  speechModels,
  type Segment,
  type SpeechModel,
} from "@/media/captions";
import { CAPTION_COLORS } from "@/media/captions/ass";
import { canTranslate } from "@/media/captions/translate";
import { findFrames, saveFrame, type FramePick } from "@/media/frames";
import { downloadBlob } from "@/media/files";
import type { ActiveEdit } from "@/lib/edits";
import type { CaptionCheck, CaptionDraft } from "./desk-state";
import { recipeStamps } from "./brew";
import { cn } from "@/lib/utils";

type Set = (patch: Partial<Recipe>) => void;
export interface RecipeExtras {
  music?: File | null;
  setMusic?: (f: File | null) => void;
  logo?: File | null;
  setLogo?: (f: File | null) => void;
  file?: File | null;
  range?: Range | null;
  setRange?: (r: Range) => void;
  captions?: {
    draft: CaptionDraft | null;
    lines: Segment[] | null;
    check: CaptionCheck;
    onCheck: () => void;
    onStop: () => void;
    onLine: (index: number, text: string) => void;
    onImport: (file: File) => void;
    onTranslate: (to: string) => void;
    onRestore: () => void;
    onToggleCut: (word: Range) => void;
    onClearCuts: () => void;
  };
  preview?: (
    kind: "clean" | "loudness",
    signal: AbortSignal,
  ) => Promise<{ before: Blob; after: Blob }>;
}
interface SectionProps {
  recipe: Recipe;
  set: Set;
  facts: FileFacts;
  tool: Tool;
  extras: RecipeExtras;
}

const AUDIO_FORMATS: { id: AudioFormat; name: string }[] = [
  { id: "mp3", name: "MP3" },
  { id: "wav", name: "WAV" },
  { id: "flac", name: "FLAC" },
  { id: "ogg", name: "OGG" },
  { id: "opus", name: "Opus" },
  { id: "m4a", name: "M4A" },
  { id: "aac", name: "AAC" },
];

const SECTION_NAME: Record<RecipeSection, string> = {
  format: "format",
  quality: "quality",
  sampleRate: "sample rate",
  channels: "channels",
  size: "size",
  squeeze: "squeeze",
  sound: "sound",
  videoFormat: "format",
  range: "",
  fade: "fade",
  loudness: "loudness",
  gifSize: "size",
  gifFps: "frame rate",
  speed: "speed",
  rotate: "turn",
  crop: "shape",
  social: "where",
  fill: "fill",
  music: "song",
  denoise: "clean-up",
  silence: "silences",
  captions: "captions",
  transcript: "file type",
  crossfade: "crossfade",
  mergeVideo: "merge",
  overlay: "text & logo",
  blur: "blur",
  textcut: "words",
  thumbnail: "frames",
};

const HALF: RecipeSection[] = [
  "sampleRate",
  "channels",
  "sound",
  "videoFormat",
  "gifFps",
];

function Legend({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <legend id={id} className="legend mb-2.5 p-0 max-sm:mb-2 max-sm:text-xs">
      {children}
    </legend>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: {
    id: T;
    label: React.ReactNode;
    aria?: string;
    disabled?: boolean;
    hint?: string;
  }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-[14px] bg-track p-[3px]">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={String(o.id)}
            type="button"
            aria-pressed={on}
            aria-label={o.aria}
            aria-disabled={o.disabled || undefined}
            title={o.hint}
            onClick={() => !o.disabled && onChange(o.id)}
            className={cn(
              "grid min-h-10 flex-1 place-items-center rounded-[11px] border-0 text-sm font-extrabold",
              on ? "bg-primary text-on-primary" : "bg-transparent text-ink",
              o.disabled && "opacity-50",
            )}
          >
            {o.label}
            {o.hint && <span className="sr-only">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

const tile = (on: boolean) =>
  cn("border-2 border-edge", on ? "shadow-sticker" : "shadow-none");

function FormatSection({ recipe, set }: SectionProps) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <Legend>Format</Legend>
      <div className="grid grid-cols-3 gap-2 max-sm:-mr-4 max-sm:flex max-sm:overflow-x-auto scroll-row max-sm:pb-1.5 max-sm:pr-4">
        {AUDIO_FORMATS.map((f) => {
          const on = recipe.format === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => set({ format: f.id })}
              className={cn(
                tile(on),
                "min-h-tap rounded-[12px_14px_12px_10px] text-[15px] font-extrabold max-sm:min-w-16 max-sm:flex-none",
                on ? "bg-primary text-on-primary" : "bg-paper text-ink",
              )}
            >
              {f.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function QualitySection({ recipe, set, tool }: SectionProps) {
  const id = useId();
  const idx = Math.max(
    0,
    AUDIO_BITRATES.findIndex((b) => b >= recipe.bitrate),
  );
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <Legend>Quality</Legend>
      <div className="grid grid-cols-3 gap-2">
        {QUALITY_PRESETS.map((p) => {
          const on = recipe.bitrate === p.kbps;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => set({ bitrate: p.kbps })}
              className={cn(
                tile(on),
                "flex flex-col items-center gap-1 rounded-[16px_18px_16px_14px] px-1 py-2.5 text-ink max-sm:gap-0.5 max-sm:py-2",
              )}
              style={{
                background: on ? getShelf(tool.shelf).tint : "var(--paper)",
              }}
            >
              <Leaf
                size={p.leaf}
                fill="var(--ill-sage)"
                stroke="var(--ill-line)"
              />
              <span className="text-sm font-extrabold max-sm:text-[13px]">
                {p.name}
              </span>
              <span className="text-xs font-bold text-ink-soft max-sm:text-[11px]">
                <span className="max-sm:hidden">{p.kbps} kbps</span>
                <span className="sm:hidden">{p.kbps}k</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-sm font-extrabold max-sm:hidden">
        <label htmlFor={id} className="flex-none">
          bitrate
        </label>
        <input
          id={id}
          type="range"
          min={0}
          max={AUDIO_BITRATES.length - 1}
          step={1}
          value={idx}
          aria-valuetext={`${AUDIO_BITRATES[idx]} kbps`}
          onChange={(e) => set({ bitrate: AUDIO_BITRATES[+e.target.value] })}
          className="h-8 min-w-0 flex-1"
        />
        <output
          htmlFor={id}
          className="min-w-[74px] flex-none text-right tabular-nums"
        >
          {AUDIO_BITRATES[idx]} kbps
        </output>
      </div>
    </fieldset>
  );
}

function SampleRateSection({ recipe, set }: SectionProps) {
  const opus = recipe.format === "opus";
  return (
    <fieldset className="m-0 border-0 p-0">
      <Legend>Sample rate</Legend>
      <Segmented
        value={recipe.sampleRate}
        onChange={(v) => set({ sampleRate: v })}
        options={[
          {
            id: 44100,
            label: "44.1k",
            disabled: opus,
            hint: opus ? "Opus is always 48 kHz" : undefined,
          },
          { id: 48000, label: "48k" },
        ]}
      />
    </fieldset>
  );
}

function ChannelsSection({ recipe, set }: SectionProps) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <Legend>Channels</Legend>
      <Segmented
        value={recipe.channels}
        onChange={(v) => set({ channels: v })}
        options={[
          {
            id: 1,
            aria: "Mono",
            label: (
              <svg
                width="26"
                height="18"
                viewBox="0 0 26 18"
                aria-hidden="true"
              >
                <circle
                  cx="13"
                  cy="9"
                  r="6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                />
              </svg>
            ),
          },
          {
            id: 2,
            aria: "Stereo",
            label: (
              <svg
                width="26"
                height="18"
                viewBox="0 0 26 18"
                aria-hidden="true"
              >
                <circle
                  cx="8"
                  cy="9"
                  r="5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                />
                <circle
                  cx="18"
                  cy="9"
                  r="5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                />
              </svg>
            ),
          },
        ]}
      />
    </fieldset>
  );
}

const SIZE_ICON = {
  "1080p": [36, 22],
  "720p": [28, 17],
  "480p": [20, 12],
} as const;

function SizeSection({ recipe, set, facts }: SectionProps) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <Legend>Size</Legend>
      <div className="grid grid-cols-3 gap-2">
        {SIZE_ORDER.map((s) => {
          const on = recipe.size === s;
          const above = sizeAboveSource(s, turned(facts, recipe));
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              aria-disabled={above || undefined}
              onClick={() => !above && set({ size: s })}
              title={above ? "Bigger than your video" : undefined}
              className={cn(
                tile(on),
                "flex flex-col items-center gap-1.5 rounded-[16px_18px_16px_14px] px-1 pb-2.5 pt-3",
                on ? "bg-primary text-on-primary" : "bg-paper text-ink",
                above && "opacity-50",
              )}
            >
              <span
                aria-hidden="true"
                className="grid h-7 w-11 place-items-[end_start]"
              >
                <span
                  className="block rounded border-2 border-current"
                  style={{ width: SIZE_ICON[s][0], height: SIZE_ICON[s][1] }}
                />
              </span>
              <span className="text-[15px] font-extrabold">{s}</span>
              {above && <span className="sr-only">bigger than your video</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SqueezeSection({ recipe, set }: SectionProps) {
  const id = useId();
  const chips: { id: Recipe["squeeze"]; label: string }[] = [
    { id: "chat", label: "chat · 25 MB" },
    { id: "email", label: "email · 10 MB" },
    { id: "custom", label: "custom" },
  ];
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <Legend>Squeeze</Legend>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const on = recipe.squeeze === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => set({ squeeze: c.id })}
              className={cn(
                "inline-flex min-h-tap items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-extrabold",
                on
                  ? "border-edge bg-accent text-on-accent shadow-sticker"
                  : "border-line bg-transparent text-ink",
              )}
            >
              {on && c.id !== "custom" && <Icon name="plane" size={16} />}
              {c.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2.5 text-[13px] font-extrabold text-ink-soft">
        <span aria-hidden="true">smaller</span>
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          value={recipe.sharpness}
          aria-label="Squeeze: smaller to sharper"
          onChange={(e) =>
            set({ sharpness: +e.target.value, squeeze: "custom" })
          }
          className="h-8 min-w-0 flex-1"
        />
        <span aria-hidden="true">sharper</span>
      </div>
    </fieldset>
  );
}

function SoundSection({ recipe, set }: SectionProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2.5">
      <span id={id} className="legend max-sm:text-xs">
        Sound
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={recipe.sound}
        aria-labelledby={id}
        onClick={() => set({ sound: !recipe.sound })}
        className="flex min-h-tap items-center gap-2.5 rounded-full border-2 border-line bg-paper py-0 pl-1 pr-3 text-sm font-extrabold text-ink"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex h-7 w-[46px] items-center rounded-full p-[3px]",
            recipe.sound ? "justify-end bg-primary" : "bg-track",
          )}
        >
          <span
            className={cn(
              "h-[22px] w-[22px] rounded-full",
              recipe.sound ? "bg-on-primary" : "bg-ink-soft",
            )}
          />
        </span>
        <Icon name={recipe.sound ? "sound" : "mute"} size={20} />
        {recipe.sound ? "on" : "off"}
      </button>
    </div>
  );
}

function VideoFormatSection({ recipe, set }: SectionProps) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <Legend>Format</Legend>
      <Segmented
        value={recipe.videoFormat}
        onChange={(v) => set({ videoFormat: v })}
        options={[
          { id: "mp4", label: "MP4" },
          { id: "webm", label: "WebM" },
        ]}
      />
    </fieldset>
  );
}

function FadeSection({ recipe, set }: SectionProps) {
  const idIn = useId(),
    idOut = useId();
  const row = (
    id: string,
    label: string,
    value: number,
    key: "fadeIn" | "fadeOut",
  ) => (
    <div className="flex items-center gap-3 text-sm font-extrabold">
      <label htmlFor={id} className="w-8 flex-none">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={value}
        aria-valuetext={`${value} seconds`}
        onChange={(e) => set({ [key]: +e.target.value } as Partial<Recipe>)}
        className="h-8 min-w-0 flex-1"
      />
      <output htmlFor={id} className="w-12 flex-none text-right tabular-nums">
        {value ? `${value} s` : "off"}
      </output>
    </div>
  );
  return (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
      <Legend>Fade</Legend>
      <svg aria-hidden="true" viewBox="0 0 200 36" className="mb-1 h-9 w-full">
        <path
          d={`M4 32L${4 + recipe.fadeIn * 9} 6H${196 - recipe.fadeOut * 9}L196 32Z`}
          fill="var(--tint-audio)"
          stroke="var(--edge)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {row(idIn, "in", recipe.fadeIn, "fadeIn")}
      {row(idOut, "out", recipe.fadeOut, "fadeOut")}
    </fieldset>
  );
}

const LOUDNESS: {
  id: Exclude<Recipe["loudness"], "off">;
  name: string;
  icon: number;
}[] = [
  { id: "voice", name: "Voice", icon: 3 },
  { id: "music", name: "Music", icon: 4 },
  { id: "gentle", name: "Gentle", icon: 2 },
];
function LoudnessSection({ recipe, set, tool, extras }: SectionProps) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <Legend>Loudness</Legend>
      <div className="grid grid-cols-3 gap-2">
        {LOUDNESS.map((l) => {
          const on = recipe.loudness === l.id;
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={on}
              onClick={() => set({ loudness: l.id })}
              className={cn(
                tile(on),
                "flex flex-col items-center gap-1 rounded-[16px_18px_16px_14px] px-1 py-2.5 text-ink",
              )}
              style={{
                background: on ? getShelf(tool.shelf).tint : "var(--paper)",
              }}
            >
              <span aria-hidden="true" className="flex h-6 items-end gap-[3px]">
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    className="w-[3px] rounded-sm bg-primary"
                    style={{ height: 6 + (i < l.icon ? 4 * l.icon : 4) }}
                  />
                ))}
              </span>
              <span className="text-sm font-extrabold">{l.name}</span>
              <span className="text-xs font-bold text-ink-soft">
                {LUFS[l.id]} LUFS
              </span>
            </button>
          );
        })}
      </div>
      {extras.preview && (
        <BeforeAfter
          kind="loudness"
          setting={recipe.loudness}
          run={extras.preview}
        />
      )}
    </fieldset>
  );
}

function GifSizeSection({ recipe, set }: SectionProps) {
  const sizes: Recipe["gifWidth"][] = [320, 480, 640];
  return (
    <fieldset className="m-0 border-0 p-0">
      <Legend>Size</Legend>
      <div className="grid grid-cols-3 gap-2">
        {sizes.map((w, i) => {
          const on = recipe.gifWidth === w;
          return (
            <button
              key={w}
              type="button"
              aria-pressed={on}
              onClick={() => set({ gifWidth: w })}
              className={cn(
                tile(on),
                "flex flex-col items-center gap-1.5 rounded-[16px_18px_16px_14px] px-1 pb-2.5 pt-3",
                on ? "bg-primary text-on-primary" : "bg-paper text-ink",
              )}
            >
              <span
                aria-hidden="true"
                className="grid h-7 w-11 place-items-[end_start]"
              >
                <span
                  className="block rounded border-2 border-current"
                  style={{ width: 20 + i * 8, height: 12 + i * 5 }}
                />
              </span>
              <span className="text-[15px] font-extrabold">{w} px</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function GifFpsSection({ recipe, set }: SectionProps) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <Legend>Frame rate</Legend>
      <Segmented
        value={recipe.gifFps}
        onChange={(v) => set({ gifFps: v })}
        options={[
          { id: 10, label: "10" },
          { id: 15, label: "15" },
          { id: 24, label: "24", aria: "24 frames per second" },
        ]}
      />
    </fieldset>
  );
}

const SPEEDS: Recipe["speed"][] = [0.5, 0.75, 1.5, 2, 4];
function SpeedSection({ recipe, set, facts }: SectionProps) {
  const d = facts.duration;
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <Legend>Speed</Legend>
      <div className="flex flex-wrap gap-2">
        {SPEEDS.map((v) => {
          const on = recipe.speed === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => set({ speed: v })}
              aria-label={`${v} times speed`}
              className={cn(
                "min-h-tap min-w-[54px] rounded-full border-2 px-3 text-[15px] font-extrabold tabular-nums",
                on
                  ? "border-edge bg-accent text-on-accent shadow-sticker"
                  : "border-line bg-transparent text-ink",
              )}
            >
              {v}×
            </button>
          );
        })}
      </div>
      {d != null && (
        <p
          className="m-0 text-[13px] font-extrabold text-ink-soft"
          aria-live="polite"
        >
          {clock(d)} → {clock(d / recipe.speed)} · sound keeps its pitch
        </p>
      )}
    </fieldset>
  );
}

function RotateSection({ recipe, set }: SectionProps) {
  const turns: {
    id: Recipe["rotate"];
    label: string;
    icon: "rotateLeft" | "rotateRight" | null;
  }[] = [
    { id: 270, label: "Turn left", icon: "rotateLeft" },
    { id: 90, label: "Turn right", icon: "rotateRight" },
    { id: 180, label: "Upside down", icon: null },
  ];
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <Legend>Turn</Legend>
      <div className="grid grid-cols-3 gap-2">
        {turns.map((t) => {
          const on = recipe.rotate === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => set({ rotate: on ? 0 : t.id })}
              className={cn(
                tile(on),
                "flex flex-col items-center gap-1 rounded-[16px_18px_16px_14px] px-1 py-2.5",
                on ? "bg-primary text-on-primary" : "bg-paper text-ink",
              )}
            >
              {t.icon ? (
                <Icon name={t.icon} size={24} />
              ) : (
                <span
                  aria-hidden="true"
                  className="font-display text-xl font-extrabold leading-6"
                >
                  180°
                </span>
              )}
              <span className="text-[13px] font-extrabold">{t.label}</span>
            </button>
          );
        })}
      </div>
      <Segmented
        value={recipe.flip}
        onChange={(v) => set({ flip: v })}
        options={[
          { id: "none", label: "no mirror" },
          {
            id: "h",
            aria: "Mirror left to right",
            label: <Icon name="flipH" />,
          },
          { id: "v", aria: "Flip top to bottom", label: <Icon name="flipV" /> },
        ]}
      />
    </fieldset>
  );
}

const ASPECTS: Aspect[] = ["9:16", "1:1", "4:5", "16:9"];
function AspectIcon({ a }: { a: Aspect }) {
  const r = ASPECT_RATIO[a],
    h = 24,
    w = Math.round(h * r);
  return (
    <span
      aria-hidden="true"
      className="block rounded-[4px] border-2 border-current"
      style={{
        width: Math.min(w, 36),
        height: w > 36 ? Math.round(36 / r) : h,
      }}
    />
  );
}

function CropSection({ recipe, set, facts }: SectionProps) {
  const wide =
    facts.width && facts.height
      ? facts.width / facts.height > ASPECT_RATIO[recipe.aspect]
      : true;
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <Legend>Shape</Legend>
      <div className="grid grid-cols-4 gap-2">
        {ASPECTS.map((a) => {
          const on = recipe.aspect === a;
          return (
            <button
              key={a}
              type="button"
              aria-pressed={on}
              onClick={() => set({ aspect: a })}
              className={cn(
                tile(on),
                "flex min-h-[72px] flex-col items-center justify-end gap-1.5 rounded-[14px_16px_14px_12px] px-1 pb-2 pt-2.5",
                on ? "bg-primary text-on-primary" : "bg-paper text-ink",
              )}
            >
              <AspectIcon a={a} />
              <span className="text-sm font-extrabold">{a}</span>
            </button>
          );
        })}
      </div>
      {!recipe.follow && (
        <Segmented
          value={recipe.cropPos}
          onChange={(v) => set({ cropPos: v })}
          options={
            wide
              ? [
                  { id: 0, label: "left" },
                  { id: 0.5, label: "middle" },
                  { id: 1, label: "right" },
                ]
              : [
                  { id: 0, label: "top" },
                  { id: 0.5, label: "middle" },
                  { id: 1, label: "bottom" },
                ]
          }
        />
      )}
      <FollowSwitch recipe={recipe} set={set} />
    </fieldset>
  );
}

const PLATFORM_ORDER: Platform[] = [
  "tiktok",
  "reels",
  "shorts",
  "igfeed",
  "facebook",
  "x",
  "wastatus",
];
function SocialSection({ recipe, set, extras, facts }: SectionProps) {
  const spec = PLATFORMS[recipe.platform];
  const r =
    extras.range ?? (facts.duration ? { start: 0, end: facts.duration } : null);
  const len = r ? r.end - r.start : null;
  const over =
    spec.maxSeconds != null && len != null && len > spec.maxSeconds + 0.05;
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <Legend>Where</Legend>
      <div className="grid grid-cols-2 gap-2">
        {PLATFORM_ORDER.map((id) => {
          const p = PLATFORMS[id],
            on = recipe.platform === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => set({ platform: id })}
              className={cn(
                tile(on),
                "flex flex-col items-start gap-0.5 rounded-[14px_16px_14px_12px] px-3 py-2 text-left",
                on ? "bg-primary text-on-primary" : "bg-paper text-ink",
              )}
            >
              <span className="text-sm font-extrabold">{p.name}</span>
              <span
                className={cn(
                  "text-[11px] font-bold",
                  on ? "opacity-85" : "text-ink-soft",
                )}
              >
                {p.width > p.height
                  ? "16:9"
                  : p.width === p.height
                    ? "1:1"
                    : p.height / p.width > 1.5
                      ? "9:16"
                      : "4:5"}
                {p.maxSeconds
                  ? ` · ${p.maxSeconds >= 120 ? `${Math.round(p.maxSeconds / 60)} min` : `${p.maxSeconds} s`}`
                  : ""}
                {p.maxBytes ? ` · ${formatSize(p.maxBytes)}` : ""}
              </span>
            </button>
          );
        })}
      </div>
      {over && r && (
        <p
          role="status"
          className="m-0 flex flex-wrap items-center gap-2 rounded-2xl bg-track px-3 py-2 text-[13px] font-extrabold"
        >
          {spec.name} takes up to {clock(spec.maxSeconds)}; this is {clock(len)}
          .
          {extras.setRange && (
            <button
              type="button"
              onClick={() =>
                extras.setRange!({
                  start: r.start,
                  end: r.start + spec.maxSeconds!,
                })
              }
              className="min-h-10 rounded-full border-2 border-edge bg-accent px-3 text-[13px] font-extrabold text-on-accent"
            >
              keep the first {clock(spec.maxSeconds)}
            </button>
          )}
        </p>
      )}
    </fieldset>
  );
}

function FollowSwitch({ recipe, set }: Pick<SectionProps, "recipe" | "set">) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={recipe.follow}
      aria-labelledby={id}
      onClick={() => set({ follow: !recipe.follow })}
      className="flex min-h-tap items-center gap-2.5 rounded-full border-2 border-line bg-paper py-0 pl-1 pr-3 text-sm font-extrabold text-ink"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-7 w-[46px] items-center rounded-full p-[3px]",
          recipe.follow ? "justify-end bg-primary" : "bg-track",
        )}
      >
        <span
          className={cn(
            "h-[22px] w-[22px] rounded-full",
            recipe.follow ? "bg-on-primary" : "bg-ink-soft",
          )}
        />
      </span>
      <span id={id}>follow faces</span>
      <span className="ml-auto rounded-full bg-tint-audio px-2 py-0.5 text-[11px] text-ink">
        AI
      </span>
    </button>
  );
}

function FillSection({ recipe, set }: SectionProps) {
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <Legend>Fill</Legend>
      <Segmented
        value={recipe.fill}
        onChange={(v) => set({ fill: v })}
        options={[
          { id: "crop", label: "crop" },
          { id: "blur", label: "blur behind" },
          { id: "bars", label: "bars" },
        ]}
      />
      {recipe.fill === "crop" && <FollowSwitch recipe={recipe} set={set} />}
    </fieldset>
  );
}

const SONG_ACCEPT = [
  "audio/*",
  ...AUDIO_INPUTS.filter((f) => f.input).map((f) => `.${f.ext}`),
].join(",");
function MusicSection({ recipe, set, extras }: SectionProps) {
  const idSong = useId(),
    idOrig = useId();
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <Legend>Song</Legend>
      <FilePick
        onFiles={(f) => extras.setMusic?.(f[0] ?? null)}
        accept={SONG_ACCEPT}
        label={
          extras.music ? `Change song: ${extras.music.name}` : "Pick a song"
        }
        className={cn(
          "flex min-h-[52px] items-center gap-2.5 rounded-[16px_18px_16px_14px] border-2 px-3 text-sm font-extrabold",
          extras.music
            ? "border-edge bg-paper text-ink"
            : "border-dashed border-line bg-transparent text-ink-soft",
        )}
      >
        <Icon name="music" size={20} />
        <span className="min-w-0 flex-1 truncate">
          {extras.music ? extras.music.name : "pick a song"}
        </span>
        {extras.music && <span className="text-xs text-ink-soft">change</span>}
      </FilePick>
      <Segmented
        value={recipe.musicMode}
        onChange={(v) => set({ musicMode: v })}
        options={[
          { id: "mix", label: "under the sound" },
          { id: "replace", label: "replace the sound" },
        ]}
      />
      <div className="flex items-center gap-3 text-sm font-extrabold">
        <label htmlFor={idSong} className="w-14 flex-none">
          song
        </label>
        <input
          id={idSong}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={recipe.musicVolume}
          aria-valuetext={`${Math.round(recipe.musicVolume * 100)}%`}
          onChange={(e) => set({ musicVolume: +e.target.value })}
          className="h-8 min-w-0 flex-1"
        />
        <output
          htmlFor={idSong}
          className="w-10 flex-none text-right tabular-nums"
        >
          {Math.round(recipe.musicVolume * 100)}%
        </output>
      </div>
      {recipe.musicMode === "mix" && (
        <div className="flex items-center gap-3 text-sm font-extrabold">
          <label htmlFor={idOrig} className="w-14 flex-none">
            video
          </label>
          <input
            id={idOrig}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={recipe.originalVolume}
            aria-valuetext={`${Math.round(recipe.originalVolume * 100)}%`}
            onChange={(e) => set({ originalVolume: +e.target.value })}
            className="h-8 min-w-0 flex-1"
          />
          <output
            htmlFor={idOrig}
            className="w-10 flex-none text-right tabular-nums"
          >
            {Math.round(recipe.originalVolume * 100)}%
          </output>
        </div>
      )}
    </fieldset>
  );
}

function useSpeechModels(): SpeechModel[] {
  const [models, setModels] = useState<SpeechModel[]>(["tiny"]);
  useEffect(() => {
    let live = true;
    speechModels().then((m) => live && setModels(m));
    return () => {
      live = false;
    };
  }, []);
  return models;
}

function LanguagePick({ recipe, set }: Pick<SectionProps, "recipe" | "set">) {
  const id = useId();
  const models = useSpeechModels();
  const language =
    LANGUAGES.find(([c]) => c === recipe.language)?.[1] ?? recipe.language;
  return (
    <>
      <div className="flex items-center gap-3 text-sm font-extrabold">
        <label htmlFor={id} className="flex-none">
          spoken in
        </label>
        <select
          id={id}
          value={recipe.language}
          onChange={(e) => set({ language: e.target.value })}
          className="min-h-tap min-w-0 flex-1 rounded-[12px] border-2 border-edge bg-paper px-3 text-sm font-extrabold text-ink"
        >
          {LANGUAGES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {models.includes("base") && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3 text-sm font-extrabold">
            <span className="flex-none">accuracy</span>
            <div className="min-w-0 flex-1">
              <Segmented
                value={recipe.speechModel}
                onChange={(v) => set({ speechModel: v })}
                options={[
                  {
                    id: "tiny",
                    label: "fast",
                    aria: "Fast: the small speech model",
                  },
                  {
                    id: "base",
                    label: "better",
                    aria: "Better: a bigger speech model, slower",
                  },
                ]}
              />
            </div>
          </div>
          {recipe.speechModel === "tiny" && recipe.language !== "en" && (
            <p className="m-0 text-xs font-bold text-ink-soft">
              For {language},{" "}
              <button
                type="button"
                onClick={() => set({ speechModel: "base" })}
                className="border-0 bg-transparent p-0 font-extrabold text-primary underline underline-offset-2"
              >
                better
              </button>{" "}
              gets more words right.
            </p>
          )}
        </div>
      )}
      <SpeechNote
        model={
          models.includes(recipe.speechModel) ? recipe.speechModel : "tiny"
        }
      />
    </>
  );
}

function SpeechNote({ model }: { model: SpeechModel }) {
  const [cpu, gpu] = MODEL_MB[model];
  return (
    <p className="m-0 flex items-start gap-2 rounded-2xl bg-track px-3 py-2 text-[13px] font-bold text-ink-soft">
      <Icon name="home" size={16} className="mt-0.5 flex-none" />
      Speech is recognised on this device (Whisper {model}). The first time, its
      model downloads once (about {cpu}–{gpu} MB)
      {model === "base" ? ", and it takes about twice as long as fast" : ""}.
    </p>
  );
}

const CAPTION_STYLES: { id: Recipe["captionStyle"]; name: string }[] = [
  { id: "pop", name: "Pop" },
  { id: "word", name: "One word" },
  { id: "classic", name: "Classic" },
  { id: "box", name: "Boxed" },
];
function StyleSample({
  style,
  color,
}: {
  style: Recipe["captionStyle"];
  color: string;
}) {
  const outline = {
    WebkitTextStroke: "3px #000",
    paintOrder: "stroke fill",
  } as React.CSSProperties;
  const base = "whitespace-nowrap font-caption font-bold leading-none";
  if (style === "word")
    return (
      <span className={cn(base, "text-[22px]")} style={{ ...outline, color }}>
        HEY
      </span>
    );
  if (style === "pop")
    return (
      <span
        className={cn(base, "text-[15px]")}
        style={{ ...outline, color: "#fff" }}
      >
        SO <span style={{ color }}>COOL</span>
      </span>
    );
  if (style === "box")
    return (
      <span
        className={cn(base, "rounded-[5px] px-1.5 py-1 text-[13px]")}
        style={{ background: "rgba(0,0,0,.7)", color: "#fff" }}
      >
        hi there
      </span>
    );
  return (
    <span
      className={cn(base, "text-[13px]")}
      style={{
        WebkitTextStroke: "2px #000",
        paintOrder: "stroke fill",
        color: "#fff",
      }}
    >
      hi there
    </span>
  );
}

function CaptionsSection({ recipe, set, extras }: SectionProps) {
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <Legend>Captions</Legend>
      <div role="group" aria-label="Style" className="grid grid-cols-2 gap-2">
        {CAPTION_STYLES.map((c) => {
          const on = recipe.captionStyle === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => set({ captionStyle: c.id })}
              className={cn(
                tile(on),
                "flex items-center gap-2.5 rounded-[14px_16px_14px_12px] p-2 text-left",
                on ? "bg-primary text-on-primary" : "bg-paper text-ink",
              )}
            >
              <span
                aria-hidden="true"
                className="grid h-10 w-[72px] flex-none place-items-center rounded-lg bg-film"
              >
                <StyleSample
                  style={c.id}
                  color={CAPTION_COLORS[recipe.captionColor]}
                />
              </span>
              <span className="text-[13px] font-extrabold">{c.name}</span>
            </button>
          );
        })}
      </div>
      {(recipe.captionStyle === "pop" || recipe.captionStyle === "word") && (
        <div
          role="radiogroup"
          aria-label="Highlight colour"
          className="flex items-center gap-2.5 text-sm font-extrabold"
        >
          <span className="flex-none">highlight</span>
          {(Object.keys(CAPTION_COLORS) as Recipe["captionColor"][]).map(
            (k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={recipe.captionColor === k}
                aria-label={k}
                onClick={() => set({ captionColor: k })}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full border-2 bg-transparent",
                  recipe.captionColor === k
                    ? "border-edge"
                    : "border-transparent",
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-7 w-7 rounded-full border-2 border-edge"
                  style={{ background: CAPTION_COLORS[k] }}
                />
              </button>
            ),
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Segmented
          value={recipe.captionSize}
          onChange={(v) => set({ captionSize: v })}
          options={[
            {
              id: "S",
              label: <span className="text-xs">S</span>,
              aria: "Small captions",
            },
            {
              id: "M",
              label: <span className="text-sm">M</span>,
              aria: "Medium captions",
            },
            {
              id: "L",
              label: <span className="text-base">L</span>,
              aria: "Large captions",
            },
          ]}
        />
        <Segmented
          value={recipe.captionPos}
          onChange={(v) => set({ captionPos: v })}
          options={[
            { id: "bottom", label: "bottom", aria: "Captions at the bottom" },
            { id: "middle", label: "middle", aria: "Captions in the middle" },
          ]}
        />
      </div>
      <LanguagePick recipe={recipe} set={set} />
      {extras.captions && (
        <CaptionWords {...extras.captions} spoken={recipe.language} />
      )}
    </fieldset>
  );
}

const SUBTITLE_ACCEPT = ".srt,.vtt,text/vtt";

function SubtitleImport({
  onImport,
}: Pick<NonNullable<RecipeExtras["captions"]>, "onImport">) {
  return (
    <FilePick
      onFiles={(f) => f[0] && onImport(f[0])}
      accept={SUBTITLE_ACCEPT}
      label="Use an .srt or .vtt file"
      className="flex min-h-10 items-center justify-center gap-2 rounded-full border-2 border-line px-3 text-[13px] font-extrabold text-ink"
    >
      <Icon name="plus" size={16} />
      use an .srt or .vtt file
    </FilePick>
  );
}

function TranslateRow({
  draft,
  spoken,
  onTranslate,
  onRestore,
}: {
  draft: CaptionDraft;
  spoken: string;
  onTranslate: (to: string) => void;
  onRestore: () => void;
}) {
  const id = useId();
  const [able, setAble] = useState(false);
  useEffect(() => setAble(canTranslate()), []);
  if (draft.original)
    return (
      <button
        type="button"
        onClick={onRestore}
        className="min-h-10 self-start rounded-full border-2 border-line bg-transparent px-3 text-[13px] font-extrabold text-ink"
      >
        back to the original words
      </button>
    );
  if (!able) return null;
  return (
    <div className="flex items-center gap-3 text-sm font-extrabold">
      <label htmlFor={id} className="flex-none">
        translate to
      </label>
      <select
        id={id}
        value=""
        onChange={(e) => e.target.value && onTranslate(e.target.value)}
        className="min-h-tap min-w-0 flex-1 rounded-[12px] border-2 border-edge bg-paper px-3 text-sm font-extrabold text-ink"
      >
        <option value="">pick a language</option>
        {LANGUAGES.filter(([c]) => c !== spoken).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

function CaptionWords({
  draft,
  lines,
  check,
  onCheck,
  onStop,
  onLine,
  onImport,
  onTranslate,
  onRestore,
  spoken,
}: NonNullable<RecipeExtras["captions"]> & { spoken: string }) {
  if (check.busy) {
    return (
      <div
        role="status"
        className="flex items-center gap-2.5 rounded-2xl bg-track px-3 py-2 text-[13px] font-extrabold"
      >
        <span
          aria-hidden="true"
          className="h-3 w-3 flex-none animate-pulse rounded-full bg-primary"
        />
        <span className="min-w-0 flex-1">{check.message}</span>
        <button
          type="button"
          onClick={onStop}
          className="min-h-10 rounded-full border-2 border-line bg-transparent px-3 text-[13px] font-extrabold text-ink"
        >
          stop
        </button>
      </div>
    );
  }

  const stale = !!draft && !lines;
  if (!draft || !lines) {
    return (
      <div className="flex flex-col gap-2">
        {check.error && (
          <p
            role="alert"
            className="m-0 rounded-2xl border-2 border-dashed border-edge px-3 py-2 text-[13px] font-extrabold"
          >
            {check.error}
          </p>
        )}
        {stale && (
          <p className="m-0 text-[13px] font-bold text-ink-soft">
            The trim or the language changed since the words were checked.
            Listen again to check the new part (fixes you made will be
            replaced).
          </p>
        )}
        <button
          type="button"
          onClick={onCheck}
          className="flex min-h-tap items-center justify-center gap-2 rounded-[14px_16px_14px_12px] border-2 border-edge bg-paper px-3 text-sm font-extrabold text-ink shadow-sticker"
        >
          <Icon name="text" size={18} />
          {stale ? "Listen again" : "Check the words first"}
        </button>
        <SubtitleImport onImport={onImport} />
        {!stale && !check.error && (
          <p className="m-0 text-xs font-bold text-ink-soft">
            Optional: read and fix the captions before they&rsquo;re burned in.
            Otherwise they&rsquo;re heard while it brews.
          </p>
        )}
      </div>
    );
  }
  const shown = draft.segments
    .map((s, i) => ({ s, i }))
    .filter(
      ({ s }) =>
        !s.text.trim() || lines.some((l) => l.start < s.end && l.end > s.start),
    );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-extrabold">
          {lines.length} {lines.length === 1 ? "line" : "lines"} · burned in as
          written
        </span>
        <button
          type="button"
          onClick={onCheck}
          className="min-h-10 rounded-full border-0 bg-transparent px-1 text-[13px] font-extrabold text-ink-soft underline underline-offset-4"
        >
          listen again
        </button>
      </div>
      <TranslateRow
        draft={draft}
        spoken={spoken}
        onTranslate={onTranslate}
        onRestore={onRestore}
      />
      <ol
        aria-label="Caption lines"
        className="m-0 flex max-h-[300px] list-none flex-col gap-1.5 overflow-y-auto rounded-2xl bg-track p-2"
      >
        {shown.map(({ s, i }) => (
          <li key={i} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className="mt-2 w-10 flex-none text-right text-xs font-extrabold tabular-nums text-ink-soft"
            >
              {clock(s.start)}
            </span>
            <textarea
              value={s.text}
              rows={1}
              onChange={(e) => onLine(i, e.target.value)}
              aria-label={`Caption at ${clock(s.start)}`}
              placeholder="(left out)"
              className="min-h-10 min-w-0 flex-1 resize-none rounded-[10px] border-2 border-line bg-paper px-2.5 py-1.5 text-sm font-bold leading-snug text-ink [field-sizing:content] focus:border-edge"
            />
          </li>
        ))}
      </ol>
      {check.error && (
        <p role="alert" className="m-0 text-[13px] font-extrabold">
          {check.error}
        </p>
      )}
    </div>
  );
}

function TranscriptSection({ recipe, set }: SectionProps) {
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <Legend>File type</Legend>
      <Segmented
        value={recipe.transcriptFormat}
        onChange={(v) => set({ transcriptFormat: v })}
        options={[
          { id: "srt", label: ".srt", aria: "SRT subtitles" },
          { id: "vtt", label: ".vtt", aria: "WebVTT subtitles" },
          { id: "txt", label: ".txt", aria: "Plain text" },
        ]}
      />
      <LanguagePick recipe={recipe} set={set} />
    </fieldset>
  );
}

function BeforeAfter({
  kind,
  setting,
  run,
}: {
  kind: "clean" | "loudness";
  setting: string;
  run: NonNullable<RecipeExtras["preview"]>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<{ before: string; after: string } | null>(
    null,
  );
  const [side, setSide] = useState<"before" | "after">("after");
  const [playing, setPlaying] = useState(false);
  const before = useRef<HTMLAudioElement>(null),
    after = useRef<HTMLAudioElement>(null);
  const el = (which: "before" | "after") =>
    (which === "before" ? before : after).current;
  const ac = useRef<AbortController | null>(null);

  useEffect(() => {
    ac.current?.abort();
    ac.current = null;
    setBusy(false);
    setError(null);
    setUrls(null);
    setPlaying(false);
  }, [setting]);
  useEffect(
    () => () => {
      ac.current?.abort();
    },
    [],
  );
  useEffect(
    () => () => {
      if (urls) {
        URL.revokeObjectURL(urls.before);
        URL.revokeObjectURL(urls.after);
      }
    },
    [urls],
  );

  const make = async () => {
    const ctl = new AbortController();
    ac.current?.abort();
    ac.current = ctl;
    setBusy(true);
    setError(null);
    try {
      const res = await run(kind, ctl.signal);
      if (ctl.signal.aborted) return;
      setUrls({
        before: URL.createObjectURL(res.before),
        after: URL.createObjectURL(res.after),
      });
      setSide("after");
    } catch (e) {
      if (!ctl.signal.aborted && (e as Error)?.name !== "AbortError")
        setError("Couldn't make a sample of this file.");
    } finally {
      if (ac.current === ctl) {
        ac.current = null;
        setBusy(false);
      }
    }
  };
  const play = () => {
    const a = el(side);
    if (!a) return;
    if (a.paused) a.play().catch(() => setPlaying(false));
    else a.pause();
  };
  const pick = (to: "before" | "after") => {
    if (to === side) return;
    const from = el(side),
      next = el(to);
    if (from && next) {
      next.currentTime = from.currentTime;
      if (!from.paused) {
        from.pause();
        next.play().catch(() => setPlaying(false));
      }
    }
    setSide(to);
  };

  if (!urls) {
    return (
      <div className="mt-2.5 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={make}
          disabled={busy}
          className="flex min-h-tap items-center justify-center gap-2 rounded-[14px_16px_14px_12px] border-2 border-edge bg-paper px-3 text-sm font-extrabold text-ink shadow-sticker disabled:opacity-60"
        >
          <Icon name="sound" size={18} />
          {busy ? "Making a 10 s sample…" : "Hear before / after"}
        </button>
        {error && (
          <p role="alert" className="m-0 text-[13px] font-extrabold">
            {error}
          </p>
        )}
      </div>
    );
  }
  return (
    <div
      role="group"
      aria-label="Before and after"
      className="mt-2.5 flex items-center gap-2"
    >
      <audio
        ref={before}
        src={urls.before}
        loop
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(!!after.current && !after.current.paused)}
      />
      <audio
        ref={after}
        src={urls.after}
        loop
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(!!before.current && !before.current.paused)}
      />
      <button
        type="button"
        onClick={play}
        aria-label={playing ? "Pause sample" : "Play sample"}
        className="grid h-11 w-11 flex-none place-items-center rounded-full border-2 border-edge bg-accent text-on-accent"
      >
        {playing ? <PauseGlyph size={18} /> : <PlayGlyph size={18} />}
      </button>
      <div className="min-w-0 flex-1">
        <Segmented
          value={side}
          onChange={pick}
          options={[
            { id: "before", label: "before" },
            { id: "after", label: kind === "clean" ? "cleaned" : "levelled" },
          ]}
        />
      </div>
    </div>
  );
}

const CLEAN: { id: Recipe["denoise"]; name: string; note: string }[] = [
  { id: "light", name: "Light", note: "hiss & hum" },
  { id: "voice", name: "Voice", note: "AI · speech" },
  { id: "strong", name: "Strong", note: "AI · extra pass" },
];
function DenoiseSection({ recipe, set, tool, extras }: SectionProps) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <Legend>Clean-up</Legend>
      <div className="grid grid-cols-3 gap-2">
        {CLEAN.map((c, i) => {
          const on = recipe.denoise === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => set({ denoise: c.id })}
              className={cn(
                tile(on),
                "flex flex-col items-center gap-1 rounded-[16px_18px_16px_14px] px-1 py-2.5 text-ink",
              )}
              style={{
                background: on ? getShelf(tool.shelf).tint : "var(--paper)",
              }}
            >
              <span
                aria-hidden="true"
                className="flex h-6 items-center gap-[3px]"
              >
                {Array.from({ length: 7 }, (_, k) => (
                  <span
                    key={k}
                    className="w-[3px] rounded-sm bg-primary"
                    style={{
                      height: 4 + Math.abs(Math.sin(k * 1.7)) * (18 - i * 6),
                    }}
                  />
                ))}
              </span>
              <span className="text-sm font-extrabold">{c.name}</span>
              <span className="text-xs font-bold text-ink-soft">{c.note}</span>
            </button>
          );
        })}
      </div>
      {extras.preview && (
        <BeforeAfter
          kind="clean"
          setting={recipe.denoise}
          run={extras.preview}
        />
      )}
    </fieldset>
  );
}

function SilenceSection({ recipe, set, tool }: SectionProps) {
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <Legend>Silences</Legend>
      <Segmented
        value={recipe.silence}
        onChange={(v) => set({ silence: v })}
        options={[
          { id: "ends", label: "start & end" },
          { id: "pauses", label: "every long pause" },
        ]}
      />
      {tool.shelf === "video" && (
        <p className="m-0 text-[13px] font-bold text-ink-soft">
          {recipe.silence === "pauses"
            ? "Cuts pauses longer than about half a second out of the picture and the sound, so a talking video gets snappy. Captions stay in sync."
            : "Cuts the quiet bit before the first word and after the last."}
        </p>
      )}
    </fieldset>
  );
}

function SwitchRow({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={id}
      onClick={() => onChange(!on)}
      className="flex min-h-tap items-center gap-2.5 rounded-full border-2 border-line bg-paper py-0 pl-1 pr-3 text-sm font-extrabold text-ink"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-7 w-[46px] flex-none items-center rounded-full p-[3px]",
          on ? "justify-end bg-primary" : "bg-track",
        )}
      >
        <span
          className={cn(
            "h-[22px] w-[22px] rounded-full",
            on ? "bg-on-primary" : "bg-ink-soft",
          )}
        />
      </span>
      <span id={id}>{label}</span>
    </button>
  );
}

function SecondsSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-3 text-sm font-extrabold">
      <label htmlFor={id} className="flex-none">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={3}
        step={0.5}
        value={value}
        aria-valuetext={`${value} seconds`}
        onChange={(e) => onChange(+e.target.value)}
        className="h-8 min-w-0 flex-1"
      />
      <output htmlFor={id} className="w-12 flex-none text-right tabular-nums">
        {value ? `${value} s` : "off"}
      </output>
    </div>
  );
}

function CrossfadeSection({ recipe, set }: SectionProps) {
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <Legend>Between files</Legend>
      <SecondsSlider
        label="crossfade"
        value={recipe.crossfade}
        onChange={(crossfade) => set({ crossfade })}
      />
    </fieldset>
  );
}

function MergeVideoSection({ recipe, set, extras }: SectionProps) {
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <Legend>Between clips</Legend>
      {!recipe.beatSync && (
        <SecondsSlider
          label="fade"
          value={recipe.transition}
          onChange={(transition) => set({ transition })}
        />
      )}
      <Segmented
        value={recipe.mergeFit}
        onChange={(mergeFit) => set({ mergeFit })}
        options={[
          { id: "bars", label: "fit with bars" },
          { id: "crop", label: "fill and crop" },
        ]}
      />
      <SwitchRow
        label="cut on the beat"
        on={recipe.beatSync}
        onChange={(beatSync) => set({ beatSync })}
      />
      {recipe.beatSync && (
        <p className="m-0 text-[13px] font-bold text-ink-soft">
          {extras.music
            ? `Takes turns between your clips in time with ${extras.music.name}.`
            : "Pick a song in Add music first."}
        </p>
      )}
      <p className="m-0 text-[13px] font-bold text-ink-soft">
        Clips join in the order shown, and the first clip sets the shape. Clips
        of the same format, kept whole, join almost instantly with no quality
        loss.
      </p>
    </fieldset>
  );
}

const CORNERS: { id: Recipe["logoCorner"]; label: string; aria: string }[] = [
  { id: "tl", label: "↖", aria: "Top left" },
  { id: "tr", label: "↗", aria: "Top right" },
  { id: "bl", label: "↙", aria: "Bottom left" },
  { id: "br", label: "↘", aria: "Bottom right" },
];

function OverlaySection({ recipe, set, extras }: SectionProps) {
  const id = useId();
  const logo = extras.logo ?? null;
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <Legend>Text</Legend>
      <label htmlFor={id} className="sr-only">
        Text on the video
      </label>
      <textarea
        id={id}
        rows={2}
        value={recipe.overlayText}
        placeholder="a title, or follow me @you"
        onChange={(e) => set({ overlayText: e.target.value })}
        className="min-h-tap resize-y rounded-[12px] border-2 border-edge bg-paper px-3 py-2 text-sm font-bold text-ink"
      />
      <Segmented
        value={recipe.overlayPlace}
        onChange={(overlayPlace) => set({ overlayPlace })}
        options={[
          { id: "top", label: "top" },
          { id: "middle", label: "middle" },
          { id: "bottom", label: "bottom" },
        ]}
      />
      <Segmented
        value={recipe.overlayWhen}
        onChange={(overlayWhen) => set({ overlayWhen })}
        options={[
          { id: "all", label: "whole video" },
          { id: "start", label: "first 3 s" },
          { id: "end", label: "last 3 s" },
        ]}
      />
      <Legend>Logo</Legend>
      <FilePick
        onFiles={(f) => extras.setLogo?.(f[0] ?? null)}
        accept="image/png,image/jpeg,image/webp"
        label={logo ? `Change logo: ${logo.name}` : "Pick a logo"}
        className={cn(
          "flex min-h-[52px] items-center gap-2.5 rounded-[16px_18px_16px_14px] border-2 px-3 text-sm font-extrabold",
          logo
            ? "border-edge bg-paper text-ink"
            : "border-dashed border-line bg-transparent text-ink-soft",
        )}
      >
        <Icon name="plus" size={20} />
        <span className="min-w-0 flex-1 truncate">
          {logo ? logo.name : "pick a logo (PNG works best)"}
        </span>
        {logo && <span className="text-xs text-ink-soft">change</span>}
      </FilePick>
      {logo && (
        <div className="grid grid-cols-2 gap-3">
          <Segmented
            value={recipe.logoCorner}
            onChange={(logoCorner) => set({ logoCorner })}
            options={CORNERS}
          />
          <Segmented
            value={recipe.logoSize}
            onChange={(logoSize) => set({ logoSize })}
            options={[
              { id: "S", label: "S", aria: "Small logo" },
              { id: "M", label: "M", aria: "Medium logo" },
              { id: "L", label: "L", aria: "Large logo" },
            ]}
          />
        </div>
      )}
    </fieldset>
  );
}

function BlurSection() {
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <Legend>Blur faces</Legend>
      <p className="m-0 rounded-2xl bg-track px-3 py-2 text-[13px] font-bold text-ink-soft">
        Finds faces on this device and blurs up to six of them as they move.
        The AI can miss a face, especially one that is small, turned away or
        only there for a moment. Watch the whole result before you share it.
      </p>
    </fieldset>
  );
}

function TextCutSection({ recipe, set, extras }: SectionProps) {
  const c = extras.captions;
  if (!c)
    return (
      <p className="m-0 text-[13px] font-bold text-ink-soft">
        Cut by text works on one video at a time.
      </p>
    );
  const removed = c.draft?.removed ?? [];
  const gone = (w: Range) =>
    removed.some((r) => r.start < w.end && r.end > w.start);
  const lines = c.lines;
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <Legend>Words</Legend>
      <SwitchRow
        label="remove filler words (um, uh)"
        on={recipe.fillers}
        onChange={(fillers) => set({ fillers })}
      />
      <p className="m-0 text-xs font-bold text-ink-soft">
        The speech model leaves out many fillers, so some may stay in. Words
        next to a pause cut cleanly. In fast speech a cut can clip the word
        beside it, so play the result before you share it.
      </p>
      {c.check.busy ? (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-2xl bg-track px-3 py-2 text-[13px] font-extrabold"
        >
          <span className="min-w-0 flex-1">{c.check.message}</span>
          <button
            type="button"
            onClick={c.onStop}
            className="min-h-10 rounded-full border-2 border-line bg-transparent px-3 text-[13px] font-extrabold text-ink"
          >
            stop
          </button>
        </div>
      ) : !lines ? (
        <button
          type="button"
          onClick={c.onCheck}
          className="flex min-h-tap items-center justify-center gap-2 rounded-[14px_16px_14px_12px] border-2 border-edge bg-paper px-3 text-sm font-extrabold text-ink shadow-sticker"
        >
          <Icon name="text" size={18} />
          Show the words
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-extrabold">
              Tap a word to cut it · {removed.length} cut
            </span>
            {removed.length > 0 && (
              <button
                type="button"
                onClick={c.onClearCuts}
                className="min-h-10 border-0 bg-transparent px-1 text-[13px] font-extrabold text-ink-soft underline underline-offset-4"
              >
                put all back
              </button>
            )}
          </div>
          <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto rounded-2xl bg-track p-2">
            {lines.map((l, i) => (
              <p key={i} className="m-0 flex flex-wrap gap-x-1 gap-y-0.5">
                {(l.words?.length ? l.words : [l]).map((w, k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={gone(w)}
                    onClick={() => {
                      if (!recipe.textCut) set({ textCut: true });
                      c.onToggleCut({ start: w.start, end: w.end });
                    }}
                    className={cn(
                      "min-h-8 rounded-md border-0 bg-transparent px-1 text-left text-sm font-bold text-ink",
                      gone(w) && "bg-paper text-ink-soft line-through",
                    )}
                  >
                    {w.text}
                  </button>
                ))}
              </p>
            ))}
          </div>
        </>
      )}
      {c.check.error && (
        <p role="alert" className="m-0 text-[13px] font-extrabold">
          {c.check.error}
        </p>
      )}
    </fieldset>
  );
}

function ThumbnailSection({ facts, extras }: SectionProps) {
  const file = extras.file ?? null;
  const [frames, setFrames] = useState<FramePick[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ac = useRef<AbortController | null>(null);
  useEffect(() => () => ac.current?.abort(), []);
  if (!file || !facts.duration)
    return (
      <p className="m-0 text-[13px] font-bold text-ink-soft">
        Thumbnails work on one video at a time.
      </p>
    );
  const find = async () => {
    const ctl = new AbortController();
    ac.current?.abort();
    ac.current = ctl;
    setBusy(true);
    setError(null);
    try {
      const got = await findFrames(
        file,
        extras.range ?? { start: 0, end: facts.duration! },
        ctl.signal,
      );
      if (!ctl.signal.aborted) setFrames(got);
    } catch (e) {
      if (!ctl.signal.aborted) setError((e as Error).message);
    } finally {
      if (ac.current === ctl) setBusy(false);
    }
  };
  const save = async (t: number, format: "jpg" | "png") => {
    try {
      const blob = await saveFrame(file, t, format);
      const base = facts.name.replace(/\.[^/.]+$/, "") || "clip";
      downloadBlob(blob, `${base}-${Math.round(t)}s.${format}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <Legend>Best frames</Legend>
      <button
        type="button"
        onClick={find}
        disabled={busy}
        className="flex min-h-tap items-center justify-center gap-2 rounded-[14px_16px_14px_12px] border-2 border-edge bg-paper px-3 text-sm font-extrabold text-ink shadow-sticker disabled:opacity-60"
      >
        <Icon name="wand" size={18} />
        {busy ? "Looking through the video…" : frames ? "Look again" : "Find good frames"}
      </button>
      {frames && (
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
          {frames.map((f) => (
            <li key={f.t} className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.url}
                alt={`Frame at ${clock(f.t)}`}
                className="w-full rounded-lg border-2 border-edge"
              />
              <span className="flex items-center gap-1 text-xs font-extrabold">
                <span className="mr-auto tabular-nums">{clock(f.t)}</span>
                <button
                  type="button"
                  onClick={() => save(f.t, "jpg")}
                  className="min-h-8 rounded-full border-2 border-line bg-transparent px-2 text-ink"
                >
                  JPG
                </button>
                <button
                  type="button"
                  onClick={() => save(f.t, "png")}
                  className="min-h-8 rounded-full border-2 border-line bg-transparent px-2 text-ink"
                >
                  PNG
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="m-0 text-[13px] font-extrabold">
          {error}
        </p>
      )}
    </fieldset>
  );
}

const SECTIONS: Record<
  Exclude<RecipeSection, "range">,
  (p: SectionProps) => JSX.Element | null
> = {
  format: FormatSection,
  quality: QualitySection,
  sampleRate: SampleRateSection,
  channels: ChannelsSection,
  size: SizeSection,
  squeeze: SqueezeSection,
  sound: SoundSection,
  videoFormat: VideoFormatSection,
  fade: FadeSection,
  loudness: LoudnessSection,
  gifSize: GifSizeSection,
  gifFps: GifFpsSection,
  speed: SpeedSection,
  rotate: RotateSection,
  crop: CropSection,
  social: SocialSection,
  fill: FillSection,
  music: MusicSection,
  denoise: DenoiseSection,
  silence: SilenceSection,
  captions: CaptionsSection,
  transcript: TranscriptSection,
  crossfade: CrossfadeSection,
  mergeVideo: MergeVideoSection,
  overlay: OverlaySection,
  blur: BlurSection,
  textcut: TextCutSection,
  thumbnail: ThumbnailSection,
};

type Section = Exclude<RecipeSection, "range">;
function activeSections(list: RecipeSection[], recipe: Recipe): Section[] {
  return list.filter(
    (s): s is Section =>
      s !== "range" && !(s === "quality" && LOSSLESS.includes(recipe.format)),
  );
}

function rows(list: Exclude<RecipeSection, "range">[]) {
  const out: Exclude<RecipeSection, "range">[][] = [];
  for (const s of list) {
    const last = out[out.length - 1];
    if (HALF.includes(s) && last && last.length === 1 && HALF.includes(last[0]))
      last.push(s);
    else out.push([s]);
  }
  return out;
}

export function Estimate({
  before,
  after,
}: {
  before: number;
  after: number | null;
}) {
  const ratio = after != null && before ? Math.min(1, after / before) : 1;
  return (
    <div className="flex items-center gap-3.5 rounded-[18px] bg-track px-4 py-3.5">
      <div aria-hidden="true" className="flex h-[46px] items-end gap-1.5">
        <span className="w-4 rounded-[5px] bg-wood" style={{ height: 46 }} />
        <span
          className="w-4 rounded-[3px] bg-primary"
          style={{ height: Math.max(4, Math.round(46 * ratio)) }}
        />
      </div>
      <p className="m-0 flex flex-col" aria-live="polite">
        <span className="text-sm font-bold text-ink-soft">
          <s>{formatSize(before)}</s>
        </span>
        <span className="whitespace-nowrap font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.02em]">
          {after != null ? (
            <>
              <span className="sr-only">about </span>≈ {formatSize(after)}
            </>
          ) : (
            "…"
          )}
        </span>
      </p>
      {after != null && (
        <span className="ml-auto rotate-[4deg] rounded-full border-2 border-edge bg-accent px-2.5 py-1.5 text-sm font-extrabold text-on-accent">
          {savings(before, after)}
        </span>
      )}
    </div>
  );
}

function EditSwitch({
  tool,
  on,
  onChange,
}: {
  tool: Tool;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  const shelf = getShelf(tool.shelf);
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border-2 border-edge px-3 py-2"
      style={{ background: on ? shelf.tint : "var(--paper)" }}
    >
      <span
        aria-hidden="true"
        className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-icon-well text-ink"
      >
        <Icon name={tool.icon} size={20} strokeWidth={2.1} />
      </span>
      <span
        id={id}
        className="flex-1 font-display text-lg font-extrabold tracking-[-0.01em] text-ink"
      >
        {tool.name}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        onClick={() => onChange(!on)}
        className="flex min-h-tap items-center gap-2 rounded-full border-0 bg-transparent px-1 text-sm font-extrabold text-ink"
      >
        <span
          aria-hidden="true"
          className={cn(
            "relative h-7 w-12 rounded-full border-2 border-edge transition-colors",
            on ? "bg-primary" : "bg-track",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full border-2 border-edge bg-paper transition-[left]",
              on ? "left-[22px]" : "left-0.5",
            )}
          />
        </span>
        {on ? "on" : "off"}
      </button>
    </div>
  );
}

function EditList({
  edits,
  current,
  onOpen,
  onRemove,
}: {
  edits: ActiveEdit[];
  current: string;
  onOpen: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  if (!edits.length) return null;
  return (
    <section aria-label="Your edits" className="flex flex-col gap-2">
      <h3 className="legend m-0 p-0 max-sm:text-xs">
        Your edits · {edits.filter((e) => !e.skipped).length}
      </h3>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {edits.map((e) => (
          <li
            key={e.key}
            className={cn(
              "flex items-center rounded-full border-2 border-edge bg-paper",
              e.key === current &&
                "outline outline-2 outline-offset-1 outline-primary",
              e.skipped && "border-dashed opacity-70",
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(e.key)}
              title={e.skipped ?? undefined}
              className="min-h-10 rounded-l-full border-0 bg-transparent pl-3 pr-1.5 text-left text-[13px] font-extrabold text-ink"
            >
              <span className={cn(e.skipped && "line-through")}>{e.label}</span>
              {e.skipped && (
                <span className="block text-[11px] font-bold text-ink-soft no-underline">
                  {e.skipped}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label={`Remove ${e.label}`}
              onClick={() => onRemove(e.key)}
              className="grid h-10 w-10 place-items-center rounded-r-full border-0 bg-transparent text-ink-soft"
            >
              <Icon name="close" size={16} strokeWidth={2.6} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HistoryButtons({
  canUndo,
  canRedo,
  undo,
  redo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}) {
  const cls =
    "inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 border-line bg-transparent px-3 text-[13px] font-extrabold text-ink disabled:opacity-40";
  return (
    <div role="group" aria-label="History" className="-my-1 flex gap-2">
      <button type="button" onClick={undo} disabled={!canUndo} className={cls}>
        <Icon name="rotateLeft" size={16} />
        undo
      </button>
      <button type="button" onClick={redo} disabled={!canRedo} className={cls}>
        <Icon name="rotateRight" size={16} />
        redo
      </button>
    </div>
  );
}

export function RecipeCard({
  tool,
  output,
  recipe,
  set,
  facts,
  estimate,
  error,
  onBrew,
  busy,
  before,
  note,
  extras = {},
  brewSeconds,
  brewLabel = "Brew it",
  edit,
  edits = [],
  onOpen,
  onRemove,
  history,
}: {
  tool: Tool;
  recipe: Recipe;
  set: Set;
  facts: FileFacts;
  estimate: number | null;
  error: string | null;
  onBrew: () => void;
  busy?: boolean;
  output: "audio" | "video" | "text";
  edit?: {
    on: boolean;
    toggle: (on: boolean) => void;
    own: RecipeSection[];
    enable: Partial<Recipe>;
    switchable: boolean;
  } | null;
  edits?: ActiveEdit[];
  onOpen?: (key: string) => void;
  onRemove?: (key: string) => void;
  before?: number;
  note?: string | null;
  extras?: RecipeExtras;
  brewSeconds?: number | null;
  brewLabel?: string;
  history?: {
    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
  };
}) {
  const isExport = tool.id === "export";
  const outputList = activeSections(exportSections(output, recipe), recipe);
  const list = isExport ? outputList : activeSections(tool.recipe, recipe);
  const exportList = isExport
    ? []
    : outputList.filter((s) => !list.includes(s));
  const [more, setMore] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const grouped = rows(list);
  const folded = (row: Section[]) => list.indexOf(row[0]) >= 2;
  const extra = grouped.filter(folded).flat();
  const sheetRef = useRef<HTMLElement>(null);
  const [sheetH, setSheetH] = useState(0);
  const sheetId = useId();
  const exportId = useId();

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setSheetH(
        window.matchMedia("(max-width: 639px)").matches ? el.offsetHeight : 0,
      ),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const props = { recipe, set, facts, tool, extras };
  const setFor = (s: RecipeSection): Set =>
    edit && !edit.on && edit.own.includes(s)
      ? (patch) => set({ ...edit.enable, ...patch })
      : set;
  const key = `${tool.shelf}/${tool.id}`;
  const summary = recipeStamps(output, recipe, facts, null).join(" · ");
  return (
    <>
      <aside
        ref={sheetRef}
        aria-label="Recipe"
        className="relative mt-[18px] flex-[1_1_330px] max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:mt-0 max-sm:[animation:sheet-in_.3s_ease-out]"
      >
        <div
          aria-hidden="true"
          style={{ borderRadius: "14px 16px 0 0" }}
          className="absolute -top-[30px] left-7 border-2 border-b-0 border-edge bg-accent px-[18px] pb-4 pt-1 font-hand text-2xl font-bold leading-none text-on-accent max-sm:hidden"
        >
          recipe
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onBrew();
          }}
          className="relative flex flex-col gap-[22px] rounded-card border-2 border-edge bg-recipe-bg pb-6 pl-[34px] pr-6 pt-[30px] shadow-card sm:recipe-lines
            max-sm:max-h-[78vh] max-sm:gap-4 max-sm:overflow-y-auto max-sm:rounded-b-none max-sm:rounded-t-[30px] max-sm:border-x-0 max-sm:border-b-0 max-sm:px-4 max-sm:pb-5 max-sm:pt-2.5 max-sm:shadow-[0_-12px_30px_-16px_var(--sheet-shadow)]"
        >
          <div
            aria-hidden="true"
            className="recipe-margin absolute inset-y-0 left-[18px] w-0.5 max-sm:hidden"
          />
          <span
            aria-hidden="true"
            className="h-[5px] w-11 self-center rounded-sm bg-sheet-grab sm:hidden"
          />
          <div className="flex items-center justify-between sm:hidden">
            <h2 className="m-0 font-hand text-[28px] font-bold leading-none">
              recipe
            </h2>
            {extra.length > 0 && (
              <button
                type="button"
                aria-expanded={more}
                aria-controls={grouped
                  .map((row, i) => (folded(row) ? `${sheetId}-${i}` : ""))
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setMore((m) => !m)}
                className="min-h-10 rounded-full border-0 bg-surface px-3 text-[13px] font-extrabold text-ink"
              >
                {extra
                  .map((s) => SECTION_NAME[s])
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .join(" · ")}
              </button>
            )}
          </div>

          {edit?.switchable && (
            <EditSwitch tool={tool} on={edit.on} onChange={edit.toggle} />
          )}

          {grouped.map((row, i) => {
            const hiddenOnPhone = folded(row) && !more;
            return (
              <div
                key={row.join("-")}
                id={`${sheetId}-${i}`}
                className={cn(
                  row.length === 2 && "grid grid-cols-2 items-end gap-4",
                  hiddenOnPhone && "max-sm:hidden",
                )}
              >
                {row.map((s) => {
                  const S = SECTIONS[s];
                  return <S key={s} {...props} set={setFor(s)} />;
                })}
              </div>
            );
          })}

          {exportList.length > 0 && (
            <section
              aria-label="Export settings"
              className="flex flex-col gap-[22px] border-t-2 border-dashed border-line pt-4 max-sm:gap-4 max-sm:pt-3"
            >
              <h3 className="legend m-0 flex flex-wrap items-baseline gap-x-2 p-0 max-sm:hidden">
                Export{" "}
                <span className="text-xs font-bold normal-case tracking-normal text-ink-soft">
                  {summary}
                </span>
              </h3>
              <button
                type="button"
                aria-expanded={exportOpen}
                aria-controls={exportId}
                onClick={() => setExportOpen((o) => !o)}
                className="flex min-h-tap items-center gap-2 rounded-2xl border-0 bg-surface px-3 text-left text-[13px] font-extrabold text-ink sm:hidden"
              >
                <Icon name="sliders" size={18} />
                <span className="min-w-0 flex-1 truncate">
                  Export · <span className="text-ink-soft">{summary}</span>
                </span>
                <Icon
                  name={exportOpen ? "up" : "down"}
                  size={16}
                  strokeWidth={2.6}
                />
              </button>
              <div
                id={exportId}
                className={cn(
                  "flex flex-col gap-[22px] max-sm:gap-4",
                  !exportOpen && "max-sm:hidden",
                )}
              >
                {rows(exportList).map((row) => (
                  <div
                    key={row.join("-")}
                    className={cn(
                      row.length === 2 && "grid grid-cols-2 items-end gap-4",
                    )}
                  >
                    {row.map((s) => {
                      const S = SECTIONS[s];
                      return <S key={s} {...props} />;
                    })}
                  </div>
                ))}
              </div>
            </section>
          )}

          {onOpen && onRemove && (
            <EditList
              edits={edits}
              current={key}
              onOpen={onOpen}
              onRemove={onRemove}
            />
          )}
          {history && (history.canUndo || history.canRedo) && (
            <HistoryButtons {...history} />
          )}
          <div className="max-sm:hidden">
            <Estimate before={before ?? facts.size} after={estimate} />
          </div>
          {brewSeconds != null && brewSeconds >= 20 && (
            <p
              className="m-0 -mt-2 flex items-center gap-1.5 text-[13px] font-extrabold text-ink-soft"
              aria-live="polite"
            >
              <Icon name="clock" size={16} />
              about{" "}
              {brewSeconds < 90
                ? `${Math.round(brewSeconds / 5) * 5} s`
                : `${Math.round(brewSeconds / 60)} min`}{" "}
              to brew on this device
            </p>
          )}
          {note && (
            <p
              role="status"
              className="m-0 flex items-start gap-2 rounded-2xl bg-track px-3.5 py-2.5 text-sm font-bold text-ink-soft"
            >
              <Icon name="sprout" size={18} className="mt-0.5 flex-none" />
              {note}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="m-0 rounded-2xl border-2 border-dashed border-edge px-3.5 py-2.5 text-sm font-extrabold"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex min-h-[58px] items-center justify-center gap-2.5 rounded-button border-2 border-edge bg-primary font-display text-[22px] font-extrabold tracking-[-0.01em] text-on-primary shadow-[3px_4px_0_var(--edge)] max-sm:justify-between max-sm:px-5 max-sm:text-[21px]"
          >
            <span className="inline-flex items-center gap-2.5">
              <Leaf
                size={24}
                fill="var(--leaf-on-primary)"
                stroke="currentColor"
                vein
              />
              {brewLabel}
              <span className="font-ui text-[15px] font-extrabold opacity-80">
                · export
              </span>
            </span>
            {estimate != null && (
              <span className="font-ui text-[15px] font-extrabold text-on-primary-accent sm:hidden">
                <span className="sr-only">about </span>≈ {formatSize(estimate)}
              </span>
            )}
          </button>
        </form>
      </aside>
      <div
        aria-hidden="true"
        className="w-full sm:hidden"
        style={{ height: sheetH }}
      />
    </>
  );
}
