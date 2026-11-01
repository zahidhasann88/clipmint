import { describe, expect, it } from "vitest";
import {
  atempoChain,
  buildAudioArgs,
  buildMergeArgs,
  buildVideoArgs,
  cutFilters,
  denoiseChain,
  filterClock,
  fmtTime,
  keyframeExpr,
  normalizeCrf,
  outputClock,
  silenceChain,
} from "./commands";

const after = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe("fmtTime", () => {
  it("formats seconds as HH:MM:SS.mmm", () => {
    expect(fmtTime(0)).toBe("00:00:00.000");
    expect(fmtTime(3725.5)).toBe("01:02:05.500");
  });
  it("clamps bad input to zero", () => {
    expect(fmtTime(-3)).toBe("00:00:00.000");
    expect(fmtTime(Number.NaN)).toBe("00:00:00.000");
  });
});

describe("atempoChain", () => {
  it("chains stages outside 0.5–2", () => {
    expect(atempoChain(4)).toEqual(["atempo=2", "atempo=2"]);
    expect(atempoChain(0.25)).toEqual(["atempo=0.5", "atempo=0.5"]);
    expect(atempoChain(1.5)).toEqual(["atempo=1.5"]);
    expect(atempoChain(1)).toEqual([]);
  });
});

describe("keyframeExpr", () => {
  it("holds a constant without keys", () =>
    expect(keyframeExpr([])).toBe("0.5"));
  it("interpolates between keys and holds at the ends", () => {
    const e = keyframeExpr([
      { t: 0, v: 0.2 },
      { t: 2, v: 0.8 },
    ]);
    const run = (t: number) =>
      Function(
        "t",
        `const lt=(a,b)=>a<b, iff=(a,b,c)=>a?b:c; return ${e.replace(/if\(/g, "iff(")};`,
      )(t) as number;
    expect(run(-1)).toBeCloseTo(0.2);
    expect(run(1)).toBeCloseTo(0.5);
    expect(run(5)).toBeCloseTo(0.8);
  });
});

describe("normalizeCrf", () => {
  it("clamps and rounds", () => {
    expect(normalizeCrf(60)).toBe(51);
    expect(normalizeCrf("22.6")).toBe(23);
    expect(normalizeCrf("")).toBeNull();
    expect(normalizeCrf("abc")).toBeNull();
  });
});

describe("buildAudioArgs", () => {
  it("maps only the first audio stream", () => {
    const a = buildAudioArgs("in.mp3", "out.mp3", { outputFormat: "mp3" });
    expect(a.slice(0, 4)).toEqual(["-i", "in.mp3", "-map", "0:a:0"]);
    expect(after(a, "-b:a")).toBe("192k");
    expect(a.at(-1)).toBe("out.mp3");
  });
  it("seeks for a plain trim", () => {
    const a = buildAudioArgs("in", "out.wav", {
      outputFormat: "wav",
      trimStart: 5,
      trimEnd: 12.5,
    });
    expect(after(a, "-ss")).toBe("00:00:05.000");
    expect(after(a, "-t")).toBe("00:00:07.500");
    expect(a).not.toContain("-af");
  });
  it("trims inside the graph when filters run, cleaning before fades and speed last", () => {
    const a = buildAudioArgs("in", "out.mp3", {
      outputFormat: "mp3",
      trimStart: 2,
      trimEnd: 12,
      fadeIn: 1,
      fadeOut: 2,
      tempo: 1.5,
      denoise: { level: "voice", model: "m.rnnn" },
    });
    const af = after(a, "-af").split(",");
    expect(af[0]).toBe("atrim=start=2.000:end=12.000");
    expect(af.indexOf("arnndn=m=m.rnnn")).toBeLessThan(
      af.findIndex((f) => f.startsWith("afade=t=in")),
    );
    expect(af).toContain("afade=t=out:st=8.000:d=2.00");
    expect(af.at(-1)).toBe("atempo=1.5");
    expect(a).not.toContain("-ss");
    expect(after(a, "-ar")).toBe("48000");
  });
  it("skips a fade-out when the end is unknown", () => {
    const a = buildAudioArgs("in", "out.mp3", {
      outputFormat: "mp3",
      fadeOut: 2,
    });
    expect(a.join(" ")).not.toContain("afade");
  });
  it("forces 48 kHz for Opus", () => {
    const a = buildAudioArgs("in", "out.opus", {
      outputFormat: "opus",
      sampleRate: 44100,
    });
    expect(after(a, "-ar")).toBe("48000");
    expect(a.filter((x) => x === "-ar")).toHaveLength(1);
  });
});

