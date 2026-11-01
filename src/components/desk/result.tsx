"use client";
import { useEffect, useMemo, useState } from "react";
import { FallingLeaves } from "./art";
import { FileChips, MiniWave } from "./file-card";
import { Icon, PauseGlyph, PlayGlyph, Sparkle } from "./icons";
import { usePlayer } from "./player";
import type { ResultState } from "./desk-state";
import type { FileFacts, Recipe } from "@/lib/registry";
import {
  LOSSLESS,
  clock,
  formatSize,
  outputDims,
  savings,
  turned,
} from "@/media/recipe";
import { downloadBlob } from "@/media/files";
import { canShare, shareFiles } from "@/lib/share";
import { privacyReceipt } from "@/lib/net-meter";
import { cn } from "@/lib/utils";

function Jar({
  label,
  size,
  fill,
  lid,
  liquid,
  small,
}: {
  label: string;
  size: string;
  fill: number;
  lid: string;
  liquid: string;
  small?: boolean;
}) {
  const h = small ? 140 : 250;
  return (
    <div className="flex flex-col items-center gap-2.5 max-sm:gap-1.5">
      <div
        aria-hidden="true"
        className={cn(
          "rounded-lg border-[2.5px] border-ill-line",
          small ? "h-2.5 w-[76px]" : "h-[18px] w-[118px]",
        )}
        style={{ background: lid }}
      />
      <div
        aria-hidden="true"
        className={cn(
          "relative -mt-2 overflow-hidden rounded-[16px_16px_30px_30px] border-[2.5px] border-on-mat",
          small ? "w-[70px]" : "w-[108px]",
        )}
        style={{ height: h, background: "var(--jar-glass)" }}
      >
        <div
          className="anim-grow jar-ticks absolute inset-x-1.5 bottom-1.5 rounded-[10px_10px_24px_24px]"
          style={{
            height: Math.max(14, Math.round((h - 20) * fill)),
            backgroundColor: liquid,
          }}
        />
      </div>
      <span className="text-sm font-extrabold text-on-mat-soft max-sm:sr-only">
        {label}
      </span>
      <span
        className="-mt-2 font-display text-[26px] font-extrabold max-sm:mt-0 max-sm:text-xl"
        style={label === "after" ? { color: "var(--accent)" } : undefined}
      >
        {size}
      </span>
    </div>
  );
}

export function Jars({
  before,
  after,
  small,
}: {
  before: number;
  after: number;
  small?: boolean;
}) {
  const max = Math.max(before, after);
  return (
    <figure
      aria-label={`Size before and after: ${formatSize(before)} to ${formatSize(after)}`}
      className={cn(
        "relative m-0 flex items-end justify-center",
        small ? "gap-[22px]" : "gap-[34px] px-2.5 pt-2.5",
      )}
    >
      <Jar
        label="before"
        size={formatSize(before)}
        fill={before / max}
        lid="var(--wood)"
        liquid="var(--jar-before)"
        small={small}
      />
      <Jar
        label="after"
        size={formatSize(after)}
        fill={after / max}
        lid="var(--accent)"
        liquid="var(--jar-after)"
        small={small}
      />
      <span
        className={cn(
          "absolute grid rotate-[10deg] place-items-center rounded-blob border-[2.5px] border-ill-line bg-accent font-display font-extrabold tracking-[-0.03em] text-on-accent shadow-on-mat",
          small
            ? "right-[-6px] top-[18px] h-[72px] w-[72px] text-[21px]"
            : "-right-[46px] top-10 h-[92px] w-[92px] text-[26px]",
        )}
      >
        {savings(before, after)}
      </span>
    </figure>
  );
}

function resultChips(
  output: "audio" | "video" | "text",
  recipe: Recipe,
): string[] {
  if (output !== "audio") return [];
  const rate =
    recipe.format === "opus"
      ? "48 kHz"
      : `${+(recipe.sampleRate / 1000).toFixed(1)} kHz`;
  return [
    recipe.format.toUpperCase(),
    LOSSLESS.includes(recipe.format) ? null : `${recipe.bitrate} kbps`,
    `${recipe.channels === 1 ? "mono" : "stereo"} · ${rate}`,
  ].filter((x): x is string => !!x);
}

