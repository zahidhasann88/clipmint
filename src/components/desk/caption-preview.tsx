"use client";
import {
  CAPTION_COLORS,
  captionAt,
  captionMetrics,
  type CaptionLook,
} from "@/media/captions/ass";
import type { Segment } from "@/media/captions";

const SAMPLE: Segment[] = [
  { start: 0, end: 2.4, text: "your captions look like this" },
];

export function CaptionPreview({
  look,
  lines,
  time,
  rect,
  aspect,
}: {
  look: CaptionLook;
  lines: Segment[] | null;
  time: number;
  rect: { left: number; top: number; width: number; height: number };
  aspect: number;
}) {
  const at = lines
    ? captionAt(lines, look.style, time)
    : captionAt(SAMPLE, look.style, time % 3);
  if (!at) return null;
  const W = 1000,
    H = 1000 / aspect;
  const m = captionMetrics(look, W, H);
  const font = (m.font / Math.min(W, H)) * 100; // cqmin
  const caps = look.style === "pop" || look.style === "word";
  const hi = CAPTION_COLORS[look.color];
  const box = look.style === "box";
  const stroke: React.CSSProperties = box
    ? {}
    : {
        WebkitTextStroke: `${(m.outline / m.font) * 2}em #000`,
        paintOrder: "stroke fill",
      };
  const words =
    look.style === "word" ? [at.words[Math.max(0, at.current)]] : at.words;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute flex justify-center [container-type:size]"
      style={{
        left: `${rect.left}%`,
        top: `${rect.top}%`,
        width: `${rect.width}%`,
        height: `${rect.height}%`,
      }}
    >
      <p
        className="absolute m-0 text-center font-caption font-bold leading-[1.15]"
        style={{
          fontSize: `${font}cqmin`,
          color: "#fff",
          left: `${(m.marginH / W) * 100}%`,
          right: `${(m.marginH / W) * 100}%`,
          ...(look.pos === "middle"
            ? { top: "50%", transform: "translateY(-50%)" }
            : { bottom: `${(m.marginV / H) * 100}%` }),
        }}
      >
        <span
          style={{
            ...stroke,
            ...(box
              ? {
                  background: "rgba(0,0,0,.62)",
                  padding: "0.1em 0.28em",
                  boxDecorationBreak: "clone",
                  WebkitBoxDecorationBreak: "clone",
                }
              : {}),
          }}
        >
          {words.map((w, i) => {
            const text = caps ? w.text.toLocaleUpperCase() : w.text;
            const lit =
              look.style === "word" ||
              (look.style === "pop" && i === at.current);
            return (
              <span key={i}>
                {i > 0 && " "}
                <span
                  style={
                    lit
                      ? {
                          color: hi,
                          fontSize: look.style === "pop" ? "1.12em" : undefined,
                        }
                      : undefined
                  }
                >
                  {text}
                </span>
              </span>
            );
          })}
        </span>
      </p>
    </div>
  );
}