describe("denoise and silence chains", () => {
  it("uses the FFT denoiser without a model", () => {
    expect(denoiseChain({ level: "light" })).toEqual([
      "highpass=f=70",
      "afftdn=nr=12:nf=-30:tn=1",
    ]);
    expect(denoiseChain({ level: "voice", model: null })).toContain(
      "afftdn=nr=12:nf=-30:tn=1",
    );
  });
  it("adds the FFT pass after RNNoise on strong", () => {
    expect(denoiseChain({ level: "strong", model: "sh" })).toEqual([
      "highpass=f=70",
      "arnndn=m=sh",
      "afftdn=nr=10:nf=-35",
    ]);
  });
  it("trims both ends by reversing, or shortens pauses", () => {
    expect(silenceChain({ mode: "ends", pause: 1 })).toHaveLength(4);
    expect(silenceChain({ mode: "pauses", pause: 0.8 })[0]).toContain(
      "stop_duration=0.80",
    );
  });
});

describe("buildMergeArgs", () => {
  it("trims each input and concatenates", () => {
    const a = buildMergeArgs(["a", "b"], "out.mp3", { outputFormat: "mp3" }, [
      { start: 1, end: 3 },
      null,
    ]);
    const graph = after(a, "-filter_complex");
    expect(graph).toContain("[0:a:0]atrim=start=1.000:end=3.000");
    expect(graph).toContain("[p0][p1]concat=n=2:v=0:a=1[out]");
    expect(after(a, "-map")).toBe("[out]");
    expect(a).toContain("libmp3lame");
  });
});