export function ShareButton({
  files,
  label = "Share",
  className,
}: {
  files: { blob: Blob; name: string }[];
  label?: string;
  className?: string;
}) {
  const key = files.map((f) => `${f.name}:${f.blob.size}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(
    () => files.map((f) => new File([f.blob], f.name, { type: f.blob.type })),
    [key],
  );
  const [able, setAble] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => setAble(canShare(list)), [list]);
  if (!able) return null;
  return (
    <>
      <button
        type="button"
        onClick={async () => setFailed(!(await shareFiles(list)))}
        className={cn(
          "flex min-h-[50px] items-center justify-center gap-2 rounded-2xl border-2 border-on-mat bg-mat-chip text-base font-extrabold text-on-mat",
          className,
        )}
      >
        <Icon name="share" size={20} />
        {label}
      </button>
      {failed && (
        <p role="alert" className="m-0 text-sm font-bold text-on-mat-soft">
          Couldn&rsquo;t open the share sheet. Download it instead.
        </p>
      )}
    </>
  );
}

function PrivacyReceipt({ result }: { result: ResultState }) {
  return (
    <button
      type="button"
      onClick={() =>
        downloadBlob(
          new Blob(
            [privacyReceipt([{ name: result.filename, size: result.size }])],
            { type: "text/plain" },
          ),
          "clipmint-privacy-receipt.txt",
        )
      }
      className="min-h-10 self-start border-0 bg-transparent p-0 text-[13px] font-extrabold text-on-mat-soft underline underline-offset-4"
    >
      Save a privacy receipt
    </button>
  );
}

function ShortsOffer({
  lengths,
  vertical,
  onMake,
}: NonNullable<Parameters<typeof ResultMat>[0]["shorts"]>) {
  if (!lengths.length) return null;
  return (
    <div
      role="group"
      aria-label="Make 3 shorts from this"
      className="flex flex-col gap-2 rounded-[18px_22px_18px_16px] border-2 border-dashed border-on-mat p-3 max-sm:order-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[15px] font-extrabold text-on-mat">
          <Icon name="wand" size={18} />
          Make 3 shorts from this
        </span>
        <span className="ml-auto flex gap-1.5">
          {lengths.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onMake(l)}
              aria-label={`Make 3 shorts of ${l} seconds`}
              className="h-10 min-w-[52px] rounded-[10px] border-2 border-ill-line bg-ill-cream px-2 text-[15px] font-extrabold tabular-nums text-ill-line"
            >
              {l}s
            </button>
          ))}
        </span>
      </div>
      <p className="m-0 text-xs font-bold text-on-mat-soft">
        Picks the liveliest parts of the whole video by its sound, and brews
        each with this recipe.
        {!vertical && " Tip: switch on For social first to make them vertical."}
      </p>
    </div>
  );
}

export function ResultMat({
  result,
  output,
  recipe,
  facts,
  onDownload,
  onTweak,
  onNew,
  shorts,
  error,
  notice,
}: {
  result: ResultState;
  output: "audio" | "video" | "text";
  recipe: Recipe;
  facts: FileFacts;
  onDownload: () => void;
  onTweak: () => void;
  onNew: () => void;
  shorts?: {
    lengths: number[];
    vertical: boolean;
    onMake: (length: number) => void;
  };
  error?: string | null;
  notice?: string | null;
}) {
  const video = output === "video";
  const player = usePlayer<HTMLMediaElement>(result.url);
  const dims = video ? outputDims(recipe.size, turned(facts, recipe)) : null;
  const overlay = [
    clock(result.duration),
    dims ? `${Math.min(dims.w, dims.h)}p` : null,
    recipe.sound ? null : "muted",
  ]
    .filter(Boolean)
    .join(" · ");

  const gif = recipe.videoFormat === "gif" && video;
  const text = output === "text";
  const preview = text ? (
    <article
      aria-label={result.filename}
      className="on-mat-card flex flex-col gap-3 rounded-[26px_30px_26px_22px] border-2 border-edge bg-card-on-mat p-5 text-on-card-on-mat shadow-on-mat-lg"
    >
      <p className="m-0 font-hand text-[30px] font-bold leading-none [overflow-wrap:anywhere]">
        {result.filename}
      </p>
      <p
        tabIndex={0}
        aria-label="Transcript"
        className="m-0 max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface p-3 text-[15px] font-bold leading-relaxed"
      >
        {result.text}
      </p>
      <FileChips
        items={[
          recipe.transcriptFormat.toUpperCase(),
          `${(result.text ?? "").split(/\s+/).filter(Boolean).length} words`,
          clock(result.duration),
        ]}
        tone="card"
      />
    </article>
  ) : gif ? (
    <div className="on-mat-card relative aspect-video overflow-hidden rounded-[18px] border-2 border-edge bg-film shadow-on-mat">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={result.url}
        alt={`Preview of ${result.filename}`}
        className="h-full w-full object-contain"
      />
      <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-overlay px-2 py-1 text-xs font-extrabold text-ill-oat">
        {clock(result.duration)} · {recipe.gifWidth} px · loop
      </span>
    </div>
  ) : video ? (
    <div className="on-mat-card relative aspect-video overflow-hidden rounded-[18px] border-2 border-edge bg-film shadow-on-mat">
      <video
        ref={player.ref as React.RefObject<HTMLVideoElement>}
        src={result.url}
        preload="metadata"
        playsInline
        className="h-full w-full object-contain"
      />
      <button
        type="button"
        onClick={player.toggle}
        aria-label={player.playing ? "Pause result" : "Play result"}
        className={cn(
          "absolute left-1/2 top-1/2 grid h-[60px] w-[60px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-edge bg-accent text-on-accent transition-opacity",
          player.playing &&
            "opacity-0 hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        {player.playing ? <PauseGlyph size={24} /> : <PlayGlyph size={24} />}
      </button>
      <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-overlay px-2 py-1 text-xs font-extrabold text-ill-oat">
        {overlay}
      </span>
    </div>
  ) : (
    <article
      aria-label={result.filename}
      className="on-mat-card flex rotate-[1.2deg] flex-col gap-3.5 rounded-[26px_30px_26px_22px] border-2 border-edge bg-card-on-mat p-5 text-on-card-on-mat shadow-on-mat-lg max-sm:rotate-0"
    >
      <p className="m-0 font-hand text-[30px] font-bold leading-none [overflow-wrap:anywhere]">
        {result.filename}
      </p>
      <audio
        ref={player.ref as React.RefObject<HTMLAudioElement>}
        src={result.url}
        preload="metadata"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={player.toggle}
          aria-label={player.playing ? "Pause result" : "Play result"}
          className="grid h-[52px] w-[52px] flex-none place-items-center rounded-full border-2 border-edge bg-primary text-on-primary"
        >
          {player.playing ? <PauseGlyph size={22} /> : <PlayGlyph size={22} />}
        </button>
        <MiniWave
          blob={result.blob}
          bars={48}
          height={44}
          progress={
            result.duration && player.time > 0
              ? player.time / result.duration
              : 1
          }
        />
        <span className="text-sm font-extrabold tabular-nums">
          {clock(result.duration)}
        </span>
      </div>
      <FileChips items={resultChips(output, recipe)} tone="card" />
    </article>
  );

  return (
    <section
      aria-label="Your result"
      className="mat relative flex min-h-[680px] flex-1 flex-wrap items-center justify-center gap-x-14 gap-y-9 overflow-hidden p-[40px_clamp(18px,4vw,64px)] max-sm:min-h-0 max-sm:flex-col max-sm:items-stretch max-sm:gap-4 max-sm:p-[18px_16px]"
    >
      <FallingLeaves />
      <div className="relative flex flex-col items-center gap-[18px] max-sm:order-2">
        <h1 className="m-0 flex items-center gap-3 font-display text-[clamp(44px,5vw,68px)] font-extrabold leading-none tracking-[-0.04em] max-sm:hidden">
          <Sparkle size={40} color="var(--accent)" />
          Ready
        </h1>
        <div className="max-sm:hidden">
          <Jars before={facts.size} after={result.size} />
        </div>
        <div className="sm:hidden">
          <Jars before={facts.size} after={result.size} small />
        </div>
      </div>

      <div className="relative flex flex-[0_1_440px] flex-col gap-4 max-sm:contents">
        <div className="max-sm:order-1">{preview}</div>
        {video && (
          <p className="m-0 font-hand text-[26px] font-bold leading-none [overflow-wrap:anywhere] max-sm:order-3">
            {result.filename}
          </p>
        )}
        <button
          type="button"
          onClick={onDownload}
          className="lift flex min-h-16 items-center justify-center gap-3 rounded-[20px_22px_20px_18px] border-2 border-ill-line bg-accent font-display text-2xl font-extrabold tracking-[-0.01em] text-on-accent shadow-on-mat max-sm:order-4 max-sm:min-h-[62px] max-sm:text-[23px]"
        >
          <Icon name="download" size={26} strokeWidth={2.4} />
          Download
        </button>
        <ShareButton
          files={[{ blob: result.blob, name: result.filename }]}
          className="max-sm:order-4"
        />
        {result.extras?.map((x) => (
          <button
            key={x.name}
            type="button"
            onClick={() => downloadBlob(x.blob, x.name)}
            className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl border-2 border-on-mat bg-mat-chip text-base font-extrabold text-on-mat max-sm:order-4"
          >
            <Icon name="download" size={20} />
            Download {x.label}
          </button>
        ))}
        {error && (
          <p
            role="alert"
            className="m-0 rounded-2xl bg-card-on-mat px-4 py-2.5 text-sm font-extrabold text-on-card-on-mat max-sm:order-4"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="m-0 text-sm font-bold text-on-mat-soft max-sm:order-4"
          >
            {notice}
          </p>
        )}
        {shorts && <ShortsOffer {...shorts} />}
        <PrivacyReceipt result={result} />
        <div className="grid grid-cols-2 gap-2.5 max-sm:order-5">
          <button
            type="button"
            onClick={onTweak}
            className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl border-2 border-on-mat bg-transparent text-base font-extrabold text-on-mat"
          >
            <Icon name="sliders" />
            Tweak
          </button>
          <button
            type="button"
            onClick={onNew}
            className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl border-2 border-on-mat bg-transparent text-base font-extrabold text-on-mat"
          >
            <Icon name="plus" />
            New file
          </button>
        </div>
      </div>
    </section>
  );
}
