"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export function usePlayer<T extends HTMLMediaElement>(src: string | null) {
  const ref = useRef<T>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const stopAt = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPlaying(false); setTime(0);
    let raf = 0;
    const tick = () => {
      setTime(el.currentTime);
      if (stopAt.current != null && el.currentTime >= stopAt.current) { el.pause(); stopAt.current = null; }
      if (!el.paused) raf = requestAnimationFrame(tick);
    };
    const onPlay = () => { setPlaying(true); raf = requestAnimationFrame(tick); };
    const onPause = () => { setPlaying(false); cancelAnimationFrame(raf); setTime(el.currentTime); };
    const onSeeked = () => setTime(el.currentTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onPause);
    el.addEventListener("seeked", onSeeked);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("play", onPlay); el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onPause); el.removeEventListener("seeked", onSeeked);
      el.pause();
    };
  }, [src]);

  const seek = useCallback((t: number) => {
    const el = ref.current;
    if (!el || !Number.isFinite(t)) return;
    el.currentTime = Math.max(0, t);
    setTime(el.currentTime);
  }, []);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) { stopAt.current = null; el.play().catch(() => setPlaying(false)); } else el.pause();
  }, []);

  const playRange = useCallback((start: number, end: number) => {
    const el = ref.current;
    if (!el) return;
    if (!el.paused) { el.pause(); return; }
    if (el.currentTime < start || el.currentTime >= end - 0.05) el.currentTime = start;
    stopAt.current = end;
    el.play().catch(() => setPlaying(false));
  }, []);

  return { ref, playing, time, seek, toggle, playRange };
}