describe("buildVideoArgs", () => {
  const base = {
    outputFormat: "mp4",
    preset: "balanced",
    resizePreset: "original",
  } as const;

  it("maps video and optional audio, H.264 + AAC", () => {
    const a = buildVideoArgs("in.mp4", "out.mp4", base);
    expect(a).toContain("0:a:0?");
    expect(after(a, "-c:v")).toBe("libx264");
    expect(after(a, "-crf")).toBe("23");
    expect(after(a, "-c:a")).toBe("aac");
  });
  it("fits a portrait video in a portrait box", () => {
    const a = buildVideoArgs(
      "in",
      "out.mp4",
      { ...base, resizePreset: "720p" },
      1080,
      1920,
    );
    expect(after(a, "-vf")).toContain("scale=w=720:h=1280");
  });
  it("swaps the box after a quarter turn", () => {
    const a = buildVideoArgs(
      "in",
      "out.mp4",
      { ...base, resizePreset: "720p", rotate: 90 },
      1920,
      1080,
    );
    const vf = after(a, "-vf");
    expect(vf.startsWith("transpose=1")).toBe(true);
    expect(vf).toContain("scale=w=720:h=1280");
  });
  it("uses a size target instead of CRF", () => {
    const a = buildVideoArgs("in", "out.mp4", {
      ...base,
      targetVideoKbps: 800,
    });
    expect(a).not.toContain("-crf");
    expect(after(a, "-b:v")).toBe("800k");
  });
  it("reframes to a platform size with square pixels and a frame-rate cap", () => {
    const a = buildVideoArgs(
      "in",
      "out.mp4",
      {
        ...base,
        frame: { aspect: 9 / 16, mode: "crop", width: 1080, height: 1920 },
        maxFps: 30,
      },
      1920,
      1080,
    );
    const vf = after(a, "-vf");
    expect(vf).toContain("scale=1080:1920");
    expect(vf).toContain("setsar=1");
    expect(vf).toContain("fps=30");
  });
  it("follows a tracked face with a moving crop", () => {
    const a = buildVideoArgs("in", "out.mp4", {
      ...base,
      frame: {
        aspect: 9 / 16,
        mode: "crop",
        track: [
          { t: 0, x: 0.2, y: 0.5 },
          { t: 4, x: 0.8, y: 0.5 },
        ],
      },
    });
    expect(after(a, "-vf")).toMatch(/x='clip\(if\(lt\(t,/);
  });
  it("draws captions after scaling", () => {
    const a = buildVideoArgs(
      "in",
      "out.mp4",
      { ...base, resizePreset: "720p", subtitles: { file: "c.ass" } },
      1920,
      1080,
    );
    const vf = after(a, "-vf");
    expect(vf.indexOf("ass=filename=c.ass:fontsdir=.:shaping=complex")).toBeGreaterThan(
      vf.indexOf("scale=w="),
    );
  });
  it("skips captions without a file", () => {
    const a = buildVideoArgs("in", "out.mp4", {
      ...base,
      subtitles: { file: null },
    });
    expect(a.join(" ")).not.toContain("ass=");
  });
  it("trims inside the graph when the speed changes", () => {
    const a = buildVideoArgs("in", "out.mp4", {
      ...base,
      trimStart: 2,
      trimEnd: 6,
      speed: 2,
    });
    expect(a).not.toContain("-ss");
    expect(after(a, "-vf")).toContain("trim=start=2.000:end=6.000");
    expect(after(a, "-af")).toContain("atempo=2");
  });
  it("mixes music in one graph and drops the plain video map", () => {
    const a = buildVideoArgs(
      "in",
      "out.mp4",
      {
        ...base,
        music: { mode: "mix", volume: 0.5, originalVolume: 1, duration: 10 },
      },
      null,
      null,
      ["song.mp3"],
    );
    expect(a).not.toContain("0:v:0");
    expect(after(a, "-filter_complex")).toContain("amix=inputs=2");
    expect(a).toContain("-shortest");
  });
  it("makes a GIF with no audio", () => {
    const a = buildVideoArgs("in", "out.gif", {
      ...base,
      outputFormat: "gif",
      gif: { fps: 10, width: 320 },
    });
    expect(a).not.toContain("0:a:0?");
    expect(a).toContain("-an");
    expect(after(a, "-vf")).toContain("palettegen");
  });
  it("moves a face track onto the graph's clock when the speed changes", () => {
    const a = buildVideoArgs("in", "out.mp4", {
      ...base,
      trimStart: 10,
      trimEnd: 20,
      speed: 2,
      frame: {
        aspect: 9 / 16,
        mode: "crop",
        track: [
          { t: 10, x: 0.2, y: 0.5 },
          { t: 14, x: 0.8, y: 0.5 },
        ],
      },
    });

    expect(after(a, "-vf")).toContain("lt(t,2.000)");
  });
  it("makes WebM with VP8 + Vorbis", () => {
    const a = buildVideoArgs("in", "out.webm", {
      ...base,
      outputFormat: "webm",
    });
    expect(after(a, "-c:v")).toBe("libvpx");
    expect(after(a, "-c:a")).toBe("libvorbis");
  });
});

describe("jump cuts", () => {
  const base = {
    outputFormat: "mp4" as const,
    preset: "balanced" as const,
    resizePreset: "original" as const,
  };
  const cut = {
    ...base,
    trimStart: 10,
    trimEnd: 30,
    cuts: [
      { start: 10, end: 14 },
      { start: 16, end: 22 },
      { start: 25, end: 30 },
    ],
  };

  it("keeps the spans and closes the gaps, picture and sound alike", () => {
    const a = buildVideoArgs("in", "out.mp4", cut);
    expect(a).not.toContain("-ss"); // the trim moves into the graph
    const vf = after(a, "-vf"),
      af = after(a, "-af");
    expect(vf).toContain("trim=start=10.000:end=30.000");
    expect(vf).toContain(
      "select='between(t,0.000,4.000)+between(t,6.000,12.000)+between(t,15.000,20.000)'",
    );
    expect(vf).toContain(
      "setpts='(T-(gte(T,6.000)*2.000+gte(T,15.000)*3.000))/TB'",
    );
    expect(af).toContain("aselect='between(t,0.000,4.000)");
    expect(af).toContain("asetpts=");
  });
  it("cuts after the captions are drawn, so they stay in sync", () => {
    const vf = after(
      buildVideoArgs("in", "out.mp4", { ...cut, subtitles: { file: "c.ass" } }),
      "-vf",
    );
    expect(vf.indexOf("select=")).toBeGreaterThan(vf.indexOf("ass=filename"));
  });
  it("has no cut filters without cuts", () => {
    expect(cutFilters(base)).toBeNull();
    expect(
      after(buildVideoArgs("in", "out.mp4", base), "-vf") ?? "",
    ).not.toContain("select=");
  });
  it("maps source time to the filters' clock and to the finished file", () => {
    expect(filterClock({ ...base, trimStart: 10 })(12)).toBe(12);
    expect(filterClock({ ...base, trimStart: 10, speed: 2 })(14)).toBe(2);
    const out = outputClock(cut);
    expect(out(12)).toBe(2);
    expect(out(15)).toBeNull();
    expect(out(17)).toBe(5);
    expect(out(26)).toBe(11);
    expect(outputClock({ ...base, trimStart: 10 })(12)).toBe(2);
    expect(outputClock({ ...base, trimStart: 10 })(5)).toBeNull();
  });
});
