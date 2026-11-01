// libass here has no font fallback, so every run of text must name a font that
// has its letters. Files are served from /fonts by scripts/fetch-fonts.mjs.
export interface CaptionFont {
  family: string;
  file: string;
  scale: number;
}

export const BASE_FONT: CaptionFont = {
  family: "Atkinson Hyperlegible",
  file: "AtkinsonHyperlegible-Bold.ttf",
  scale: 1,
};
// libass fits a font's OS/2 win height into the font size, so tall fonts draw
// small. scale is each font's win height over Atkinson's, to even them out.
const font = (family: string, file: string, scale: number): CaptionFont => ({
  family,
  file,
  scale,
});
const LATIN_EXTRA = font("Noto Sans", "NotoSans.ttf", 1.22);
const BENGALI = font("Noto Sans Bengali", "NotoSansBengali.ttf", 1.13);
const DEVANAGARI = font("Noto Sans Devanagari", "NotoSansDevanagari.ttf", 1.54);
const ARABIC = font("Noto Sans Arabic", "NotoSansArabic.ttf", 1.75);
const JAPANESE = font("Noto Sans JP", "NotoSansJP-Bold.otf", 1.17);
const KOREAN = font("Noto Sans KR", "NotoSansKR-Bold.otf", 1.17);
const CHINESE = font("Noto Sans SC", "NotoSansSC-Bold.otf", 1.17);
const WHOLE_LINE_LATIN = ["tr", "ru"];

const HAN = /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;
const hanFont = (language: string) =>
  language === "ja" ? JAPANESE : language === "ko" ? KOREAN : CHINESE;

function fontOf(word: string, language: string): CaptionFont {
  if (/[\u0980-\u09FF]/.test(word)) return BENGALI;
  if (/[\u0900-\u097F]/.test(word)) return DEVANAGARI;
  if (/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(word))
    return ARABIC;
  if (/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(word)) return KOREAN;
  if (/[\u3040-\u30FF]/.test(word)) return JAPANESE;
  if (HAN.test(word)) return hanFont(language);
  // Atkinson stops at Latin-1: Turkish İ, Cyrillic and Greek are not in it.
  if (/[\u0100-\u1FFF]/.test(word)) return LATIN_EXTRA;
  // Keep one look across a line where many words need the fuller font.
  return WHOLE_LINE_LATIN.includes(language) ? LATIN_EXTRA : BASE_FONT;
}

export function withFonts(
  text: string,
  language = "en",
  size?: number,
): string {
  const tag = (f: CaptionFont) =>
    `{\\fn${f.family}${size ? `\\fs${Math.round(size * f.scale)}` : ""}}`;
  let out = "",
    open = BASE_FONT;
  for (const part of text.split(/(\s+)/)) {
    if (!part.trim()) {
      out += part;
      continue;
    }
    const f = fontOf(part, language);
    if (f !== open) out += tag(f);
    out += part;
    open = f;
  }
  return open === BASE_FONT ? out : `${out}${tag(BASE_FONT)}`;
}

export function fontsFor(texts: string[], language = "en"): CaptionFont[] {
  const out = new Set<CaptionFont>([BASE_FONT]);
  for (const t of texts)
    for (const part of t.split(/\s+/))
      if (part) out.add(fontOf(part, language));
  return Array.from(out);
}
