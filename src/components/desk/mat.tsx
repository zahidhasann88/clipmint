"use client";
import { useEffect, useRef, useState } from "react";
import { DropArt, MatMug } from "./art";
import { Icon, type IconName } from "./icons";
import { ALL_INPUT_EXTS } from "@/lib/registry";
import { RECORD_MODES, Recorder, recordModes, type RecordMode } from "./record";
import { cn } from "@/lib/utils";

export const FILE_ACCEPT = [
  "audio/*",
  "video/*",
  ...ALL_INPUT_EXTS.map((e) => `.${e}`),
].join(",");

export function FilePick({
  onFiles,
  multiple,
  className,
  children,
  label,
  accept = FILE_ACCEPT,
}: {
  onFiles: (f: File[]) => void;
  multiple?: boolean;
  className?: string;
  children: React.ReactNode;
  label?: string;
  accept?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label
      className={cn("focus-ring-within cursor-pointer", className)}
      aria-label={label}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          if (list.length) onFiles(list);
          e.target.value = "";
        }}
      />
      {children}
    </label>
  );
}

export function DropAnywhere({
  onFiles,
  disabled,
}: {
  onFiles: (f: File[]) => void;
  disabled?: boolean;
}) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const cb = useRef(onFiles);
  cb.current = onFiles;
  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current++;
      if (!disabled) setOver(true);
    };
    const overFn = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer)
        e.dataTransfer.dropEffect = disabled ? "none" : "copy";
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setOver(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      const list = Array.from(e.dataTransfer?.files ?? []);
      if (list.length && !disabled) cb.current(list);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", overFn);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", overFn);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [disabled]);
  if (!over) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-[var(--gutter)]"
    >
      <div className="mat flex h-full w-full flex-col items-center justify-center gap-4 border-[3px] border-dashed border-accent opacity-95">
        <DropArt className="anim-bob" />
        <p className="m-0 font-display text-[clamp(32px,4vw,52px)] font-extrabold tracking-[-0.035em]">
          Let go to drop
        </p>
      </div>
    </div>
  );
}

export function MatRulers({ short = false }: { short?: boolean }) {
  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "ruler-x absolute left-12 top-4 h-3 rounded-sm max-sm:hidden",
          short ? "right-12" : "right-[150px]",
        )}
      />
      <div
        aria-hidden="true"
        className="ruler-y absolute bottom-12 left-4 top-12 w-3 max-sm:hidden"
      />
    </>
  );
}

