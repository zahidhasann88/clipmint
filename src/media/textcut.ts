import type { Segment } from "./captions/format";
import type { Range } from "./recipe";

const FILLERS: Record<string, string[]> = {
  en: ["um", "umm", "uh", "uhh", "uhm", "er", "erm", "ah", "hmm", "mm", "mhm"],
  es: ["eh", "em", "este", "mmm"],
  fr: ["euh", "heu", "bah", "ben"],
  de: ["äh", "ähm", "öh", "hm"],
  pt: ["ãh", "éh", "hum"],
  it: ["ehm", "uhm", "mah"],
  nl: ["eh", "ehm", "uhm"],
  ru: ["э", "эм", "ээ", "мм"],
  tr: ["ıı", "şey", "ee"],
  hi: ["अं", "उम", "हम्म"],
  bn: ["উম", "আহ", "হুম"],
  ja: ["えー", "あの", "えっと"],
  ko: ["음", "어", "그"],
  zh: ["嗯", "呃", "那个"],
};

const bare = (w: string) =>
  w
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]/gu, "")
    .trim();

export function isFiller(word: string, language: string): boolean {
  const w = bare(word);
  return !!w && (FILLERS[language] ?? FILLERS.en).includes(w);
}

export function fillerRanges(segments: Segment[], language: string): Range[] {
  const out: Range[] = [];
  for (const s of segments)
    for (const w of s.words ?? [])
      if (isFiller(w.text, language)) out.push({ start: w.start, end: w.end });
  return out;
}

export function joinRanges(list: Range[]): Range[] {
  const out: Range[] = [];
  for (const r of list.slice().sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + 0.01) last.end = Math.max(last.end, r.end);
    else if (r.end > r.start) out.push({ ...r });
  }
  return out;
}

export function removeRanges(
  keep: Range[],
  cuts: Range[],
  minKeep = 0.08,
): Range[] {
  const gone = joinRanges(cuts);
  const out: Range[] = [];
  for (const k of keep) {
    let at = k.start;
    for (const c of gone) {
      if (c.end <= at || c.start >= k.end) continue;
      if (c.start - at >= minKeep) out.push({ start: at, end: c.start });
      at = Math.max(at, c.end);
    }
    if (k.end - at >= minKeep) out.push({ start: at, end: k.end });
  }
  return out;
}

export function toggleRange(list: Range[], word: Range): Range[] {
  const hit = list.some((r) => r.start < word.end && r.end > word.start);
  return hit
    ? list.filter((r) => !(r.start < word.end && r.end > word.start))
    : [...list, word];
}
