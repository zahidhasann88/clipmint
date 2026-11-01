export interface TimedWord {
  start: number;
  end: number;
  text: string;
}

export interface Segment {
  start: number;
  end: number;
  text: string;
  words?: TimedWord[];
}

const MAX_LINE_WORDS = 12;
const LINE_GAP = 0.7;

export function wordsToSegments(words: TimedWord[]): Segment[] {
  const out: Segment[] = [];
  let cur: TimedWord[] = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({
      start: cur[0].start,
      end: cur[cur.length - 1].end,
      text: cur
        .map((w) => w.text)
        .join("")
        .trim(),
      words: cur.map((w) => ({ ...w, text: w.text.trim() })),
    });
    cur = [];
  };
  for (const w of words) {
    if (!w.text.trim()) continue;
    const last = cur[cur.length - 1];
    if (last && w.start - last.end >= LINE_GAP) flush();
    cur.push(w);
    if (cur.length >= MAX_LINE_WORDS || /[.?!。？！]$/.test(w.text.trim()))
      flush();
  }
  flush();
  return out;
}

const SNAP_REACH = 0.2;
const SNAP_FRAME = 0.01;
const LAG_MAX = 0.7;
const LAG_STEP = 0.02;
const MIN_GAP = 0.1;
const EDGE = 0.25;

function levels(samples: Float32Array, rate: number): Float32Array {
  const per = Math.max(1, Math.round(rate * SNAP_FRAME));
  const out = new Float32Array(Math.floor(samples.length / per));
  for (let f = 0; f < out.length; f++) {
    let sum = 0;
    for (let i = f * per, end = i + per; i < end; i++)
      sum += samples[i] * samples[i];
    out[f] = sum / per;
  }
  return out;
}

// Whisper's word times run late by a steady amount that differs by model
// (about 0.4 s for tiny, 0.2 s for base). The gaps it reports between words
// should be silent, so the lag is the shift that makes them quietest.
export function wordLag(
  words: TimedWord[],
  samples: Float32Array,
  rate: number,
): number {
  if (!words.length) return 0;
  const lv = levels(samples, rate);
  const gaps: [number, number][] = [
    [words[0].start - EDGE, words[0].start],
  ];
  for (let i = 1; i < words.length; i++)
    if (words[i].start - words[i - 1].end >= MIN_GAP)
      gaps.push([words[i - 1].end, words[i].start]);
  const energy = (a: number, b: number) => {
    const from = Math.max(0, Math.ceil(a / SNAP_FRAME)),
      to = Math.min(lv.length, Math.floor(b / SNAP_FRAME));
    let sum = 0;
    for (let f = from; f < to; f++) sum += lv[f];
    return sum;
  };
  let best = 0,
    least = Infinity;
  for (let lag = 0; lag <= LAG_MAX + 1e-6; lag += LAG_STEP) {
    let sum = 0;
    for (const [a, b] of gaps) sum += energy(a - lag, b - lag);
    if (sum < least * 0.999) {
      least = sum;
      best = lag;
    }
  }
  return best;
}

export function alignWords(
  words: TimedWord[],
  samples: Float32Array,
  rate: number,
): TimedWord[] {
  const lag = wordLag(words, samples, rate);
  return snapWords(
    words.map((w) => ({
      ...w,
      start: Math.max(0, w.start - lag),
      end: Math.max(0, w.end - lag),
    })),
    samples,
    rate,
  );
}

