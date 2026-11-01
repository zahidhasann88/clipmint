"use client";
import { useEffect, useRef, useState } from "react";
import { FileChips, factChips } from "./file-card";
import { Icon, PauseGlyph, PlayGlyph } from "./icons";
import { GoodBit } from "./good-bit";
import { FilePick } from "./mat";
import { usePlayer } from "./player";
import { FilmstripTrimmer, KeepChip, TimeField, WaveformTrimmer } from "./trim";
import { ShortcutHint, ownsKey } from "./shortcuts";
import { CaptionPreview } from "./caption-preview";
import type { CaptionLook } from "@/media/captions/ass";
import type { Segment } from "@/media/captions";
import { clock, clockTenths, type Range } from "@/media/recipe";
import type { FileFacts } from "@/lib/registry";
import { cn } from "@/lib/utils";

interface EditProps {
  file: File;
  url: string | null;
  facts: FileFacts;
  range: Range | null;
  onRange: (r: Range) => void;
  onFiles: (f: File[]) => void;
  fades?: { in: number; out: number };
  view?: {
    rotate: 0 | 90 | 180 | 270;
    flip: "none" | "h" | "v";
    frame?: { aspect: number; pos: number };
    captions?: {
      look: CaptionLook;
      lines: Segment[] | null;
      aspect: number | null;
    };
  };
}

function cropRect(
  frame: { aspect: number; pos: number },
  w: number | null,
  h: number | null,
) {
  if (!w || !h) return null;
  const box = 16 / 9,
    va = w / h;
  const vw = va > box ? 100 : (va / box) * 100,
    vh = va > box ? (box / va) * 100 : 100;
  const keepW = Math.min(1, frame.aspect / va),
    keepH = Math.min(1, va / frame.aspect);
  const cw = vw * keepW,
    ch = vh * keepH;
  return {
    left: (100 - vw) / 2 + (vw - cw) * frame.pos,
    top: (100 - vh) / 2 + (vh - ch) * frame.pos,
    width: cw,
    height: ch,
  };
}

function previewTransform(
  view: EditProps["view"],
  w: number | null,
  h: number | null,
): string | undefined {
  if (!view || (!view.rotate && view.flip === "none")) return undefined;
  let scale = 1;
  if ((view.rotate === 90 || view.rotate === 270) && w && h) {
    const fit = (vw: number, vh: number) => Math.min(16 / vw, 9 / vh);
    scale = fit(h, w) / fit(w, h);
  }
  const sx = view.flip === "h" ? -1 : 1,
    sy = view.flip === "v" ? -1 : 1;
  return `rotate(${view.rotate}deg) scale(${scale * sx}, ${scale * sy})`;
}

const ZOOMS = [1, 2, 4, 8];

function useMatKeys(
  player: ReturnType<typeof usePlayer>,
  sel: Range,
  duration: number,
  onRange: (r: Range) => void,
) {
  const latest = useRef({ player, sel, duration, onRange });
  latest.current = { player, sel, duration, onRange };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { player: p, sel: r, duration: d, onRange: set } = latest.current;
      if (
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        !d ||
        ownsKey(e.target, e.key)
      )
        return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === " ") p.playRange(r.start, r.end);
      else if (k === "k") p.toggle();
      else if (k === "ArrowLeft" || k === "ArrowRight")
        p.seek(
          Math.min(
            d,
            Math.max(
              0,
              p.time + (k === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 5 : 1),
            ),
          ),
        );
      else if (k === "i")
        set({ start: Math.min(Math.max(0, p.time), r.end - 0.1), end: r.end });
      else if (k === "o")
        set({
          start: r.start,
          end: Math.max(Math.min(d, p.time), r.start + 0.1),
        });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function RoundButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-11 w-11 place-items-center rounded-full border-2 border-mat-border bg-transparent text-on-mat disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function RangeFields({
  range,
  duration,
  onRange,
  tone,
}: {
  range: Range;
  duration: number;
  onRange: (r: Range) => void;
  tone: "mat" | "pill";
}) {
  return (
    <>
      <TimeField
        label="start"
        tone={tone}
        value={range.start}
        min={0}
        max={Math.max(0, range.end - 0.1)}
        onCommit={(t) => onRange({ start: t, end: range.end })}
      />
      <TimeField
        label="end"
        tone={tone}
        value={range.end}
        min={range.start + 0.1}
        max={duration}
        onCommit={(t) => onRange({ start: range.start, end: t })}
      />
    </>
  );
}

