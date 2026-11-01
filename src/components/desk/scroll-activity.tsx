"use client";
import { useEffect } from "react";

const HIDE_AFTER_MS = 900;

export function ScrollActivity() {
  useEffect(() => {
    const timers = new Map<Element, number>();
    const onScroll = (e: Event) => {
      const el =
        e.target === document
          ? document.documentElement
          : (e.target as Element);
      if (!(el instanceof Element)) return;
      el.classList.add("is-scrolling");
      window.clearTimeout(timers.get(el));
      timers.set(
        el,
        window.setTimeout(() => {
          el.classList.remove("is-scrolling");
          timers.delete(el);
        }, HIDE_AFTER_MS),
      );
    };
    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      timers.forEach((t, el) => {
        window.clearTimeout(t);
        el.classList.remove("is-scrolling");
      });
    };
  }, []);
  return null;
}
