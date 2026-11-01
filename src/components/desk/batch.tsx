"use client";
import { useEffect, useId, useRef, useState } from "react";
import { FileChips } from "./file-card";
import { Icon, PauseGlyph, PlayGlyph, Sparkle } from "./icons";
import { FilePick } from "./mat";
import { usePlayer } from "./player";
import { FilmstripTrimmer, WaveformTrimmer } from "./trim";
import { RangeFields } from "./edit";
import { cn } from "@/lib/utils";
import { Jars, ShareButton } from "./result";
import { FallingLeaves } from "./art";
import type { BatchResult, Item } from "./desk-state";
import { getShelf, type Tool } from "@/lib/registry";
import {
  clock,
  clockTenths,
  formatSize,
  savings,
  type Range,
} from "@/media/recipe";

function isTrimmed(r: Range | undefined, d: number | null) {
  return !!r && !!d && (r.start > 0.05 || r.end < d - 0.05);
}

function useSwipeAway(onRemove: () => void) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const horizontal = useRef(false);
  return {
    dx,
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType !== "touch") return;
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        horizontal.current = false;
      },
      onPointerMove: (e: React.PointerEvent) => {
        const s = start.current;
        if (!s || s.id !== e.pointerId) return;
        const mx = e.clientX - s.x,
          my = e.clientY - s.y;
        if (
          !horizontal.current &&
          Math.abs(mx) > 10 &&
          Math.abs(mx) > Math.abs(my) * 1.5
        )
          horizontal.current = true;
        if (horizontal.current) setDx(Math.min(0, mx));
      },
      onPointerUp: () => {
        if (dx < -110) onRemove();
        setDx(0);
        start.current = null;
      },
      onPointerCancel: () => {
        setDx(0);
        start.current = null;
      },
    },
  };
}

