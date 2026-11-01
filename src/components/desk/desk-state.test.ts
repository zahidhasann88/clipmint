import { describe, expect, it } from "vitest";
import { draftLines, type CaptionDraft } from "./desk-state";

const draft: CaptionDraft = {
  itemId: 1,
  language: "en",
  range: { start: 10, end: 40 },
  segments: [
    { start: 11, end: 14, text: "hello there" },
    { start: 15, end: 19, text: "  " },
    { start: 20, end: 26, text: "general kenobi" },
    { start: 30, end: 38, text: "the end" },
  ],
};

describe("checked captions", () => {
  it("are used for the part they were heard from, minus emptied lines", () => {
    expect(
      draftLines(draft, 1, { start: 10, end: 40 }, "en")?.map((s) => s.text),
    ).toEqual(["hello there", "general kenobi", "the end"]);
  });
  it("still fit a shorter trim, clipped to it", () => {
    const lines = draftLines(draft, 1, { start: 22, end: 32 }, "en");
    expect(lines).toEqual([
      { start: 22, end: 26, text: "general kenobi" },
      { start: 30, end: 32, text: "the end" },
    ]);
  });
  it("don't cover a trim that reaches past what was heard, another file or language", () => {
    expect(draftLines(draft, 1, { start: 5, end: 30 }, "en")).toBeNull();
    expect(draftLines(draft, 1, null, "en")).toBeNull();
    expect(draftLines(draft, 2, { start: 10, end: 40 }, "en")).toBeNull();
    expect(draftLines(draft, 1, { start: 10, end: 40 }, "fr")).toBeNull();
  });
  it("heard from the whole file cover any trim", () => {
    expect(
      draftLines({ ...draft, range: null }, 1, { start: 0, end: 100 }, "en"),
    ).toHaveLength(3);
  });
});
