import { describe, expect, it } from "vitest";
import { EDITS, activeEdits, merging, outputKind, startRecipe, toggle, type EditCtx } from "./edits";
import { BASE_RECIPE, TOOLS, getTool, type FileFacts, type Recipe } from "./registry";
import { getDeskRoute } from "./routes";
import { audioJob, videoPlanFor } from "@/media/recipe";

const video: FileFacts = { name: "a.mp4", ext: "mp4", size: 50e6, engine: "video", duration: 60, width: 1920, height: 1080, sampleRate: 48000, channels: 2 };
const audio: FileFacts = { name: "a.wav", ext: "wav", size: 10e6, engine: "audio", duration: 60, width: null, height: null, sampleRate: 44100, channels: 2 };
const ctx = (over: Partial<EditCtx> = {}): EditCtx => ({ engine: "video", music: null, range: null, duration: 60, count: 1, ...over });
const videoTools = TOOLS.filter((t) => t.shelf === "video");
const on = (r: Recipe, c = ctx()) => activeEdits(r, c, videoTools).map((e) => e.key);

describe("edits", () => {
  it("a new file starts with nothing switched on", () => {
    expect(on(BASE_RECIPE)).toEqual([]);
    const r = startRecipe(video, { speed: 2, frame: "crop", captions: true } as Partial<Recipe>);
    expect(on(r)).toEqual([]);
  });

  it("several edits stay on together and all reach the encoder", () => {
    let r = BASE_RECIPE;
    for (const k of ["video/crop", "video/speed", "video/captions", "video/cleansound", "video/rotate"]) r = { ...r, ...toggle(k, true, r) };
    expect(on(r)).toEqual(["video/captions", "video/crop", "video/speed", "video/cleansound", "video/rotate"]);
    const { job } = videoPlanFor(r, video, null);
    expect(job.frame).toMatchObject({ mode: "crop" });
    expect(job.speed).toBe(2);
    expect(job.rotate).toBe(90);
    expect(job.subtitles).not.toBeNull();
    expect(job.denoise).toEqual({ level: r.denoise });
  });

  it("switching one off leaves the others", () => {
    let r = { ...BASE_RECIPE, ...toggle("video/crop", true, BASE_RECIPE) };
    r = { ...r, ...toggle("video/speed", true, r) };
    r = { ...r, ...toggle("video/crop", false, r) };
    expect(on(r)).toEqual(["video/speed"]);
  });

  it("crop and social share the frame: the later one wins", () => {
    let r = { ...BASE_RECIPE, ...toggle("video/crop", true, BASE_RECIPE) };
    r = { ...r, ...toggle("video/social", true, r) };
    expect(on(r)).toEqual(["video/social"]);
  });

  it("keeps a chosen value when switched back on", () => {
    const r = { ...BASE_RECIPE, speed: 4 as const };
    expect(toggle("video/speed", true, r)).toEqual({ speed: 4 });
  });

  it("trim and music come from the mat, not the recipe", () => {
    expect(on(BASE_RECIPE, ctx({ range: { start: 5, end: 20 } }))).toEqual(["video/trim"]);
    expect(on(BASE_RECIPE, ctx({ music: new File(["x"], "song.mp3") }))).toEqual(["video/music"]);
  });

  it("marks edits the output can't use", () => {
    const r: Recipe = { ...BASE_RECIPE, captions: true, frame: "crop", output: "audio" };
    const list = activeEdits(r, ctx(), videoTools);
    expect(list.find((e) => e.key === "video/captions")?.skipped).toBe("not in audio only");
    expect(list.find((e) => e.key === "video/extract")?.skipped).toBeNull();
    const gif = activeEdits({ ...BASE_RECIPE, captions: true, videoFormat: "gif" }, ctx(), videoTools);
    expect(gif.find((e) => e.key === "video/captions")?.skipped).toBe("not in a GIF");
  });

  it("every switchable edit turns on and off", () => {
    for (const [key, e] of Object.entries(EDITS)) {
      if (!e.enable) continue;
      const engine = key.startsWith("audio") ? "audio" : "video";
      const c = ctx({ engine, count: key.endsWith("/merge") ? 2 : 1 });
      const r = { ...BASE_RECIPE, ...toggle(key, true, BASE_RECIPE) };
      expect(e.on(r, c), key).toBe(true);
      expect(e.on({ ...r, ...toggle(key, false, r) }, c), key).toBe(false);
    }
  });
});

describe("outputs", () => {
  it("follows the recipe", () => {
    expect(outputKind("video", BASE_RECIPE)).toBe("video");
    expect(outputKind("video", { ...BASE_RECIPE, output: "audio" })).toBe("audio");
    expect(outputKind("audio", { ...BASE_RECIPE, output: "text" })).toBe("text");
    expect(merging("audio", { ...BASE_RECIPE, merge: true }, 1)).toBe(false);
    expect(merging("audio", { ...BASE_RECIPE, merge: true }, 3)).toBe(true);
  });

  it("audio edits combine in one job", () => {
    const r: Recipe = { ...BASE_RECIPE, clean: true, trimSilence: true, fadeIn: 1, speed: 1.5, loudness: "voice" };
    const j = audioJob(r, audio, null);
    expect(j.denoise).toEqual({ level: r.denoise });
    expect(j.silence).not.toBeNull();
    expect(j.tempo).toBe(1.5);
    expect(j.fadeIn).toBe(1);
    expect(j.loudness).toBe(-16);
  });

  it("a deep link's own settings apply, edits don't", () => {
    const wav = getDeskRoute("wav-to-mp3"), share = getDeskRoute("reduce-video-size");
    expect(startRecipe(audio, { format: "ogg" }, getTool(wav.tool), wav.defaults).format).toBe("mp3");
    expect(startRecipe(video, {}, getTool(share.tool), share.defaults).squeeze).toBe("chat");
    expect(startRecipe(video, {}, getTool("video/speed")).speed).toBe(1);
  });

  it("trim is listed first, though it has no tool of its own", () => {
    const r = { ...BASE_RECIPE, ...toggle("video/speed", true, BASE_RECIPE) };
    expect(on(r, ctx({ range: { start: 5, end: 20 } }))).toEqual(["video/trim", "video/speed"]);
  });

});
