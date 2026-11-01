import { describe, expect, it } from "vitest";
import { beatPieces, beatTimes } from "./beats";
import {
  fillerRanges,
  isFiller,
  joinRanges,
  removeRanges,
  toggleRange,
} from "./textcut";
import { faceTracks } from "./track";
import {
  alignWords,
  parseSubtitles,
  snapWords,
  wordLag,
  wordsToSegments,
} from "./captions/format";
import { overlayASS, toASS, wordsOf } from "./captions/ass";
import { fontsFor, withFonts } from "./captions/fonts";
import { frameScore, pickFrames } from "./frames";

describe("text cuts", () => {
  it("spots filler words, ignoring case and punctuation", () => {
    expect(isFiller("Um,", "en")).toBe(true);
    expect(isFiller("umbrella", "en")).toBe(false);
    expect(isFiller("euh...", "fr")).toBe(true);
  });
  it("needs word timings to find fillers", () => {
    const words = [
      { start: 1, end: 1.3, text: "uh" },
      { start: 1.3, end: 2, text: "hello" },
    ];
    expect(fillerRanges([{ start: 1, end: 2, text: "uh hello", words }], "en")).toEqual([
      { start: 1, end: 1.3 },
    ]);
    expect(fillerRanges([{ start: 1, end: 2, text: "uh hello" }], "en")).toEqual([]);
  });
  it("joins touching cuts", () => {
    expect(
      joinRanges([
        { start: 3, end: 4 },
        { start: 1, end: 2 },
        { start: 2, end: 2.5 },
      ]),
    ).toEqual([
      { start: 1, end: 2.5 },
      { start: 3, end: 4 },
    ]);
  });
  it("takes cuts out of the spans that are kept", () => {
    expect(
      removeRanges(
        [
          { start: 0, end: 5 },
          { start: 6, end: 10 },
        ],
        [
          { start: 1, end: 2 },
          { start: 4, end: 7 },
        ],
      ),
    ).toEqual([
      { start: 0, end: 1 },
      { start: 2, end: 4 },
      { start: 7, end: 10 },
    ]);
  });
  it("drops slivers too short to keep", () => {
    expect(
      removeRanges([{ start: 0, end: 2 }], [{ start: 0.03, end: 2 }]),
    ).toEqual([]);
  });
  it("toggles a word in and out of the cuts", () => {
    const w = { start: 1, end: 2 };
    expect(toggleRange([], w)).toEqual([w]);
    expect(toggleRange([w], w)).toEqual([]);
  });
});

describe("subtitle files", () => {
  it("reads .srt", () => {
    expect(
      parseSubtitles(
        "1\n00:00:01,000 --> 00:00:02,500\nHello\nthere\n\n2\n00:01:00,000 --> 00:01:01,000\nBye\n",
      ),
    ).toEqual([
      { start: 1, end: 2.5, text: "Hello there" },
      { start: 60, end: 61, text: "Bye" },
    ]);
  });
  it("reads .vtt with short times, cue settings and tags", () => {
    expect(
      parseSubtitles(
        "WEBVTT\n\nNOTE skip me\n\n00:01.000 --> 00:02.000 align:start\n<b>Hi</b>\n",
      ),
    ).toEqual([{ start: 1, end: 2, text: "Hi" }]);
  });
  it("copes with Windows line endings and a byte-order mark", () => {
    expect(
      parseSubtitles("ï»¿1\r\n00:00:01,000 --> 00:00:02,000\r\nHi\r\n"),
    ).toEqual([{ start: 1, end: 2, text: "Hi" }]);
  });
  it("returns nothing for a file with no cues", () => {
    expect(parseSubtitles("not subtitles")).toEqual([]);
  });
});

describe("word timings", () => {
  it("groups words into lines at punctuation and pauses", () => {
    const seg = wordsToSegments([
      { start: 0, end: 0.4, text: " Hello" },
      { start: 0.4, end: 0.8, text: " there." },
      { start: 0.8, end: 1.2, text: " Next" },
      { start: 3, end: 3.4, text: " line" },
    ]);
    expect(seg.map((s) => s.text)).toEqual(["Hello there.", "Next", "line"]);
    expect(seg[0].words?.length).toBe(2);
    expect(seg[0].end).toBe(0.8);
  });
  it("uses real word timings when they exist, and estimates otherwise", () => {
    const words = [
      { start: 0, end: 0.1, text: "a" },
      { start: 1.5, end: 2, text: "b" },
    ];
    expect(wordsOf({ start: 0, end: 2, text: "a b", words })[1].start).toBe(1.5);
    expect(wordsOf({ start: 0, end: 2, text: "a b" })[1].start).toBeCloseTo(1);
  });
});

