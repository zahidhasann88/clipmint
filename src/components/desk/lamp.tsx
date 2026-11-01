"use client";
import { useEffect, useState } from "react";
import { ICON_PATHS } from "./icons";

const KEY = "theme";

export const themeScript = `(function(){try{var s=localStorage.getItem('${KEY}');if(s==='dark'||s==='light')document.documentElement.setAttribute('data-theme',s)}catch(e){}})();`;

function effectiveDark(): boolean {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr) return attr === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useLamp(): [boolean | null, () => void] {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const sync = () => setDark(effectiveDark());
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", sync);
    };
  }, []);
  const toggle = () => {
    const next = effectiveDark() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode */
    }
  };
  return [dark, toggle];
}

export function LampToggle() {
  const [dark, toggle] = useLamp();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark ?? false}
      aria-label="Desk lamp: dark mode"
      title="Desk lamp"
      className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px_16px_14px_12px] border-2 border-edge bg-lamp-bg text-lamp-ink shadow-lamp sm:h-12 sm:w-12 sm:rounded-[16px_18px_16px_14px]"
    >
      <svg
        width="23"
        height="23"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={ICON_PATHS.lamp} />
        <path d={ICON_PATHS.lampRays} style={{ opacity: "var(--lamp-rays)" }} />
      </svg>
    </button>
  );
}