export function AudioEditMat({
  file,
  url,
  facts,
  range,
  onRange,
  onFiles,
  fades,
}: EditProps) {
  const player = usePlayer<HTMLAudioElement>(url);
  const [zoom, setZoom] = useState(1);
  const duration = facts.duration ?? 0;
  const sel = range ?? { start: 0, end: duration };
  const zi = ZOOMS.indexOf(zoom);
  useMatKeys(player, sel, duration, onRange);

  return (
    <section
      aria-label="Trim"
      className="mat flex min-w-0 flex-[999_1_600px] flex-col gap-5 p-[26px_clamp(18px,2.6vw,34px)_30px] max-sm:mx-[-4px] max-sm:gap-3.5 max-sm:p-[18px_14px_16px]"
    >
      {url && <audio ref={player.ref} src={url} preload="auto" />}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 max-sm:hidden">
        <span
          aria-hidden="true"
          className="grid h-10 w-[52px] place-items-center rounded-[10px] border-2 border-ill-line bg-accent"
        >
          <svg width="34" height="18" viewBox="0 0 34 18">
            <circle
              cx="9"
              cy="9"
              r="5"
              fill="var(--ill-paper)"
              stroke="var(--ill-line)"
              strokeWidth="2"
            />
            <circle
              cx="25"
              cy="9"
              r="5"
              fill="var(--ill-paper)"
              stroke="var(--ill-line)"
              strokeWidth="2"
            />
          </svg>
        </span>
        <h1 className="m-0 font-display text-[26px] font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere]">
          {facts.name}
        </h1>
        <FileChips items={factChips(facts)} tone="mat" />
        <FilePick
          onFiles={onFiles}
          multiple
          label="Swap file"
          className="ml-auto grid h-11 w-11 place-items-center rounded-full border-2 border-mat-border text-on-mat"
        >
          <Icon name="swap" />
        </FilePick>
      </div>

      {duration > 0 ? (
        <WaveformTrimmer
          blob={file}
          duration={duration}
          range={sel}
          onRange={onRange}
          time={player.time}
          onSeek={player.seek}
          zoom={zoom}
          fades={fades}
        />
      ) : (
        <p role="status" className="m-0 font-hand text-[26px] text-accent">
          reading the file…
        </p>
      )}

      {duration > 0 && (
        <div className="flex justify-between sm:hidden">
          <RangeFields
            range={sel}
            duration={duration}
            onRange={onRange}
            tone="pill"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-3.5 max-sm:gap-3">
        <button
          type="button"
          onClick={() => player.playRange(sel.start, sel.end)}
          aria-label={player.playing ? "Pause" : "Play selection"}
          disabled={!duration}
          className="grid h-16 w-16 flex-none place-items-center rounded-full border-2 border-ill-line bg-accent text-on-accent shadow-on-mat max-sm:h-14 max-sm:w-14"
        >
          {player.playing ? <PauseGlyph size={26} /> : <PlayGlyph size={26} />}
        </button>
        <p className="m-0 font-display text-[26px] font-bold tracking-[-0.01em] tabular-nums max-sm:text-[22px]">
          {clockTenths(player.time)}{" "}
          <span className="text-lg text-on-mat-muted max-sm:hidden">
            / {clockTenths(duration)}
          </span>
        </p>
        {duration > 0 && (
          <div className="ml-auto flex flex-wrap gap-2.5">
            <div className="flex flex-wrap gap-2.5 max-sm:hidden">
              <RangeFields
                range={sel}
                duration={duration}
                onRange={onRange}
                tone="mat"
              />
            </div>
            <KeepChip seconds={sel.end - sel.start} />
            <GoodBit
              file={file}
              duration={duration}
              range={sel}
              onPick={(r) => {
                onRange(r);
                player.seek(r.start);
              }}
            />
          </div>
        )}
        <div
          role="group"
          aria-label="Zoom"
          className="flex gap-1.5 max-sm:hidden"
        >
          <RoundButton
            label="Zoom out"
            onClick={() => setZoom(ZOOMS[Math.max(0, zi - 1)])}
            disabled={zi <= 0}
          >
            <Icon name="minus" strokeWidth={2.4} />
          </RoundButton>
          <RoundButton
            label="Zoom in"
            onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zi + 1)])}
            disabled={zi >= ZOOMS.length - 1}
          >
            <Icon name="plus" strokeWidth={2.4} />
          </RoundButton>
        </div>
      </div>
      {duration > 0 && <ShortcutHint />}
    </section>
  );
}

