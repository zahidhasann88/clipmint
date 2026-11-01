import { describe, expect, it } from "vitest";
import { keepSpeech, onSpeech, speechRegions, speechWithin } from "./vad";

const STEP = 0.032;
function probs(
  seconds: number,
  spans: [number, number, number?][],
): Float32Array {
  const out = new Float32Array(Math.round(seconds / STEP)).fill(0.05);
  for (const [a, b, p = 0.9] of spans)
    for (let i = Math.round(a / STEP); i < Math.round(b / STEP); i++)
      out[i] = p;
  return out;
}

describe("speechRegions", () => {
  it("finds nothing in noise", () => {
    expect(speechRegions(probs(8.4, []))).toEqual([]);
    expect(speechRegions(probs(8.4, [[2, 6, 0.4]]))).toEqual([]);
  });

  it("finds speech, padded", () => {
    const r = speechRegions(probs(10, [[2, 5]]));
    expect(r).toHaveLength(1);
    expect(r[0].start).toBeCloseTo(1.8, 1);
    expect(r[0].end).toBeCloseTo(5.2, 1);
  });

  it("bridges short pauses and drops clicks", () => {
    expect(
      speechRegions(
        probs(10, [
          [1, 3],
          [3.15, 5],
        ]),
      ),
    ).toHaveLength(1);
    expect(
      speechRegions(
        probs(10, [
          [1, 3],
          [6, 6.1],
        ]),
      ),
    ).toHaveLength(1);
  });

  it("splits on a real pause", () => {
    expect(
      speechRegions(
        probs(10, [
          [1, 3],
          [5, 7],
        ]),
      ),
    ).toHaveLength(2);
  });

  it("closes speech that runs to the end", () => {
    const r = speechRegions(probs(6, [[4, 6]]));
    expect(r[0].end).toBeCloseTo(6, 1);
  });
});

describe("using the regions", () => {
  const regions = [
    { start: 2, end: 4 },
    { start: 6, end: 7 },
  ];

  it("measures speech in a window", () => {
    expect(speechWithin(regions, 0, 10)).toBeCloseTo(3);
    expect(speechWithin(regions, 3, 6.5)).toBeCloseTo(1.5);
  });

  it("silences everything else, keeping the timing", () => {
    const out = keepSpeech(
      new Float32Array(10).fill(1),
      [{ start: 0.2, end: 0.5 }],
      10,
    );
    expect(Array.from(out)).toEqual([0, 0, 1, 1, 1, 0, 0, 0, 0, 0]);
  });

  it("drops captions that don't line up with speech", () => {
    const segs = [
      { start: 2.1, end: 3.9, text: "real" },
      { start: 8.5, end: 9.5, text: "invented" },
    ];
    expect(onSpeech(segs, regions).map((s) => s.text)).toEqual(["real"]);
  });
});