describe("snapping word edges", () => {
  it("moves the boundary into the quiet between two words", () => {
    const rate = 1000;
    const audio = new Float32Array(2000).fill(0.5);
    audio.fill(0, 1100, 1160);
    const [a, b] = snapWords(
      [
        { start: 0.2, end: 1, text: "one" },
        { start: 1, end: 1.8, text: "two" },
      ],
      audio,
      rate,
    );
    expect(a.end).toBeGreaterThanOrEqual(1.1);
    expect(a.end).toBeLessThan(1.16);
    expect(b.start).toBe(a.end);
  });
});

describe("correcting late word times", () => {
  const rate = 1000;
  const speech = (spans: [number, number][]) => {
    const a = new Float32Array(10 * rate);
    for (const [s, e] of spans) a.fill(0.5, s * rate, e * rate);
    return a;
  };
  const late = (spans: [number, number][], lag: number, text = "w") =>
    spans.map(([s, e]) => ({ start: s + lag, end: e + lag, text }));
  const heard: [number, number][] = [
    [1, 2],
    [2.6, 3],
    [4, 5.5],
  ];
  it("measures a steady lag from where the silence really is", () => {
    expect(wordLag(late(heard, 0.44), speech(heard), rate)).toBeCloseTo(0.44, 1);
  });
  it("finds no lag when the times are already right", () => {
    expect(wordLag(late(heard, 0), speech(heard), rate)).toBeCloseTo(0, 1);
  });
  it("moves the words back onto the speech", () => {
    const got = alignWords(late(heard, 0.3), speech(heard), rate);
    expect(got[1].start).toBeGreaterThan(2.05);
    expect(got[1].start).toBeLessThanOrEqual(2.62);
    expect(got[2].start).toBeLessThanOrEqual(4.02);
  });
  it("leaves an empty list alone", () => {
    expect(alignWords([], speech(heard), rate)).toEqual([]);
  });
});

describe("fonts for each script", () => {
  const names = (t: string, lang?: string) => fontsFor([t], lang).map((f) => f.family);
  it("adds nothing extra for plain English or Latin-1", () => {
    expect(names("Hello café")).toEqual(["Atkinson Hyperlegible"]);
    expect(withFonts("Hello café")).toBe("Hello café");
  });
  it("names the right font for each script", () => {
    expect(names("বাংলা")).toContain("Noto Sans Bengali");
    expect(names("हिन्दी")).toContain("Noto Sans Devanagari");
    expect(names("مرحبا")).toContain("Noto Sans Arabic");
    expect(names("اردو")).toContain("Noto Sans Arabic");
    expect(names("한국어")).toContain("Noto Sans KR");
    expect(names("ひらがな")).toContain("Noto Sans JP");
    expect(names("你好")).toContain("Noto Sans SC");
    expect(names("Привет")).toContain("Noto Sans");
    expect(names("İstanbul")).toContain("Noto Sans");
  });
  it("uses the spoken language to pick a font for shared Han characters", () => {
    expect(names("日本語", "ja")).toContain("Noto Sans JP");
    expect(names("中文", "zh")).toContain("Noto Sans SC");
  });
  it("switches fonts mid-line and comes back", () => {
    expect(withFonts("Hello বাংলা ok")).toBe(
      "Hello {\\fnNoto Sans Bengali}বাংলা {\\fnAtkinson Hyperlegible}ok",
    );
  });
  it("evens out tall fonts when it knows the size", () => {
    expect(withFonts("مرحبا", "ar", 40)).toBe(
      "{\\fnNoto Sans Arabic\\fs70}مرحبا{\\fnAtkinson Hyperlegible\\fs40}",
    );
  });
  it("keeps Turkish and Russian lines in one font", () => {
    expect(fontsFor(["güzel"], "tr").map((f) => f.family)).toContain("Noto Sans");
    expect(withFonts("İstanbul güzel", "tr").match(/\\fn/g)?.length).toBe(2);
  });
  it("keeps a run in one tag, so words still join up", () => {
    expect(withFonts("مرحبا بالعالم").match(/\\fn/g)?.length).toBe(2);
  });
  it("names the font in burned captions", () => {
    const ass = toASS(
      [{ start: 0, end: 1, text: "বাংলা" }],
      { style: "pop", color: "yellow", size: "M", pos: "bottom" },
      640,
      360,
    );
    expect(ass).toContain("\\fnNoto Sans Bengali");
  });
  it("writes overlay text as a timed script, taking it literally", () => {
    const ass = overlayASS("100% {x}\nনমস্কার", "top", 640, 360, 1, 4);
    expect(ass).toContain("Dialogue: 0,0:00:01.00,0:00:04.00");
    expect(ass).toContain("100% x\\N{\\fnNoto Sans Bengali\\fs28}নমস্কার");
    expect(ass).toMatch(/,8,\d+,\d+,\d+,-1/);
  });
});

