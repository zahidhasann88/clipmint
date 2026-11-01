import { describe, expect, it } from "vitest";
import { facePath, type FaceSample } from "./track";

const samples = (n: number, at: Record<number, number>): FaceSample[] =>
  Array.from({ length: n }, (_, i) => ({
    t: +(i * 0.4).toFixed(1),
    x: at[i] ?? null,
    y: i in at ? 0.4 : null,
  }));

describe("facePath", () => {
  it("keeps the crop centred when only a few stray hits show up", () => {
    expect(facePath(samples(22, { 9: 0.26, 11: 0.22, 12: 0.31 }))).toBeNull();
  });

  it("keeps the crop centred with no faces at all", () => {
    expect(facePath(samples(10, {}))).toBeNull();
  });

  it("follows a face that stays in the picture", () => {
    const at: Record<number, number> = {};
    for (let i = 0; i < 20; i++) at[i] = 0.3;
    const keys = facePath(samples(20, at))!;
    expect(keys.every((k) => Math.abs(k.x - 0.3) < 1e-6)).toBe(true);
  });

  it("holds through a short gap but drifts back to the centre after a long one", () => {
    const at: Record<number, number> = {};
    for (let i = 0; i < 8; i++) at[i] = 0.2;
    const keys = facePath(samples(28, at))!;
    expect(keys[0].x).toBeCloseTo(0.2);
    expect(keys[keys.length - 1].x).toBeCloseTo(0.5);
  });

  it("keeps the crop expression short", () => {
    const at: Record<number, number> = {};
    for (let i = 0; i < 90; i++) at[i] = 0.5 + 0.3 * Math.sin(i / 5);
    expect(facePath(samples(90, at))!.length).toBeLessThanOrEqual(33);
  });
});
