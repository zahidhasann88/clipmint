import { describe, expect, it } from "vitest";
import { activity, goodBits, lengthsFor, type Envelope } from "./highlights";

function env(
  seconds: number,
  parts: [number, number, number][],
  bed = -60,
): Envelope {
  const db = new Float32Array(seconds * 10).fill(bed);
  for (const [a, b, d] of parts)
    for (let i = a * 10; i < b * 10; i++) db[i] = d;
  return { rate: 10, db };
}

describe("goodBits", () => {
  it("finds the loud stretch", () => {
    const [best] = goodBits(env(120, [[40, 55, -12]]), 15);
    expect(best.start).toBeGreaterThanOrEqual(39);
    expect(best.end).toBeLessThanOrEqual(56);
    expect(best.end - best.start).toBeGreaterThan(13);
  });

  it("returns several picks that don't overlap, best first", () => {
    const picks = goodBits(
      env(180, [
        [10, 40, -14],
        [90, 120, -20],
        [140, 170, -10],
      ]),
      30,
    );
    expect(picks.length).toBe(3);
    expect(picks[0].start).toBeGreaterThanOrEqual(139);
    expect(picks[0].score).toBeGreaterThanOrEqual(picks[1].score);
    for (let i = 0; i < picks.length; i++)
      for (let j = i + 1; j < picks.length; j++)
        expect(
          picks[i].end <= picks[j].start || picks[j].end <= picks[i].start,
        ).toBe(true);
  });

  it("prefers steady sound over a stretch with a long gap", () => {
    const e = env(120, [
      [0, 10, -10],
      [20, 30, -10],
      [60, 90, -16],
    ]);
    expect(goodBits(e, 30)[0].start).toBeGreaterThanOrEqual(59);
  });

  it("moves edges onto a nearby quiet moment", () => {
    const parts: [number, number, number][] = [];
    for (let t = 0; t < 60; t += 4) parts.push([t + 0.5, t + 4, -15]);
    const e = env(60, parts, -55);
    for (const p of goodBits(e, 15)) {
      const i = Math.round(p.start * 10);
      expect(e.db[Math.min(e.db.length - 1, i)]).toBe(-55);
    }
  });

  it("leaves out picks that are mostly quiet", () => {
    const picks = goodBits(env(120, [[70, 90, -12]]), 15);
    expect(picks.length).toBe(1);
  });

  it("gives nothing when the file is not longer than the length", () => {
    expect(goodBits(env(10, [[0, 10, -10]]), 15)).toEqual([]);
    expect(goodBits({ rate: 10, db: new Float32Array(0) }, 15)).toEqual([]);
  });

  it("stays inside the file", () => {
    for (const p of goodBits(env(40, [[25, 40, -8]]), 15)) {
      expect(p.start).toBeGreaterThanOrEqual(0);
      expect(p.end).toBeLessThanOrEqual(40);
    }
  });
});

describe("activity", () => {
  it("scales between the file's own floor and peak", () => {
    const a = activity(env(20, [[10, 20, -10]]));
    expect(a[0]).toBe(0);
    expect(a[150]).toBe(1);
  });
});

describe("lengthsFor", () => {
  it("offers the lengths that fit", () => {
    expect(lengthsFor(null)).toEqual([]);
    expect(lengthsFor(12)).toEqual([]);
    expect(lengthsFor(40)).toEqual([15, 30]);
    expect(lengthsFor(600)).toEqual([15, 30, 60]);
  });
});