export function DropMat({
  onFiles,
  error,
  warning,
  pill,
  resume,
}: {
  onFiles: (f: File[]) => void;
  error: string | null;
  warning?: string | null;
  pill?: { name: string; icon: IconName; shelf: string; tint: string } | null;
  resume?: {
    name: string;
    detail: string;
    onResume: () => void;
    onDiscard: () => void;
  } | null;
}) {
  const [recording, setRecording] = useState<RecordMode | null>(null);
  const [removed, setRemoved] = useState<string | null>(null);
  const discard = useRef(resume?.onDiscard);
  discard.current = resume?.onDiscard;
  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => {
      setRemoved(null);
      discard.current?.();
    }, 6000);
    return () => clearTimeout(t);
  }, [removed]);
  const shown = resume && !removed ? resume : null;
  const [modes, setModes] = useState<RecordMode[]>([]);
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setModes(recordModes());
    setMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
  }, []);
  if (recording) {
    return (
      <section
        aria-label="The mat"
        className="mat relative flex min-h-[640px] min-w-0 flex-[999_1_560px] items-center justify-center p-[44px_28px_28px] max-sm:min-h-0 max-sm:p-[26px_18px_22px] lg:min-h-0"
      >
        <Recorder
          mode={recording}
          onCancel={() => setRecording(null)}
          onDone={(f) => {
            setRecording(null);
            onFiles([f]);
          }}
        />
      </section>
    );
  }
  return (
    <section
      aria-label="The mat"
      className="mat relative flex min-h-[640px] min-w-0 flex-[999_1_560px] p-[44px_28px_28px] max-sm:min-h-0 max-sm:p-[26px_18px_22px] lg:min-h-0 lg:p-[clamp(30px,4.6vh,44px)_28px_clamp(18px,3vh,28px)]"
    >
      <MatRulers />
      <MatMug className="pointer-events-none absolute -top-[46px] right-[26px] max-sm:hidden" />
      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-[22px] rounded-[32px] border-[2.5px] border-dashed px-6 py-11 text-center transition-colors max-sm:gap-3.5 max-sm:border-0 max-sm:p-0 lg:min-h-0 lg:gap-[clamp(10px,2.3vh,22px)] lg:overflow-y-auto lg:py-[clamp(14px,3.5vh,44px)] lg:[justify-content:safe_center]",
          "border-[color:var(--mat-dash)]",
        )}
      >
        {shown && (
          <div className="on-mat-card flex max-w-full items-center rounded-[20px_24px_20px_18px] border-2 border-ill-line bg-card-on-mat text-on-card-on-mat shadow-on-mat">
            <button
              type="button"
              onClick={shown.onResume}
              className="flex min-w-0 items-center gap-3 rounded-[18px_0_0_16px] border-0 bg-transparent py-2.5 pl-3 pr-2 text-left text-on-card-on-mat"
            >
              <span
                aria-hidden="true"
                className="grid h-11 w-11 flex-none place-items-center rounded-[13px] bg-accent text-on-accent"
              >
                <Icon name="arrowRight" size={22} strokeWidth={2.4} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[17px] font-extrabold">
                  Continue editing {shown.name}
                </span>
                <span className="text-[13px] font-bold opacity-80">
                  {shown.detail} · a new file starts over
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRemoved(shown.name)}
              aria-label={`Remove ${shown.name}`}
              title="Remove"
              className="mr-1.5 grid h-11 w-11 flex-none place-items-center rounded-full border-0 bg-transparent text-on-card-on-mat opacity-70 hover:bg-surface hover:opacity-100"
            >
              <Icon name="close" size={18} strokeWidth={2.6} />
            </button>
          </div>
        )}
        {removed && (
          <p
            role="status"
            className="m-0 flex items-center gap-2 rounded-full bg-mat-chip py-1 pl-4 pr-1 text-sm font-extrabold"
          >
            <span className="min-w-0 truncate">Removed {removed}</span>
            <button
              type="button"
              onClick={() => setRemoved(null)}
              className="min-h-10 rounded-full border-0 bg-accent px-3.5 text-sm font-extrabold text-on-accent"
            >
              undo
            </button>
          </p>
        )}
        {pill && !shown && (
          <span
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[15px] font-extrabold text-ink"
            style={{ background: pill.tint }}
          >
            <Icon name={pill.icon} size={18} />
            {pill.name} · {pill.shelf.toLowerCase()}
          </span>
        )}
        <DropArt
          className={cn(
            "anim-bob h-auto max-sm:w-[150px] lg:w-[clamp(120px,22vh,210px)]",
            shown && "max-sm:hidden lg:w-[clamp(90px,15vh,150px)]",
          )}
        />
        <h1 className="m-0 font-display text-[clamp(36px,4.6vw,60px)] font-extrabold leading-[0.98] tracking-[-0.035em] lg:text-[clamp(34px,min(4.6vw,6.8vh),60px)]">
          <span className="max-sm:hidden">
            Drop a file
            <br />
            on the mat
          </span>
          <span className="sm:hidden">Pick a file</span>
        </h1>
        <FilePick
          onFiles={onFiles}
          multiple
          className="inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-button border-2 border-ill-line bg-accent pl-[18px] pr-6 text-[17px] font-extrabold text-on-accent shadow-on-mat max-sm:min-h-[54px] max-sm:self-stretch"
        >
          <Icon name="folder" size={22} />
          <span className="max-sm:hidden">or browse</span>
          <span className="sm:hidden">Open files</span>
        </FilePick>
        {modes.length > 0 && (
          <div
            role="group"
            aria-label="Record"
            className="flex flex-wrap items-center justify-center gap-2"
          >
            <span className="text-sm font-extrabold text-on-mat-soft">
              or record
            </span>
            {RECORD_MODES.filter((m) => modes.includes(m.id)).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setRecording(m.id)}
                className="inline-flex min-h-tap items-center gap-1.5 rounded-full border-2 border-mat-border bg-transparent px-3.5 text-sm font-extrabold text-on-mat"
              >
                <Icon name={m.icon} size={18} />
                {m.label}
              </button>
            ))}
          </div>
        )}
        <p className="m-0 -mt-2 text-xs font-bold text-on-mat-muted max-sm:hidden [@media(hover:none)]:hidden lg:[@media(max-height:820px)]:hidden">
          copied a file? paste it with {mac ? "⌘" : "Ctrl"}+V
        </p>
        {error && (
          <p
            role="alert"
            className="m-0 max-w-md rounded-2xl bg-card-on-mat px-4 py-2.5 text-[15px] font-extrabold text-on-card-on-mat"
          >
            {error}
          </p>
        )}
        {warning && (
          <p
            role="status"
            className="m-0 max-w-md text-sm font-bold text-on-mat-soft"
          >
            {warning}
          </p>
        )}
        <p className="m-0 max-w-[560px] text-[15px] font-bold text-on-mat-soft max-sm:text-sm">
          Trim, compress, crop, resize, speed up, caption, clean up, convert,
          merge or make a GIF, all in one editor.
        </p>
        <ul
          aria-label="Formats"
          className="m-0 flex max-w-[520px] list-none flex-wrap justify-center gap-1.5 p-0 max-sm:hidden lg:[@media(max-height:900px)]:hidden"
        >
          {ALL_INPUT_EXTS.map((f) => (
            <li
              key={f}
              className="rounded-full bg-mat-chip px-2.5 py-1 text-xs font-extrabold uppercase tracking-[0.06em]"
            >
              {f}
            </li>
          ))}
        </ul>
        <p className="m-0 mt-1.5 inline-flex items-center gap-2 font-hand text-[26px] font-bold text-accent max-sm:mt-0 max-sm:text-[22px]">
          <Icon name="home" size={22} />
          <span className="max-sm:hidden">never leaves your device</span>
          <span className="sm:hidden">stays on your phone</span>
        </p>
      </div>
    </section>
  );
}
