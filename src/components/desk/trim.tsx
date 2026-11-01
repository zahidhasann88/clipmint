"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ClipHead } from "./art";
import { Icon } from "./icons";
import { usePeaks } from "./use-peaks";
import { clock, clockTenths, parseClock, type Range } from "@/media/recipe";
import { cn } from "@/lib/utils";

const MIN_SEL = 0.1;
const round3 = (t: number) => Math.round(t * 1000) / 1000;

function useTrack(
  duration: number,
  range: Range,
  onRange: (r: Range) => void,
  onSeek: (t: number) => void,
) {
  const innerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<"start" | "end" | "seek" | null>(null);
  const timeAt = (clientX: number) => {
    const r = innerRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * duration;
  };
  const apply = (which: "start" | "end", t: number) => {
    t = Math.min(duration, Math.max(0, t));
    if (which === "start")
      onRange({
        start: round3(Math.min(t, range.end - MIN_SEL)),
        end: range.end,
      });
    else
      onRange({
        start: range.start,
        end: round3(Math.max(t, range.start + MIN_SEL)),
      });
  };
  const down = (which: "start" | "end" | "seek") => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    drag.current = which;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (which === "seek") onSeek(timeAt(e.clientX));
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d === "seek") onSeek(timeAt(e.clientX));
    else apply(d, timeAt(e.clientX));
  };
  const up = () => {
    drag.current = null;
  };
  const key = (which: "start" | "end") => (e: React.KeyboardEvent) => {
    const cur = which === "start" ? range.start : range.end;
    const step = e.shiftKey ? 1 : 0.1;
    const next =
      e.key === "ArrowLeft" || e.key === "ArrowDown"
        ? cur - step
        : e.key === "ArrowRight" || e.key === "ArrowUp"
          ? cur + step
          : e.key === "PageDown"
            ? cur - 10
            : e.key === "PageUp"
              ? cur + 10
              : e.key === "Home"
                ? 0
                : e.key === "End"
                  ? duration
                  : null;
    if (next == null) return;
    e.preventDefault();
    apply(which, next);
  };
  const pct = (t: number) =>
    duration > 0 ? Math.min(100, Math.max(0, (t / duration) * 100)) : 0;
  return { innerRef, down, move, up, key, pct };
}

function Handle({
  which,
  value,
  duration,
  left,
  variant,
  track,
  className,
}: {
  which: "start" | "end";
  value: number;
  duration: number;
  left: string;
  variant: "wave" | "film";
  track: ReturnType<typeof useTrack>;
  className: string;
}) {
  return (
    <div
      role="slider"
      tabIndex={0}
      data-handle={which}
      aria-label={`${which === "start" ? "Start" : "End"} clip. Arrow keys nudge.`}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration * 10) / 10}
      aria-valuenow={Math.round(value * 10) / 10}
      aria-valuetext={clockTenths(value)}
      onPointerDown={track.down(which)}
      onPointerMove={track.move}
      onPointerUp={track.up}
      onPointerCancel={track.up}
      onKeyDown={track.key(which)}
      className={cn(
        "clip-handle absolute z-20 flex w-11 -translate-x-1/2 cursor-ew-resize touch-none select-none flex-col items-center rounded-lg",
        className,
      )}
      style={{ left }}
    >
      <ClipHead variant={variant} size={variant === "wave" ? 36 : 36} />
      {variant === "wave" && (
        <span
          className="w-[3px] flex-1 rounded-sm"
          style={{ background: "var(--clip-body)" }}
        />
      )}
    </div>
  );
}

export function TimeField({
  label,
  value,
  min,
  max,
  onCommit,
  tone,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (t: number) => void;
  tone: "mat" | "pill";
}) {
  const id = useId();
  const [text, setText] = useState(clockTenths(value));
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setText(clockTenths(value));
    setBad(false);
  }, [value]);
  const commit = () => {
    const t = parseClock(text);
    if (t == null || t < min - 0.001 || t > max + 0.001) {
      setBad(true);
      setText(clockTenths(value));
      return;
    }
    setBad(false);
    onCommit(t);
  };
  const input = (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={text}
      aria-invalid={bad || undefined}
      autoComplete="off"
      spellCheck={false}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      className={cn(
        "h-9 w-[74px] rounded-[10px] border-2 text-center text-[15px] font-extrabold tabular-nums",
        tone === "mat"
          ? "border-ill-line bg-ill-cream text-ill-line"
          : "border-transparent bg-transparent text-on-accent",
        bad && "border-accent",
      )}
    />
  );
  return tone === "mat" ? (
    <label
      htmlFor={id}
      className="flex min-h-tap items-center gap-2 rounded-[14px] bg-mat-chip pl-3 pr-1.5 text-[13px] font-extrabold"
    >
      <span>{label}</span>
      {input}
    </label>
  ) : (
    <label
      htmlFor={id}
      className="flex items-center rounded-full bg-accent pl-2.5 text-xs font-extrabold text-on-accent"
    >
      <span className="sr-only">{label}</span>
      {input}
    </label>
  );
}

