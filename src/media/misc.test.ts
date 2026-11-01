import { describe, expect, it } from "vitest";
import { realSpeech, toSRT, toText, toVTT } from "./captions/format";
import { crc32, uniqueNames, zipBlobs } from "./files/zip";
import { wavSamples } from "./files/wav";
import {
  clock,
  clockTenths,
  formatSize,
  parseClock,
  savings,
  videoPlanFor,
} from "./recipe";
import { BASE_RECIPE, PLATFORMS, type FileFacts } from "@/lib/registry";

const segs = [
  { start: 1.5, end: 3.25, text: "Hello there." },
  { start: 3.5, end: 3661.001, text: "Bye." },
];

describe("caption formats", () => {
  it("writes SRT with comma millis and numbering", () => {
    expect(toSRT(segs)).toBe(
      "1\n00:00:01,500 --> 00:00:03,250\nHello there.\n\n2\n00:00:03,500 --> 01:01:01,001\nBye.\n",
    );
  });
  it("shifts to the trimmed output and never goes below zero", () => {
    expect(toSRT(segs, -2).split("\n")[1]).toBe(
      "00:00:00,000 --> 00:00:01,250",
    );
  });
  it("writes WebVTT with a header and dot millis", () => {
    expect(
      toVTT(segs).startsWith("WEBVTT\n\n00:00:01.500 --> 00:00:03.250\n"),
    ).toBe(true);
  });
  it("joins plain text", () => expect(toText(segs)).toBe("Hello there. Bye."));
});

describe("realSpeech", () => {
  const seg = (text: string) => ({ start: 0, end: 2, text });
  it("treats Whisper's no-speech phrases as nothing heard", () => {
    expect(realSpeech([seg("Thank you.")])).toEqual([]);
    expect(realSpeech([seg(" Thanks for watching!"), seg("you")])).toEqual([]);
    expect(realSpeech([])).toEqual([]);
  });
  it("keeps them inside real speech", () => {
    expect(
      realSpeech([seg("Welcome to the market."), seg("Thank you.")]),
    ).toHaveLength(2);
  });
  it("catches the same habit in other languages, and repetition loops", () => {
    expect(realSpeech([seg("ご視聴ありがとうございました")])).toEqual([]);
    expect(realSpeech([seg(Array(80).fill("पुप").join(" "))])).toEqual([]);
    expect(realSpeech([seg("¡Gracias por ver!")])).toEqual([]);
    expect(
      realSpeech([
        seg("Hello and welcome."),
        seg(Array(20).fill("la").join(" ")),
      ]),
    ).toEqual([seg("Hello and welcome.")]);
  });
  it("keeps speech in other scripts", () => {
    expect(realSpeech([seg("আপনাকে স্বাগতম")])).toHaveLength(1);
  });
});

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("numbers duplicate names", () => {
    expect(uniqueNames(["a.mp3", "A.mp3", "b", "b"])).toEqual([
      "a.mp3",
      "A (2).mp3",
      "b",
      "b (2)",
    ]);
  });
  it("writes a store-only archive", async () => {
    const z = new Uint8Array(
      await (
        await zipBlobs([{ name: "x.txt", blob: new Blob(["hi"]) }])
      ).arrayBuffer(),
    );
    expect([...z.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(new TextDecoder().decode(z)).toContain("x.txt");
  });
});

describe("wavSamples", () => {
  it("reads 16-bit PCM after other chunks", () => {
    const pcm = new Int16Array([0, 16384, -32768]);
    const buf = new ArrayBuffer(12 + 8 + 4 + 8 + pcm.byteLength);
    const v = new DataView(buf);
    const tag = (o: number, s: string) =>
      [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    tag(0, "RIFF");
    tag(8, "WAVE");
    tag(12, "LIST");
    v.setUint32(16, 4, true);
    tag(24, "data");
    v.setUint32(28, pcm.byteLength, true);
    new Int16Array(buf, 32).set(pcm);
    expect([...wavSamples(buf)]).toEqual([0, 0.5, -1]);
  });
});

describe("clock helpers", () => {
  it("formats and parses times", () => {
    expect(clock(222.4)).toBe("3:42");
    expect(clockTenths(24.56)).toBe("0:24.6");
    expect(parseClock("1:12.4")).toBeCloseTo(72.4);
    expect(parseClock("72.4")).toBeCloseTo(72.4);
    expect(parseClock("1:x")).toBeNull();
    expect(parseClock(clockTenths(125.3))).toBeCloseTo(125.3);
  });
  it("formats sizes and savings", () => {
    expect(formatSize(48_200_000)).toBe("48.2 MB");
    expect(formatSize(820_000)).toBe("820 KB");
    expect(savings(100, 7)).toBe("−93%");
    expect(savings(100, 112)).toBe("+12%");
  });
});

describe("video plans", () => {
  const hd: FileFacts = {
    name: "a.mp4",
    ext: "mp4",
    size: 60e6,
    engine: "video",
    duration: 60,
    width: 1920,
    height: 1080,
    sampleRate: 48000,
    channels: 2,
  };

  it("social presets output the platform size and cap", () => {
    const { job } = videoPlanFor(
      { ...BASE_RECIPE, frame: "social", platform: "tiktok" },
      hd,
      null,
    );
    expect(job.frame).toMatchObject({
      width: PLATFORMS.tiktok.width,
      height: PLATFORMS.tiktok.height,
    });
    expect(job.maxFps).toBe(PLATFORMS.tiktok.fps);
  });
  it("a size limit switches to a bitrate target", () => {
    const { job, estimate } = videoPlanFor(
      { ...BASE_RECIPE, squeeze: "email" },
      { ...hd, size: 400e6 },
      null,
    );
    expect(job.targetVideoKbps).toBeGreaterThan(0);
    expect(estimate!).toBeLessThanOrEqual(10 * 1024 * 1024);
  });
  it("trims to the range", () => {
    const { job } = videoPlanFor(BASE_RECIPE, hd, { start: 5, end: 20 });
    expect([job.trimStart, job.trimEnd]).toEqual([5, 20]);
  });
  it("asks for captions and says the output's frame size (the script is laid out for it)", () => {
    const { job, dims } = videoPlanFor(
      { ...BASE_RECIPE, captions: true, size: "720p" },
      hd,
      null,
    );
    expect(job.subtitles).toEqual({});
    expect(dims).toEqual({ w: 1280, h: 720 });
    expect(
      videoPlanFor(
        { ...BASE_RECIPE, frame: "social", platform: "reels" },
        hd,
        null,
      ).dims,
    ).toEqual({ w: 1080, h: 1920 });
  });
});
