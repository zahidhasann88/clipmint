"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { goodBits, lengthsFor, type Pick } from "@/media/highlights";
import { loudness } from "@/media/loudness";
import type { Range } from "@/media/recipe";
import { cn } from "@/lib/utils";

export function GoodBit({
  file,
  duration,
  range,
  onPick,
}: {
  file: File;
  duration: number;
  range: Range;
  onPick: (r: Range) => void;
}) {
  const lengths = lengthsFor(duration);
  const picks = useRef(new Map<number, Pick[]>());
  const ac = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [current, setCurrent] = useState<{
    length: number;
    index: number;
  } | null>(null);

  useEffect(() => {
    picks.current.clear();
    setCurrent(null);
    setStatus("");
    setBusy(false);
    return () => {
      ac.current?.abort();
      ac.current = null;
    };
  }, [file]);

  const shown = current && picks.current.get(current.length)?.[current.index];
  const onPickNow =
    !!shown &&
    Math.abs(shown.start - range.start) < 0.05 &&
    Math.abs(shown.end - range.end) < 0.05;

  if (!lengths.length) return null;
  const note = busy || !current || onPickNow ? status : "";

  const choose = async (length: number) => {
    let list = picks.current.get(length);
    if (!list) {
      setBusy(true);
      setStatus("listening for the good bit…");
      ac.current?.abort();
      const ctl = new AbortController();
      ac.current = ctl;
      try {
        const env = await loudness(file, ctl.signal);
        if (ctl.signal.aborted) return;
        list = env ? goodBits(env, length) : [];
        picks.current.set(length, list);
      } catch {
        if (!ctl.signal.aborted) {
          setCurrent(null);
          setStatus("couldn't listen to this file");
        }
        return;
      } finally {
        if (ac.current === ctl) setBusy(false);
      }
      if (!list.length) {
        setCurrent(null);
        setStatus("no sound to go by");
        return;
      }
    }
    if (!list.length) return;
    const index =
      onPickNow && current?.length === length
        ? (current.index + 1) % list.length
        : 0;
    const p = list[index];
    setCurrent({ length, index });
    onPick({ start: p.start, end: Math.min(duration, p.end) });
    setStatus(
      list.length > 1
        ? `pick ${index + 1} of ${list.length}, again for another`
        : "the best bit",
    );
  };

  return (
    <div
      role="group"
      aria-label="Find the good bit"
      className="flex min-h-tap flex-wrap items-center gap-1.5 rounded-[14px] bg-mat-chip py-1 pl-3 pr-1.5 text-[13px] font-extrabold"
    >
      <Icon name="wand" size={18} />
      <span>good bit</span>
      {lengths.map((l) => {
        const on = onPickNow && current?.length === l;
        return (
          <button
            key={l}
            type="button"
            disabled={busy}
            onClick={() => choose(l)}
            aria-pressed={on}
            aria-label={`Find the best ${l} seconds`}
            className={cn(
              "h-9 min-w-[44px] rounded-[10px] border-2 border-ill-line px-2 text-[15px] font-extrabold tabular-nums disabled:opacity-60",
              on ? "bg-accent text-on-accent" : "bg-ill-cream text-ill-line",
            )}
          >
            {l}s
          </button>
        );
      })}
      <span
        role="status"
        aria-live="polite"
        className={cn(
          "basis-full pl-[26px] text-xs font-bold text-on-mat-muted",
          !note && "sr-only",
        )}
      >
        {note}
      </span>
    </div>
  );
}