export function KeepChip({
  seconds,
  tone = "accent",
}: {
  seconds: number;
  tone?: "accent" | "soft";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-tap items-center gap-2 rounded-[14px] px-3.5 text-sm font-extrabold max-sm:min-h-0 max-sm:px-3 max-sm:py-2 max-sm:text-[13px]",
        tone === "accent" ? "bg-accent text-on-accent" : "bg-mat-chip",
      )}
    >
      <Icon name="cut" size={18} />
      keep {clockTenths(seconds)}
    </span>
  );
}

function niceStep(seconds: number) {
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
  return steps.find((s) => s >= seconds) ?? 3600;
}

export function WaveformTrimmer({
  blob,
  duration,
  range,
  onRange,
  time,
  onSeek,
  zoom,
  fades,
  compact,
}: {
  blob: Blob;
  duration: number;
  range: Range;
  onRange: (r: Range) => void;
  time: number;
  onSeek: (t: number) => void;
  zoom: number;
  fades?: { in: number; out: number };
  compact?: boolean;
}) {
  const track = useTrack(duration, range, onRange, onSeek);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || duration <= 0) return;
    el.scrollLeft = (time / duration) * el.scrollWidth - el.clientWidth / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const bars = Math.max(32, Math.floor((width * zoom) / 7.5));
  const peaks = usePeaks(blob, bars);
  const step = niceStep(duration / Math.max(3, (width * zoom) / 110));
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 0.001; t += step) ticks.push(t);

  return (
    <div className="on-mat-card relative rounded-[26px_30px_26px_24px] border-2 border-edge bg-card-on-mat px-[18px] pb-3 text-on-card-on-mat shadow-on-mat max-sm:rounded-[20px] max-sm:px-2.5">
      <div
        ref={scrollRef}
        className={cn(
          "relative pb-3.5",
          compact ? "pt-9" : "pt-10 max-sm:pt-[34px]",
          zoom > 1 ? "overflow-x-auto" : "overflow-visible",
        )}
      >
        <div
          ref={track.innerRef}
          className="relative"
          style={{ width: `${zoom * 100}%` }}
        >
          <div
            className={cn(
              "relative cursor-pointer touch-none",
              compact ? "h-[72px]" : "h-[200px] max-sm:h-[120px]",
            )}
            onPointerDown={track.down("seek")}
            onPointerMove={track.move}
            onPointerUp={track.up}
            onPointerCancel={track.up}
          >
            <div
              aria-hidden="true"
              className="absolute -bottom-2 -top-2 rounded-[10px] bg-selection"
              style={{
                left: `${track.pct(range.start)}%`,
                width: `${track.pct(range.end) - track.pct(range.start)}%`,
              }}
            />
            <div
              aria-hidden="true"
              className="relative flex h-full items-center gap-0.5"
            >
              {Array.from({ length: bars }, (_, i) => {
                const t = ((i + 0.5) / bars) * duration;
                const on = t >= range.start && t <= range.end;
                const h = peaks
                  ? Math.max(compact ? 4 : 6, peaks[i] * (compact ? 64 : 190))
                  : compact
                    ? 6
                    : 10;
                return (
                  <span
                    key={i}
                    className="flex-1 rounded-[3px]"
                    style={{
                      height: `min(${h}px, 95%)`,
                      background: on ? "var(--primary)" : "var(--wave-off)",
                    }}
                  />
                );
              })}
            </div>
            {fades &&
              (fades.in > 0 || fades.out > 0) &&
              (() => {
                const a = track.pct(range.start),
                  b = track.pct(range.end);
                const fi = track.pct(
                    Math.min(range.end, range.start + fades.in),
                  ),
                  fo = track.pct(Math.max(range.start, range.end - fades.out));
                return (
                  <svg
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    {fades.in > 0 && (
                      <path
                        d={`M${a} 100L${fi} 0L${a} 0Z`}
                        fill="var(--card-on-mat)"
                        opacity=".7"
                      />
                    )}
                    {fades.out > 0 && (
                      <path
                        d={`M${b} 100L${fo} 0L${b} 0Z`}
                        fill="var(--card-on-mat)"
                        opacity=".7"
                      />
                    )}
                    {fades.in > 0 && (
                      <path
                        d={`M${a} 100L${fi} 0`}
                        stroke="var(--wood)"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                        strokeDasharray="5 4"
                      />
                    )}
                    {fades.out > 0 && (
                      <path
                        d={`M${b} 100L${fo} 0`}
                        stroke="var(--wood)"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                        strokeDasharray="5 4"
                      />
                    )}
                  </svg>
                );
              })()}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-2 -top-3.5 z-10 w-0.5 bg-wood"
              style={{ left: `${track.pct(time)}%` }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-[22px] z-10 h-3.5 w-3.5 -translate-x-[6px] rounded-full border-2 border-edge bg-wood"
              style={{ left: `${track.pct(time)}%` }}
            />
          </div>
          <Handle
            which="start"
            value={range.start}
            duration={duration}
            left={`${track.pct(range.start)}%`}
            variant="wave"
            track={track}
            className={
              compact
                ? "-bottom-3.5 -top-9"
                : "-bottom-3.5 -top-11 max-sm:-top-9"
            }
          />
          <Handle
            which="end"
            value={range.end}
            duration={duration}
            left={`${track.pct(range.end)}%`}
            variant="wave"
            track={track}
            className={
              compact
                ? "-bottom-3.5 -top-9"
                : "-bottom-3.5 -top-11 max-sm:-top-9"
            }
          />
          <div
            aria-hidden="true"
            className={cn(
              "relative mt-[18px] h-6 border-t-2 border-edge pt-2 text-xs font-extrabold text-ink-soft max-sm:hidden",
              compact && "hidden",
            )}
          >
            {ticks.map((t, i) => (
              <span
                key={t}
                className={cn(
                  "absolute top-2 tabular-nums",
                  i > 0 && "-translate-x-1/2",
                )}
                style={{ left: `${track.pct(t)}%` }}
              >
                {clock(t)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function useFrames(
  url: string | null,
  duration: number | null,
  count: number,
): (string | null)[] {
  const [frames, setFrames] = useState<(string | null)[]>(() =>
    Array(count).fill(null),
  );
  useEffect(() => {
    setFrames(Array(count).fill(null));
    if (!url || !duration) return;
    let live = true;
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.playsInline = true;
    v.src = url;
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d");
    const grab = (i: number) => {
      if (!live || i >= count || !ctx) return;
      const onSeeked = () => {
        v.removeEventListener("seeked", onSeeked);
        if (!live) return;
        const s = Math.max(
          canvas.width / v.videoWidth,
          canvas.height / v.videoHeight,
        );
        const w = v.videoWidth * s,
          h = v.videoHeight * s;
        ctx.drawImage(v, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        let data: string | null = null;
        try {
          data = canvas.toDataURL("image/jpeg", 0.6);
        } catch {
          data = null;
        }
        setFrames((f) => {
          const n = f.slice();
          n[i] = data;
          return n;
        });
        grab(i + 1);
      };
      v.addEventListener("seeked", onSeeked);
      v.currentTime = Math.min(duration - 0.05, ((i + 0.5) / count) * duration);
    };
    v.addEventListener("loadeddata", () => grab(0), { once: true });
    return () => {
      live = false;
      v.removeAttribute("src");
      v.load();
    };
  }, [url, duration, count]);
  return frames;
}

export function FilmstripTrimmer({
  url,
  duration,
  range,
  onRange,
  onSeek,
  compact,
}: {
  url: string | null;
  duration: number;
  range: Range;
  onRange: (r: Range) => void;
  onSeek: (t: number) => void;
  compact?: boolean;
}) {
  const track = useTrack(duration, range, onRange, onSeek);
  const frames = useFrames(url, duration, compact ? 8 : 12);
  const a = track.pct(range.start),
    b = track.pct(range.end);
  return (
    <div className="relative pb-1 pt-[30px] max-sm:pt-6">
      <div
        ref={track.innerRef}
        className="relative cursor-pointer touch-none rounded-[14px] bg-film px-2 py-[9px]"
        onPointerDown={track.down("seek")}
        onPointerMove={track.move}
        onPointerUp={track.up}
        onPointerCancel={track.up}
      >
        <div aria-hidden="true" className="film-holes h-[5px] rounded-sm" />
        <div aria-hidden="true" className="my-[7px] flex gap-1">
          {frames.map((src, i) => (
            <span
              key={i}
              className={cn(
                "flex flex-1 overflow-hidden rounded-md bg-mat",
                compact
                  ? "h-9"
                  : "h-[54px] max-sm:h-10 max-sm:[&:nth-child(odd)]:hidden",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {src && (
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              )}
            </span>
          ))}
        </div>
        <div aria-hidden="true" className="film-holes h-[5px] rounded-sm" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 rounded-l-[14px] bg-film-dim"
          style={{ width: `${a}%` }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 rounded-r-[14px] bg-film-dim"
          style={{ width: `${100 - b}%` }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[3px] -top-[3px] rounded-lg border-[3px] border-accent"
          style={{ left: `${a}%`, width: `${b - a}%` }}
        />
      </div>
      <Handle
        which="start"
        value={range.start}
        duration={duration}
        left={`${a}%`}
        variant="film"
        track={track}
        className="-bottom-1.5 top-0"
      />
      <Handle
        which="end"
        value={range.end}
        duration={duration}
        left={`${b}%`}
        variant="film"
        track={track}
        className="-bottom-1.5 top-0"
      />
    </div>
  );
}