describe("beats", () => {
  const clicks = (bpm: number, seconds: number, rate = 8000) => {
    const out = new Float32Array(seconds * rate);
    const every = Math.round((60 / bpm) * rate);
    for (let i = 0; i < out.length; i += every)
      for (let k = 0; k < 200 && i + k < out.length; k++) out[i + k] = 0.8;
    return out;
  };
  it("finds the beat of a steady click", () => {
    const b = beatTimes(clicks(120, 10), 8000);
    expect(b.length).toBeGreaterThan(15);
    expect(b[1] - b[0]).toBeCloseTo(0.5, 1);
  });
  it("finds nothing in silence", () => {
    expect(beatTimes(new Float32Array(8000 * 5), 8000)).toEqual([]);
  });
  it("cuts clips in turn on the beat, never running past a clip", () => {
    const beats = Array.from({ length: 21 }, (_, i) => i * 0.5);
    const clips = [
      { start: 0, end: 3 },
      { start: 1, end: 11 },
    ];
    const p = beatPieces(beats, clips);
    expect(p[0].clip).toBe(0);
    expect(p[1].clip).toBe(1);
    expect(p.length).toBeGreaterThan(2);
    for (const x of p) {
      expect(x.end).toBeLessThanOrEqual(clips[x.clip].end + 1e-3);
      expect(x.end - x.start).toBeGreaterThanOrEqual(0.7);
    }
  });
  it("stops at the piece limit", () => {
    const beats = Array.from({ length: 500 }, (_, i) => i * 0.5);
    expect(beatPieces(beats, [{ start: 0, end: 1000 }], 10).length).toBe(10);
  });
});

describe("face tracks", () => {
  const face = (x: number, y = 0.5) => ({ x, y, w: 0.1, h: 0.12 });
  it("follows two faces separately", () => {
    const t = faceTracks([
      { t: 0, faces: [face(0.2), face(0.8)] },
      { t: 1, faces: [face(0.82), face(0.22)] },
      { t: 2, faces: [face(0.24), face(0.84)] },
    ]);
    expect(t.length).toBe(2);
    const left = t.find((k) => k[0].x < 0.5)!;
    expect(left.map((k) => k.x)).toEqual([0.2, 0.22, 0.24]);
  });
  it("keeps a lone sighting: a missed blur is worse than an extra one", () => {
    expect(faceTracks([{ t: 0, faces: [face(0.5)] }, { t: 1, faces: [] }]).length).toBe(1);
  });
  it("finds no tracks when no face appears", () => {
    expect(faceTracks([{ t: 0, faces: [] }])).toEqual([]);
  });
});

describe("frame picking", () => {
  const flat = (v: number) => new Uint8ClampedArray(4 * 16 * 16).fill(v);
  const noisy = () => {
    const a = new Uint8ClampedArray(4 * 16 * 16);
    for (let i = 0; i < a.length; i++) a[i] = (i * 47) % 255;
    return a;
  };
  it("prefers a detailed frame to a black or flat one", () => {
    expect(frameScore(noisy(), 16, 16)).toBeGreaterThan(frameScore(flat(0), 16, 16));
    expect(frameScore(noisy(), 16, 16)).toBeGreaterThan(frameScore(flat(120), 16, 16));
  });
  it("keeps the picks apart in time", () => {
    const got = pickFrames(
      [
        { t: 1, score: 9 },
        { t: 1.1, score: 8 },
        { t: 5, score: 3 },
        { t: 9, score: 2 },
      ],
      2,
      1,
    );
    expect(got.map((f) => f.t)).toEqual([1, 5]);
  });
});
