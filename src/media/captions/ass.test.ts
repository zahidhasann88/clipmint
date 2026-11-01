import { describe, expect, it } from "vitest";
import { captionAt, captionMetrics, chunks, toASS, wordsOf, type CaptionLook } from "./ass";

const seg = { start: 1, end: 3, text: "hello wonderful world" };
const look: CaptionLook = { style: "pop", color: "yellow", size: "M", pos: "bottom" };

describe("caption styles", () => {
  it("shares a line's time among its words by length", () => {
    const w = wordsOf(seg);
    expect(w.map((x) => x.text)).toEqual(["hello", "wonderful", "world"]);
    expect(w[0].start).toBe(1);
    expect(w[2].end).toBe(3);
    expect(w[1].end - w[1].start).toBeGreaterThan(w[0].end - w[0].start); // the long word takes longer
  });
  it("groups words per style and breaks after punctuation", () => {
    expect(chunks([seg], "word")).toHaveLength(3);
    expect(chunks([seg], "classic")).toHaveLength(1);
    expect(chunks([{ start: 0, end: 2, text: "one, two three" }], "classic").map((c) => c.length)).toEqual([1, 2]);
  });
  it("knows what's on screen at a moment (for the preview)", () => {
    expect(captionAt([seg], "pop", 1.1)?.current).toBe(0);
    expect(captionAt([seg], "pop", 0.5)).toBeNull();
  });
  it("writes a script laid out for the picture, with the spoken word lit up", () => {
    const ass = toASS([seg], look, 1080, 1920);
    expect(ass).toContain("PlayResX: 1080");
    expect(ass).toContain("PlayResY: 1920");
    expect(ass).toContain("Style: Default,Atkinson Hyperlegible,");
    const events = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
    expect(events).toHaveLength(3); // one per word
    expect(events[0]).toContain("{\\1c&H000AD6FF\\fscx112\\fscy112}HELLO{\\r} WONDERFUL WORLD");
    expect(events[0]).toContain("0:00:01.00");
  });
  it("puts captions higher on tall video, and in the middle when asked", () => {
    expect(captionMetrics(look, 1080, 1920).marginV).toBeGreaterThan(captionMetrics(look, 1920, 1080).marginV);
    expect(toASS([seg], { ...look, pos: "middle" }, 1280, 720)).toMatch(/,5,\d+,\d+,0,-1\n/);
  });
  it("follows the filter clock and drops what ends before 0", () => {
    const ass = toASS([seg, { start: 0, end: 0.5, text: "gone" }], { ...look, style: "classic" }, 1280, 720, (s) => s - 1);
    expect(ass).not.toContain("gone");
    expect(ass).toContain("Dialogue: 0,0:00:00.00,0:00:02.00");
  });
  it("can't be broken by braces or backslashes in the words", () => {
    expect(toASS([{ start: 0, end: 1, text: "a {b} \\N c" }], { ...look, style: "classic" }, 640, 360)).toContain(",a b N c");
  });
});