// Whisper's word times are estimates. Moving each boundary to the quietest
// nearby moment keeps a cut between two words from slicing into either one.
export function snapWords(
  words: TimedWord[],
  samples: Float32Array,
  rate: number,
): TimedWord[] {
  const out = words.map((w) => ({ ...w }));
  const per = Math.max(1, Math.round(rate * SNAP_FRAME));
  const level = (t: number) => {
    const from = Math.max(0, Math.floor(t * rate));
    const to = Math.min(samples.length, from + per);
    let sum = 0;
    for (let i = from; i < to; i++) sum += samples[i] * samples[i];
    return to > from ? sum / (to - from) : 0;
  };
  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1],
      b = out[i];
    const middle = (a.end + b.start) / 2;
    const lo = Math.max((a.start + a.end) / 2, middle - SNAP_REACH),
      hi = Math.min((b.start + b.end) / 2, middle + SNAP_REACH);
    let best = middle,
      least = Infinity;
    for (let t = lo; t <= hi; t += SNAP_FRAME) {
      const l = level(t);
      if (l < least) {
        least = l;
        best = t;
      }
    }
    a.end = best;
    b.start = best;
  }
  return out;
}

const CUE_TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;
function cueSeconds(text: string): number | null {
  const m = CUE_TIME.exec(text);
  if (!m) return null;
  return (
    +(m[1] ?? 0) * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, "0") / 1000
  );
}

export function parseSubtitles(text: string): Segment[] {
  const out: Segment[] = [];
  const blocks = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n");
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at < 0) continue;
    const [a, b] = lines[at].split("-->");
    const start = cueSeconds(a),
      end = cueSeconds(b);
    const body = lines
      .slice(at + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (start != null && end != null && end > start && body)
      out.push({ start, end, text: body });
  }
  return out;
}

const NO_SPEECH = new Set([
  "thank you",
  "thank you very much",
  "thanks",
  "thanks for watching",
  "thank you for watching",
  "thank you so much for watching",
  "thanks for listening",
  "thank you for listening",
  "please subscribe",
  "subscribe",
  "like and subscribe",
  "you",
  "bye",
  "bye bye",
  "okay",
  "oh",
  "music",
  "applause",
  "subtitles by the amara org community",
  "ご視聴ありがとうございました",
  "ありがとうございました",
  "字幕由amara org社区提供",
  "请不吝点赞 订阅 转发 打赏支持明镜与点点栏目",
  "谢谢观看",
  "시청해주셔서 감사합니다",
  "감사합니다",
  "gracias por ver",
  "gracias",
  "subtítulos realizados por la comunidad de amara org",
  "merci d avoir regardé",
  "merci",
  "sous titres réalisés para la communauté d amara org",
  "untertitel im auftrag des zdf für funk 2017",
  "untertitel der amara org community",
  "danke",
  "продолжение следует",
  "спасибо за просмотр",
  "спасибо",
  "obrigado",
]);

function looping(text: string): boolean {
  const words = plain(text).split(" ").filter(Boolean);
  if (words.length >= 8 && new Set(words).size / words.length < 0.25)
    return true;
  const chars = Array.from(plain(text).replace(/ /g, ""));
  return (
    words.length < 3 &&
    chars.length >= 16 &&
    new Set(chars).size / chars.length < 0.15
  );
}
const plain = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export function realSpeech(segments: Segment[]): Segment[] {
  const kept = segments.filter((s) => plain(s.text) !== "" && !looping(s.text));
  return kept.every((s) => NO_SPEECH.has(plain(s.text))) ? [] : kept;
}

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, "0");
function stamp(sec: number, sep: "," | ".") {
  const ms = Math.round(sec * 1000);
  return `${pad(ms / 3600000)}:${pad((ms / 60000) % 60)}:${pad((ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`;
}

export function toSRT(segments: Segment[], shift = 0): string {
  return segments
    .map(
      (s, i) =>
        `${i + 1}\n${stamp(Math.max(0, s.start + shift), ",")} --> ${stamp(Math.max(0, s.end + shift), ",")}\n${s.text}\n`,
    )
    .join("\n");
}
export function toVTT(segments: Segment[], shift = 0): string {
  return `WEBVTT\n\n${segments.map((s) => `${stamp(Math.max(0, s.start + shift), ".")} --> ${stamp(Math.max(0, s.end + shift), ".")}\n${s.text}\n`).join("\n")}`;
}
export function toText(segments: Segment[]): string {
  return segments
    .map((s) => s.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
