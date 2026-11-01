"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

export function isTyping(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (
    t.isContentEditable ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement
  )
    return true;
  return (
    t instanceof HTMLInputElement &&
    !["range", "checkbox", "radio", "button", "submit", "file"].includes(t.type)
  );
}

export function ownsKey(t: EventTarget | null, key: string): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (isTyping(t)) return true;
  const slider = t.matches('input[type="range"], [role="slider"]');
  if (key.startsWith("Arrow")) return slider;
  return (
    slider ||
    t.matches(
      'button, a[href], summary, [role="switch"], [role="button"], input',
    )
  );
}

export const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

export const modKey = (e: KeyboardEvent) => (isMac() ? e.metaKey : e.ctrlKey);

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid min-w-[26px] place-items-center rounded-md border-2 border-edge bg-paper px-1.5 py-0.5 font-ui text-xs font-extrabold text-ink">
      {children}
    </kbd>
  );
}

export function ShortcutHint({ player = true }: { player?: boolean }) {
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => setMod(isMac() ? "⌘" : "Ctrl"), []);
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-bold text-on-mat-muted max-sm:hidden [@media(hover:none)]:hidden">
      {player && (
        <>
          <span className="inline-flex items-center gap-1">
            <Kbd>Space</Kbd>play
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>I</Kbd>
            <Kbd>O</Kbd>start · end here
          </span>
        </>
      )}
      <span className="inline-flex items-center gap-1">
        <Kbd>{mod}</Kbd>
        <Kbd>Z</Kbd>undo
      </span>
      <span className="inline-flex items-center gap-1">
        <Kbd>?</Kbd>all shortcuts
      </span>
    </p>
  );
}

const ROWS: { keys: string[]; what: string }[] = [
  { keys: ["Space"], what: "Play or pause the kept part" },
  { keys: ["K"], what: "Play or pause" },
  { keys: ["←", "→"], what: "Move the playhead 1 s (with Shift: 5 s)" },
  { keys: ["I"], what: "Start the kept part at the playhead" },
  { keys: ["O"], what: "End the kept part at the playhead" },
  { keys: ["mod", "Z"], what: "Undo" },
  { keys: ["mod", "Shift", "Z"], what: "Redo" },
  { keys: ["mod", "Enter"], what: "Brew it (export)" },
  { keys: ["?"], what: "Show these shortcuts" },
];

export function ShortcutsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => setMod(isMac() ? "⌘" : "Ctrl"), []);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="shortcuts-title"
      className="w-[min(440px,calc(100vw-32px))] rounded-card border-2 border-edge bg-recipe-bg p-0 text-ink shadow-card backdrop:bg-[rgba(0,0,0,0.45)]"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h2
            id="shortcuts-title"
            className="m-0 font-hand text-[30px] font-bold leading-none"
          >
            shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-11 w-11 place-items-center rounded-full border-0 bg-surface text-ink"
          >
            <Icon name="close" strokeWidth={2.6} />
          </button>
        </div>
        <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5">
          {ROWS.map((r) => (
            <div key={r.what} className="contents">
              <dt className="flex gap-1">
                {r.keys.map((k) => (
                  <Kbd key={k}>{k === "mod" ? mod : k}</Kbd>
                ))}
              </dt>
              <dd className="m-0 text-sm font-bold">{r.what}</dd>
            </div>
          ))}
        </dl>
      </div>
    </dialog>
  );
}