function BatchRow({
  item,
  range,
  onRange,
  onRemove,
  delay,
  onMove,
  first,
  last,
}: {
  item: Item;
  range: Range | undefined;
  onRange: (r: Range) => void;
  onRemove: () => void;
  delay: number;
  onMove?: (by: -1 | 1) => void;
  first?: boolean;
  last?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const swipe = useSwipeAway(onRemove);
  const [url, setUrl] = useState<string | null>(null);
  const video = item.facts.engine === "video";
  const player = usePlayer<HTMLMediaElement>(url);
  const d = item.facts.duration;
  const sel = range ?? (d ? { start: 0, end: d } : null);
  const panel = useId();
  useEffect(() => {
    if (!open) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(item.file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [open, item.file]);
  const tint = video ? "var(--tint-video)" : "var(--tint-audio)";
  const trimmed = isTrimmed(range, d);
  const meta = [
    item.facts.ext.toUpperCase(),
    formatSize(item.file.size),
    trimmed && sel
      ? `${clockTenths(sel.start)} → ${clockTenths(sel.end)} · keep ${clock(sel.end - sel.start)}`
      : d != null
        ? clock(d)
        : "…",
  ].join(" · ");
  return (
    <li
      className="on-mat-card anim-pop relative rounded-[18px_22px_18px_16px] border-2 border-edge bg-card-on-mat text-on-card-on-mat shadow-on-mat"
      style={{
        animationDelay: `${delay}s`,
        transform: swipe.dx ? `translateX(${swipe.dx}px)` : undefined,
        opacity: swipe.dx ? Math.max(0.35, 1 + swipe.dx / 260) : undefined,
      }}
    >
      <div
        className="flex touch-pan-y items-center gap-3 py-2.5 pl-3 pr-2"
        {...swipe.handlers}
      >
        {onMove && (
          <span className="flex flex-none flex-col">
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={first}
              aria-label={`Move ${item.facts.name} up`}
              className="grid h-6 w-9 place-items-center rounded-md border-0 bg-transparent text-ink-soft disabled:opacity-30 max-sm:h-[22px]"
            >
              <Icon name="up" size={16} strokeWidth={2.6} />
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={last}
              aria-label={`Move ${item.facts.name} down`}
              className="grid h-6 w-9 place-items-center rounded-md border-0 bg-transparent text-ink-soft disabled:opacity-30 max-sm:h-[22px]"
            >
              <Icon name="down" size={16} strokeWidth={2.6} />
            </button>
          </span>
        )}
        <span
          aria-hidden="true"
          className="grid h-10 w-10 flex-none place-items-center rounded-xl text-ink"
          style={{ background: tint }}
        >
          <Icon name={video ? "film" : "note"} size={20} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[15px] font-extrabold">
            {item.facts.name}
          </p>
          <p className="m-0 text-xs font-extrabold text-ink-soft">{meta}</p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          disabled={!d}
          onClick={() => setOpen((o) => !o)}
          aria-label={`Trim ${item.facts.name}`}
          className={cn(
            "inline-flex min-h-tap flex-none items-center gap-1.5 rounded-full border-2 px-3 text-[13px] font-extrabold disabled:opacity-50",
            trimmed
              ? "border-edge bg-accent text-on-accent"
              : "border-line bg-transparent text-ink",
          )}
        >
          <Icon name="cut" size={16} />
          <span className="max-sm:sr-only">trim</span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.facts.name}`}
          className="grid h-11 w-11 flex-none place-items-center rounded-full border-0 bg-transparent text-ink-soft hover:bg-surface hover:text-ink"
        >
          <Icon name="close" size={18} strokeWidth={2.6} />
        </button>
      </div>
      {open && d && sel && (
        <div
          id={panel}
          className="flex flex-col gap-2.5 border-t-2 border-dashed border-line px-3 pb-3 pt-1"
        >
          {video ? (
            <video
              ref={player.ref as React.RefObject<HTMLVideoElement>}
              src={url ?? undefined}
              preload="metadata"
              playsInline
              className="sr-only"
            />
          ) : (
            <audio
              ref={player.ref as React.RefObject<HTMLAudioElement>}
              src={url ?? undefined}
              preload="metadata"
            />
          )}
          {video ? (
            <FilmstripTrimmer
              compact
              url={url}
              duration={d}
              range={sel}
              onRange={onRange}
              onSeek={player.seek}
            />
          ) : (
            <WaveformTrimmer
              compact
              blob={item.file}
              duration={d}
              range={sel}
              onRange={onRange}
              time={player.time}
              onSeek={player.seek}
              zoom={1}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => player.playRange(sel.start, sel.end)}
              aria-label={
                player.playing
                  ? "Pause"
                  : `Play the kept part of ${item.facts.name}`
              }
              className="grid h-11 w-11 place-items-center rounded-full border-2 border-edge bg-accent text-on-accent"
            >
              {player.playing ? (
                <PauseGlyph size={18} />
              ) : (
                <PlayGlyph size={18} />
              )}
            </button>
            <RangeFields
              range={sel}
              duration={d}
              onRange={onRange}
              tone="mat"
            />
            {trimmed && (
              <button
                type="button"
                onClick={() => onRange({ start: 0, end: d })}
                className="min-h-tap rounded-full border-0 bg-transparent px-2 text-[13px] font-extrabold text-ink-soft underline underline-offset-4"
              >
                whole file
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function BatchMat({
  items,
  ranges,
  tool,
  onAdd,
  onRemove,
  onRange,
  onMove,
}: {
  items: Item[];
  ranges: Record<number, Range>;
  tool: Tool;
  onAdd: (f: File[]) => void;
  onRemove: (id: number) => void;
  onRange: (id: number, r: Range) => void;
  onMove?: (id: number, by: -1 | 1) => void;
}) {
  const shelf = getShelf(tool.shelf);
  const total = items.reduce((n, it) => n + it.file.size, 0);
  const trimmed = items.filter((it) =>
    isTrimmed(ranges[it.id], it.facts.duration),
  ).length;
  return (
    <section
      aria-label="Batch"
      className="mat flex min-w-0 flex-[999_1_600px] flex-col gap-4 p-[26px_clamp(18px,2.6vw,34px)_30px] max-sm:gap-3 max-sm:p-[18px_14px_16px]"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 place-items-center rounded-[10px] border-2 border-ill-line bg-accent text-on-accent"
        >
          <Icon name="stack" />
        </span>
        <h1 className="m-0 font-display text-[26px] font-extrabold tracking-[-0.02em]">
          {items.length} files
        </h1>
        <FileChips
          items={[
            shelf.name.toLowerCase(),
            formatSize(total),
            trimmed ? `${trimmed} trimmed` : "whole files",
            ...(onMove ? ["in this order"] : []),
          ]}
          tone="mat"
          label="Batch details"
        />
        <FilePick
          onFiles={onAdd}
          multiple
          label="Add files"
          className="ml-auto inline-flex min-h-tap items-center gap-2 rounded-full border-2 border-mat-border px-4 text-sm font-extrabold text-on-mat"
        >
          <Icon name="plus" size={18} />
          add
        </FilePick>
      </div>
      <ul
        aria-label="Files in this batch"
        className="m-0 flex list-none flex-col gap-2.5 p-0"
      >
        {items.map((it, i) => (
          <BatchRow
            key={it.id}
            item={it}
            range={ranges[it.id]}
            onRange={(r) => onRange(it.id, r)}
            onRemove={() => onRemove(it.id)}
            delay={Math.min(i, 6) * 0.04}
            onMove={onMove ? (by) => onMove(it.id, by) : undefined}
            first={i === 0}
            last={i === items.length - 1}
          />
        ))}
      </ul>
    </section>
  );
}

export function BatchResultMat({
  results,
  onDownload,
  onDownloadAll,
  onTweak,
  onNew,
  error,
  notice,
}: {
  results: BatchResult[];
  onDownload: (index: number) => void;
  onDownloadAll: () => void;
  onTweak: () => void;
  onNew: () => void;
  error?: string | null;
  notice?: string | null;
}) {
  const ok = results.filter((r) => r.out);
  const before = Array.from(new Set(ok.map((r) => r.item))).reduce(
    (n, it) => n + it.file.size,
    0,
  );
  const after = ok.reduce((n, r) => n + r.out!.size, 0);
  return (
    <section
      aria-label="Your results"
      className="mat relative flex min-h-[680px] flex-1 flex-wrap items-center justify-center gap-x-14 gap-y-9 overflow-hidden p-[40px_clamp(18px,4vw,64px)] max-sm:min-h-0 max-sm:flex-col max-sm:items-stretch max-sm:gap-4 max-sm:p-[18px_16px]"
    >
      <FallingLeaves />
      <div className="relative flex flex-col items-center gap-[18px]">
        <h1 className="m-0 flex items-center gap-3 font-display text-[clamp(44px,5vw,68px)] font-extrabold leading-none tracking-[-0.04em] max-sm:hidden">
          <Sparkle size={40} color="var(--accent)" />
          Ready
        </h1>
        <div className="max-sm:hidden">
          <Jars before={before} after={after} />
        </div>
        <div className="sm:hidden">
          <Jars before={before} after={after} small />
        </div>
      </div>

      <div className="relative flex flex-[0_1_480px] flex-col gap-4">
        <ul
          aria-label="Results"
          className="m-0 flex max-h-[420px] list-none flex-col gap-2.5 overflow-y-auto p-0 pr-1 max-sm:max-h-none"
        >
          {results.map((r, i) => (
            <li
              key={`${r.item.id}-${i}`}
              className="on-mat-card flex items-center gap-3 rounded-[18px_22px_18px_16px] border-2 border-edge bg-card-on-mat py-2.5 pl-4 pr-2 text-on-card-on-mat"
            >
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate font-hand text-[24px] font-bold leading-tight">
                  {r.out?.filename ?? r.item.facts.name}
                </p>
                {r.out ? (
                  <p className="m-0 text-xs font-extrabold text-ink-soft">
                    <s>{formatSize(r.item.file.size)}</s> →{" "}
                    {formatSize(r.out.size)}
                  </p>
                ) : (
                  <p
                    className="m-0 text-xs font-extrabold text-ink-soft"
                    role="note"
                  >
                    didn&rsquo;t brew · {r.error}
                  </p>
                )}
              </div>
              {r.out && (
                <>
                  <span className="flex-none rotate-[4deg] rounded-full border-2 border-edge bg-accent px-2 py-1 text-xs font-extrabold text-on-accent">
                    {savings(r.item.file.size, r.out.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDownload(i)}
                    aria-label={`Download ${r.out.filename}`}
                    className="grid h-11 w-11 flex-none place-items-center rounded-full border-2 border-edge bg-primary text-on-primary"
                  >
                    <Icon name="download" size={20} strokeWidth={2.4} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        {ok.length < results.length && (
          <FileChips
            items={[`${ok.length} of ${results.length} ready`]}
            tone="mat"
            label="Batch summary"
          />
        )}
        {error && (
          <p
            role="alert"
            className="m-0 rounded-2xl bg-card-on-mat px-4 py-2.5 text-sm font-extrabold text-on-card-on-mat"
          >
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="m-0 text-sm font-bold text-on-mat-soft">
            {notice}
          </p>
        )}
        <button
          type="button"
          onClick={onDownloadAll}
          className="lift flex min-h-16 items-center justify-center gap-3 rounded-[20px_22px_20px_18px] border-2 border-ill-line bg-accent font-display text-2xl font-extrabold tracking-[-0.01em] text-on-accent shadow-on-mat"
        >
          <Icon name="download" size={26} strokeWidth={2.4} />
          Download all
          <span className="font-ui text-base">.zip</span>
        </button>
        <ShareButton
          files={ok.map((r) => ({ blob: r.out!.blob, name: r.out!.filename }))}
          label={`Share all ${ok.length}`}
        />
        <div className="grid grid-cols-2 gap-2.5">
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
