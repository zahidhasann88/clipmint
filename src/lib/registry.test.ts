import { describe, expect, it } from "vitest";
import { DESK_ROUTES } from "./routes";
import { BASE_RECIPE, SHELVES, TOOLS, TOOL_ALIASES, accepts, engineFor, exportSections, getTool, recipeFor, suggestionsFor, toolKey, type FileFacts } from "./registry";

const facts = (ext: string, engine: "audio" | "video", extra: Partial<FileFacts> = {}): FileFacts => ({
  name: `x.${ext}`, ext, size: 1e6, engine, duration: 30, width: engine === "video" ? 1280 : null, height: engine === "video" ? 720 : null,
  sampleRate: 44100, channels: 2, ...extra,
});

describe("tool registry", () => {
  it("has unique tool keys on known shelves", () => {
    const keys = TOOLS.map(toolKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of TOOLS) expect(SHELVES.some((s) => s.id === t.shelf)).toBe(true);
  });
  it("every deep link points at a real tool", () => {
    for (const r of DESK_ROUTES) expect(getTool(r.tool), r.slug).not.toBeNull();
    expect(new Set(DESK_ROUTES.map((r) => r.slug)).size).toBe(DESK_ROUTES.length);
  });
  it("old tool names open the tool that does the job now", () => {
    for (const [old, now] of Object.entries(TOOL_ALIASES)) expect(getTool(old) && toolKey(getTool(old)!), old).toBe(now);
    expect(getTool("video/trim")?.id).toBe("export");
    expect(getTool("nope/nothing")).toBeNull();
  });
  it("keeps the tool strip short: one Export per shelf, the rest are edits", () => {
    for (const s of SHELVES) {
      const tools = TOOLS.filter((t) => t.shelf === s.id);
      expect(tools[0].id, s.id).toBe("export");
      expect(tools.length, s.id).toBeLessThanOrEqual(16);
    }
  });
  it("every tool accepts something", () => {
    for (const t of TOOLS) expect(t.accepts.length, toolKey(t)).toBeGreaterThan(0);
  });
  it("picks the engine from the extension, then the MIME type", () => {
    expect(engineFor("mp4", "")).toBe("video");
    expect(engineFor("mp3", "")).toBe("audio");
    expect(engineFor("xyz", "audio/x-foo")).toBe("audio");
    expect(engineFor("xyz", "text/plain")).toBeNull();
  });
});

describe("suggestions", () => {
  it("only suggests tools that take the file", () => {
    const f = facts("wav", "audio");
    const { main, others } = suggestionsFor(f);
    expect(main).not.toBeNull();
    for (const t of [main!, ...others]) expect(accepts(t, f)).toBe(true);
  });
  it("offers merge only for several files", () => {
    const f = facts("mp3", "audio");
    const has = (n: number) => [suggestionsFor(f, null, n).main, ...suggestionsFor(f, null, n).others].some((t) => t?.multi);
    expect(has(1)).toBe(false);
    expect(has(3)).toBe(true);
  });
  it("keeps the preferred tool first", () => {
    expect(suggestionsFor(facts("mp4", "video"), "video/gif").main?.id).toBe("gif");
    expect(suggestionsFor(facts("mp4", "video"), "video/compress").main?.id).toBe("export");
  });
  it("opens on Export unless the file suggests something else", () => {
    expect(suggestionsFor(facts("mp3", "audio")).main?.id).toBe("export");
    expect(suggestionsFor(facts("mp4", "video", { duration: 60 })).main?.id).toBe("export");
    expect(suggestionsFor(facts("mp4", "video", { width: 720, height: 1280 })).main?.id).toBe("social");
  });
});

describe("starting recipes", () => {
  it("never starts above the source resolution", () => {
    const r = recipeFor(getTool("video/compress")!, facts("mp4", "video", { width: 854, height: 480 }));
    expect(r.size).toBe("480p");
  });
  it("export settings follow what comes out", () => {
    expect(exportSections("audio", BASE_RECIPE)).toContain("format");
    expect(exportSections("text", BASE_RECIPE)).toEqual(["transcript"]);
    expect(exportSections("video", BASE_RECIPE)).toContain("size");
    expect(exportSections("video", { ...BASE_RECIPE, frame: "social" })).not.toContain("size");
    expect(exportSections("video", { ...BASE_RECIPE, videoFormat: "gif" })).toEqual(["gifSize", "gifFps"]);
  });
  it("Opus always runs at 48 kHz", () => {
    const r = recipeFor({ ...getTool("audio/convert")!, defaults: { format: "opus" } }, facts("wav", "audio"));
    expect(r.sampleRate).toBe(48000);
  });
});