export function VideoEditMat({
  file,
  url,
  facts,
  range,
  onRange,
  onFiles,
  view,
}: EditProps) {
  const player = usePlayer<HTMLVideoElement>(url);
  const [muted, setMuted] = useState(false);
  const duration = facts.duration ?? 0;
  const sel = range ?? { start: 0, end: duration };
  useMatKeys(player, sel, duration, onRange);

  return (
    <section
      aria-label="Preview and trim"
      className="mat flex min-w-0 flex-[999_1_600px] flex-col gap-[18px] p-[24px_clamp(18px,2.6vw,34px)_28px] max-sm:gap-3.5 max-sm:p-[16px_12px_18px]"
    >
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 max-sm:hidden">
        <h1 className="m-0 font-display text-[26px] font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere]">
          {facts.name}
        </h1>
        <FileChips items={factChips(facts)} tone="mat-accent" />
        <FilePick
          onFiles={onFiles}
          multiple
          label="Swap file"
          className="ml-auto grid h-11 w-11 place-items-center rounded-full border-2 border-mat-border text-on-mat"
        >
          <Icon name="swap" />
        </FilePick>
      </div>

      <div className="w-full max-w-[760px] self-center rounded-[30px_34px_30px_28px] border-2 border-edge bg-wood px-3.5 pb-2.5 pt-3.5 shadow-[4px_6px_0_var(--edge)] max-sm:rounded-[22px] max-sm:p-2.5 max-sm:pb-2">
        <div className="relative aspect-video overflow-hidden rounded-[18px] border-2 border-edge bg-film">
          {url && (
            <video
              ref={player.ref}
              src={url}
              preload="auto"
              playsInline
              muted={muted}
              onClick={() => player.playRange(sel.start, sel.end)}
              className="h-full w-full object-contain transition-transform duration-300"
              style={{
                transform: previewTransform(view, facts.width, facts.height),
              }}
            />
          )}
          {view?.captions &&
            (() => {
              const quarter = view.rotate === 90 || view.rotate === 270;
              const w = quarter ? facts.height : facts.width,
                h = quarter ? facts.width : facts.height;
              const aspect =
                view.captions.aspect ??
                view.frame?.aspect ??
                (w && h ? w / h : 16 / 9);
              const rect = cropRect(
                view.frame ?? { aspect, pos: 0.5 },
                w,
                h,
              ) ?? { left: 0, top: 0, width: 100, height: 100 };
              return (
                <CaptionPreview
                  look={view.captions.look}
                  lines={view.captions.lines}
                  time={player.time}
                  rect={rect}
                  aspect={aspect}
                />
              );
            })()}
          {view?.frame &&
            (() => {
              const quarter = view.rotate === 90 || view.rotate === 270;
              const c = cropRect(
                view.frame,
                quarter ? facts.height : facts.width,
                quarter ? facts.width : facts.height,
              );
              return (
                c && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute rounded-md border-[3px] border-accent shadow-[0_0_0_999px_var(--film-dim)] transition-all duration-300"
                    style={{
                      left: `${c.left}%`,
                      top: `${c.top}%`,
                      width: `${c.width}%`,
                      height: `${c.height}%`,
                    }}
                  />
                )
              );
            })()}
          <button
            type="button"
            onClick={() => player.playRange(sel.start, sel.end)}
            aria-label={player.playing ? "Pause" : "Play selection"}
            className={cn(
              "absolute left-1/2 top-1/2 grid h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-edge bg-accent text-on-accent shadow-[3px_4px_0_var(--edge)] transition-opacity max-sm:h-[60px] max-sm:w-[60px]",
              player.playing &&
                "opacity-0 hover:opacity-100 focus-visible:opacity-100",
            )}
          >
            {player.playing ? (
              <PauseGlyph size={30} />
            ) : (
              <PlayGlyph size={30} />
            )}
          </button>
        </div>
        <div className="flex items-center gap-3 px-1 pt-2 text-[color:var(--on-wood)]">
          <span className="text-sm font-extrabold tabular-nums">
            {clock(player.time)} / {clock(duration)}
          </span>
          <span
            aria-hidden="true"
            className="h-1.5 flex-1 rounded-[3px] bg-[color:var(--wood-track)]"
          >
            <span
              className="block h-full rounded-[3px] bg-[color:var(--on-wood)]"
              style={{
                width: `${duration ? (player.time / duration) * 100 : 0}%`,
              }}
            />
          </span>
          <button
            type="button"
            aria-pressed={muted}
            aria-label="Sound off in preview"
            onClick={() => setMuted((m) => !m)}
            className="grid h-9 w-11 place-items-center border-0 bg-transparent text-[color:var(--on-wood)]"
          >
            <Icon name={muted ? "mute" : "sound"} size={22} />
          </button>
        </div>
      </div>

      {duration > 0 ? (
        <FilmstripTrimmer
          url={url}
          duration={duration}
          range={sel}
          onRange={onRange}
          onSeek={player.seek}
        />
      ) : (
        <p role="status" className="m-0 font-hand text-[26px] text-accent">
          reading the video…
        </p>
      )}

      {duration > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          <RangeFields
            range={sel}
            duration={duration}
            onRange={onRange}
            tone="mat"
          />
          <KeepChip seconds={sel.end - sel.start} />
          <GoodBit
            file={file}
            duration={duration}
            range={sel}
            onPick={(r) => {
              onRange(r);
              player.seek(r.start);
            }}
          />
        </div>
      )}
      {duration > 0 && <ShortcutHint />}
    </section>
  );
}
