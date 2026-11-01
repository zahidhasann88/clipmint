import type { Segment } from "./format";
import { BASE_FONT, withFonts } from "./fonts";

export type CaptionLook = {
  style: "classic" | "pop" | "word" | "box";
  color: "yellow" | "mint" | "pink" | "white";
  size: "S" | "M" | "L";
  pos: "bottom" | "middle";
};

export const CAPTION_COLORS: Record<CaptionLook["color"], string> = {
  yellow: "#FFD60A",
  mint: "#3DDC97",
  pink: "#FF5FA2",
  white: "#FFFFFF",
};

export interface Word {
  start: number;
  end: number;
  text: string;
}

export function wordsOf(seg: Segment): Word[] {
  if (seg.words?.length) return seg.words;
  const parts = seg.text.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  const weight = parts.map((w) => w.length + 2);
  const total = weight.reduce((a, b) => a + b, 0);
  const span = Math.max(0.05, seg.end - seg.start);
  let t = seg.start;
  return parts.map((text, i) => {
    const start = t;
    t += (span * weight[i]) / total;
    return { start, end: i === parts.length - 1 ? seg.end : t, text };
  });
}

const PER_CHUNK: Record<CaptionLook["style"], number> = {
  classic: 7,
  box: 7,
  pop: 3,
  word: 1,
};

export function chunks(
  segments: Segment[],
  style: CaptionLook["style"],
): Word[][] {
  const max = PER_CHUNK[style];
  const out: Word[][] = [];
  for (const s of segments) {
    let cur: Word[] = [];
    for (const w of wordsOf(s)) {
      cur.push(w);
      if (cur.length >= max || /[.,?!;:。、？！]$/.test(w.text)) {
        out.push(cur);
        cur = [];
      }
    }
    if (cur.length) out.push(cur);
  }
  return out;
}

export function captionAt(
  segments: Segment[],
  style: CaptionLook["style"],
  t: number,
): { words: Word[]; current: number } | null {
  for (const c of chunks(segments, style)) {
    if (t >= c[0].start && t < c[c.length - 1].end)
      return {
        words: c,
        current: c.findIndex((w) => t >= w.start && t < w.end),
      };
  }
  return null;
}

const FONT: Record<CaptionLook["size"], number> = {
  S: 0.05,
  M: 0.062,
  L: 0.076,
};
const STYLE_SCALE: Record<CaptionLook["style"], number> = {
  classic: 1,
  box: 1,
  pop: 1.22,
  word: 1.75,
};

export function captionMetrics(
  look: CaptionLook,
  width: number,
  height: number,
) {
  const short = Math.min(width, height);
  const font = Math.round(short * FONT[look.size] * STYLE_SCALE[look.style]);
  return {
    font,
    outline: Math.max(
      1,
      Math.round(
        font *
          (look.style === "box"
            ? 0.28
            : look.style === "classic"
              ? 0.09
              : 0.12),
      ),
    ),
    marginV:
      look.pos === "middle"
        ? 0
        : Math.round(height * (height > width ? 0.17 : 0.07)),
    marginH: Math.round(width * 0.06),
  };
}

function assColor(hex: string, alpha = 0): string {
  const h = hex.replace("#", "");
  const a = alpha.toString(16).padStart(2, "0").toUpperCase();
  return `&H${a}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase();
}

function assTime(s: number): string {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000),
    m = Math.floor(cs / 6000) % 60,
    sec = Math.floor(cs / 100) % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

const clean = (t: string) => t.replace(/[{}\\]/g, "");
const caps = (t: string, style: CaptionLook["style"]) =>
  style === "pop" || style === "word" ? t.toLocaleUpperCase() : t;

// Encoding -1 lets libass read each line's direction from its text.
const AUTO_DIRECTION = -1;
const ASS_STYLE_FORMAT =
  "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding";

export function overlayASS(
  text: string,
  place: "top" | "middle" | "bottom",
  width: number,
  height: number,
  from: number,
  to: number,
  language = "en",
): string {
  const size = Math.round(Math.min(width, height) * 0.07);
  const white = assColor("#FFFFFF"),
    black = assColor("#000000");
  const align = place === "top" ? 8 : place === "middle" ? 5 : 2;
  const margin = place === "middle" ? 0 : Math.round(height * 0.08);
  const style = [
    "Default",
    BASE_FONT.family,
    size,
    white,
    white,
    black,
    black,
    -1,
    0,
    0,
    0,
    100,
    100,
    0,
    0,
    1,
    Math.max(2, Math.round(size / 10)),
    0,
    align,
    Math.round(width * 0.04),
    Math.round(width * 0.04),
    margin,
    AUTO_DIRECTION,
  ].join(",");
  const body = text
    .split(/\r?\n/)
    .map((l) => withFonts(clean(l), language, size))
    .join("\\N");
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    ASS_STYLE_FORMAT,
    `Style: ${style}`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    `Dialogue: 0,${assTime(from)},${assTime(to)},Default,,0,0,0,,${body}`,
    "",
  ].join("\n");
}

export function toASS(
  segments: Segment[],
  look: CaptionLook,
  width: number,
  height: number,
  clock: (s: number) => number = (s) => s,
  language = "en",
): string {
  const m = captionMetrics(look, width, height);
  const ink = (t: string) => withFonts(clean(t), language, m.font);
  const hi = assColor(CAPTION_COLORS[look.color]);
  const white = assColor("#FFFFFF"),
    black = assColor("#000000");
  const box = look.style === "box";
  const back = assColor("#000000", 0x60);
  const align = look.pos === "middle" ? 5 : 2;
  const style = [
    "Default",
    BASE_FONT.family,
    m.font,
    white,
    white,
    box ? back : black,
    box ? back : assColor("#000000", 0x80),
    -1,
    0,
    0,
    0,
    100,
    100,
    0,
    0,
    box ? 3 : 1,
    m.outline,
    look.style === "pop" || look.style === "word"
      ? Math.round(m.font * 0.06)
      : 0,
    align,
    m.marginH,
    m.marginH,
    m.marginV,
    AUTO_DIRECTION,
  ].join(",");
  const lines: string[] = [];
  const event = (a: number, b: number, text: string) => {
    const s = clock(a),
      e = clock(b);
    if (e - s < 0.02 || e <= 0) return;
    lines.push(
      `Dialogue: 0,${assTime(Math.max(0, s))},${assTime(e)},Default,,0,0,0,,${text}`,
    );
  };
  for (const c of chunks(segments, look.style)) {
    const start = c[0].start,
      end = c[c.length - 1].end;
    if (look.style === "classic" || look.style === "box") {
      event(start, end, ink(c.map((w) => w.text).join(" ")));
    } else if (look.style === "word") {
      const w = c[0];
      event(
        w.start,
        w.end,
        `{\\1c${hi}\\fscx70\\fscy70\\t(0,90,\\fscx100\\fscy100)}${ink(caps(w.text, "word"))}`,
      );
    } else {
      c.forEach((w, i) => {
        const text = c
          .map((x, j) =>
            j === i
              ? `{\\1c${hi}\\fscx112\\fscy112}${ink(caps(x.text, "pop"))}{\\r}`
              : ink(caps(x.text, "pop")),
          )
          .join(" ");
        event(
          i === 0 ? start : w.start,
          i === c.length - 1 ? end : c[i + 1].start,
          text,
        );
      });
    }
  }
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    ASS_STYLE_FORMAT,
    `Style: ${style}`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...lines,
    "",
  ].join("\n");
}
