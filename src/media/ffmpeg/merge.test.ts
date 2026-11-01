import { describe, expect, it } from "vitest";
import {
  buildAudioArgs,
  buildConcatCopyArgs,
  buildMergeArgs,
  buildVideoArgs,
  buildVideoMergeArgs,
  concatList,
  inputsWithAudio,
  overlapFor,
  sameStreams,
  type VideoJobOptions,
  type VideoMergeOptions,
} from "./commands";

const base: VideoMergeOptions = {
  outputFormat: "mp4",
  preset: "balanced",
  width: 1280,
  height: 720,
  fps: 30,
  fit: "bars",
  sound: true,
};
const clip = (file: string, length = 3, hasAudio = true) => ({
  file,
  start: 0,
  length,
  hasAudio,
});
const graph = (a: string[]) => a[a.indexOf("-filter_complex") + 1];

describe("video merge", () => {
  it("joins clips, matching their size first", () => {
    const g = graph(buildVideoMergeArgs([clip("a"), clip("b")], "o.mp4", base));
    expect(g).toContain("pad=1280:720");
    expect(g).toContain("[v0][a0][v1][a1]concat=n=2:v=1:a=1[vout][aout]");
  });
  it("gives a clip with no sound silence, so the rest stay in step", () => {
    const g = graph(
      buildVideoMergeArgs([clip("a"), clip("b", 2, false)], "o.mp4", base),
    );
    expect(g).toContain("anullsrc=r=48000:cl=stereo,atrim=0:2.000");
    expect(g).not.toContain("[1:a:0]");
  });
  it("offsets each fade by the length so far", () => {
    const g = graph(
      buildVideoMergeArgs([clip("a"), clip("b"), clip("c")], "o.mp4", {
        ...base,
        transition: 1,
      }),
    );
    expect(g).toContain("duration=1.000:offset=2.000");
    expect(g).toContain("duration=1.000:offset=4.000");
    expect(g).toContain("acrossfade=d=1.000");
  });
  it("shortens a fade that wouldn't fit the shortest clip", () => {
    expect(overlapFor(3, [10, 2])).toBe(1);
    expect(overlapFor(0, [10, 2])).toBe(0);
  });
  it("drops the sound when it's off", () => {
    const a = buildVideoMergeArgs([clip("a"), clip("b")], "o.mp4", {
      ...base,
      sound: false,
    });
    expect(a).toContain("-an");
    expect(graph(a)).toContain("concat=n=2:v=1:a=0");
  });
  it("starts the song on the first beat when cutting to it", () => {
    const a = buildVideoMergeArgs([clip("a", 1), clip("b", 1)], "o.mp4", {
      ...base,
      music: { file: "s", volume: 1, originalVolume: 0, from: 0.25 },
    });
    expect(graph(a)).toContain("atrim=0.250:2.250");
    expect(graph(a)).not.toContain("amix");
  });
  it("copies without re-encoding when joining the same format", () => {
    const a = buildConcatCopyArgs("list.txt", "o.mp4");
    expect(a).toContain("copy");
    expect(concatList(["/x/a.mp4", "it's.mp4"])).toBe(
      "file '/x/a.mp4'\nfile 'it'\\''s.mp4'\n",
    );
  });
});

describe("reading stream logs", () => {
  const input = (i: number, video: string, audio = true) =>
    [
      `Input #${i}, mov,mp4, from 'x':`,
      `  Stream #${i}:0(und): Video: h264 (High), yuv420p, ${video}, 500 kb/s, 25 fps (default)`,
      audio
        ? `  Stream #${i}:1(und): Audio: aac (LC), 44100 Hz, stereo, fltp, 96 kb/s (default)`
        : "",
    ].join("\n");
  const out = "Stream mapping:\nOutput #0, null\n  Stream #0:0: Video: wrapped_avframe";
  it("treats different bitrates as the same format", () => {
    const b = input(1, "640x360").replace("500 kb/s", "900 kb/s");
    expect(sameStreams(`${input(0, "640x360")}\n${b}\n${out}`, 2)).toBe(true);
  });
  it("spots a different size or a missing audio track", () => {
    expect(sameStreams(`${input(0, "640x360")}\n${input(1, "320x240")}`, 2)).toBe(false);
    expect(sameStreams(`${input(0, "640x360")}\n${input(1, "640x360", false)}`, 2)).toBe(false);
  });
  it("needs a report for every input", () => {
    expect(sameStreams(input(0, "640x360"), 2)).toBe(false);
  });
  it("lists which inputs have sound", () => {
    expect(
      Array.from(inputsWithAudio(`${input(0, "a", false)}\n${input(1, "a")}\n${out}`)),
    ).toEqual([1]);
  });
});

describe("audio joins", () => {
  const o = { outputFormat: "mp3" as const };
  it("crossfades each pair in turn", () => {
    const g = graph(
      buildMergeArgs(["a", "b", "c"], "o.mp3", { ...o, crossfade: 1 }, [null, null, null], [3, 3, 3]),
    );
    expect(g).toContain("[p0][p1]acrossfade=d=1.000[x1]");
    expect(g).toContain("[x1][p2]acrossfade=d=1.000");
  });
  it("fades out at the true end of the join", () => {
    const g = graph(
      buildMergeArgs(["a", "b"], "o.mp3", { ...o, crossfade: 1, fadeOut: 2 }, [null, null], [3, 3]),
    );
    expect(g).toContain("afade=t=out:st=3.000:d=2.00");
  });
  it("skips the fade-out when a length is unknown", () => {
    expect(
      graph(buildMergeArgs(["a", "b"], "o.mp3", { ...o, fadeOut: 2 }, [null, null], [3, null])),
    ).not.toContain("t=out");
  });
  it("writes FLAC", () => {
    expect(buildAudioArgs("a", "o.flac", { outputFormat: "flac" })).toContain("flac");
  });
});

describe("text, logo and face blur", () => {
  const v: VideoJobOptions = {
    outputFormat: "mp4",
    preset: "balanced",
    resizePreset: "original",
  };
  const vf = (o: Partial<VideoJobOptions>) => {
    const a = buildVideoArgs("in", "o.mp4", { ...v, ...o }, 640, 360);
    return a[a.indexOf("-vf") + 1];
  };
  const text = { file: "t.ass", fontsDir: "/f" };
  it("draws text with complex shaping, from the job's font folder", () => {
    expect(vf({ overlay: { text } })).toContain(
      "ass=filename=t.ass:fontsdir=/f:shaping=complex",
    );
  });
  it("puts the logo in the chosen corner, after the text", () => {
    const f = vf({
      overlay: { text, logo: { file: "l.png", width: 100, corner: "bl" } },
    });
    expect(f.indexOf("ass=filename")).toBeLessThan(f.indexOf("movie=l.png"));
    expect(f).toContain("overlay=(main_w*0.03):main_h-overlay_h-(main_w*0.03)");
  });
  it("blurs each face before the picture is turned", () => {
    const box = { t: 0, x: 0.5, y: 0.5, w: 0.2, h: 0.2 };
    const f = vf({ rotate: 90, blur: [[box], [box]] });
    expect(f.indexOf("fc1")).toBeGreaterThan(f.indexOf("fc0"));
    expect(f.indexOf("boxblur")).toBeLessThan(f.indexOf("transpose"));
  });
});
