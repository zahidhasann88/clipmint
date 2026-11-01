import { describe, expect, it } from "vitest";
import { keepSpans, keptSeconds } from "./jumpcut";
import type { Envelope } from "./highlights";

/** 10 frames a second: loud (-10 dB) where `talk` says so, quiet (-60 dB) elsewhere. */
function env(seconds: number, talk: [number, number][]): Envelope {
  const db = new Float32Array(seconds * 10).map((_, i) =>
    talk.some(([a, b]) => i / 10 >= a && i / 10 < b) ? -10 : -60,
  );
  return { rate: 10, db };
}

describe("jump cuts", () => {
  const talk = env(20, [
    [2, 6],
    [6.3, 9],
    [11, 15],
    [17, 18.5],
  ]);
  const all = { start: 0, end: 20 };

  it("cuts long pauses and the quiet ends, keeping a little either side", () => {
    const keep = keepSpans(talk, all, "pauses");
    expect(keep).toEqual([
      { start: 1.85, end: 9.15 },
      { start: 10.85, end: 15.15 },
      { start: 16.85, end: 18.65 },
    ]);
  });
  it("leaves short breaths alone", () => {
    expect(
      keepSpans(talk, all, "pauses").some((k) => k.start < 6 && k.end > 6.3),
    ).toBe(true);
  });
  it("only trims the ends in 'ends' mode", () => {
    expect(keepSpans(talk, all, "ends")).toEqual([{ start: 1.85, end: 18.65 }]);
  });
  it("works inside a trim", () => {
    const keep = keepSpans(talk, { start: 8, end: 16 }, "pauses");
    expect(keep[0].start).toBe(8);
    expect(keep[keep.length - 1].end).toBeLessThanOrEqual(16);
    expect(keptSeconds(keep)).toBeLessThan(8);
  });
  it("keeps everything when it's all quiet (nothing to go by)", () => {
    expect(keepSpans(env(10, []), { start: 0, end: 10 }, "pauses")).toEqual([
      { start: 0, end: 10 },
    ]);
  });
});
