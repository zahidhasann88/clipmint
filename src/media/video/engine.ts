"use client";
import {
  buildConcatCopyArgs,
  buildVideoArgs,
  buildVideoMergeArgs,
  concatList,
  inputsWithAudio,
  sameStreams,
  type VideoJobOptions,
  type VideoMergeOptions,
} from "@/media/ffmpeg/commands";
import { runFFmpegJob, type ProgressCallback } from "@/media/ffmpeg/run";

export type VideoProcessOptions = VideoJobOptions;

const MIME: Record<VideoJobOptions["outputFormat"], string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  gif: "image/gif",
};

export function processVideo(
  file: File,
  opts: VideoProcessOptions,
  meta: { width?: number | null; height?: number | null },
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
  music?: File | null,
  model?: File | null,
  script?: File | null,
  overlay?: { text?: File | null; logo?: File | null } | null,
  fonts: File[] = [],
): Promise<{ blob: Blob; filename: string }> {
  const marks = opts.overlay
    ? [overlay?.text, overlay?.logo].filter((f): f is File => !!f)
    : [];
  return runFFmpegJob({
    kind: "video",
    file,
    outputExt: opts.outputFormat,
    mime: MIME[opts.outputFormat],
    extraFiles: [
      ...(music && opts.music ? [music] : []),
      ...(model ? [model] : []),
      ...(script && opts.subtitles ? [script] : []),
      ...marks,
    ],
    fonts,
    buildArgs: (input, output, extras, tools) => {
      let i = music && opts.music ? 1 : 0;
      const m = model ? extras[i++] : null;
      const burned = script && opts.subtitles ? extras[i++] : null;
      let o = opts.denoise
        ? { ...opts, denoise: { ...opts.denoise, model: m } }
        : opts;
      if (o.subtitles)
        o = {
          ...o,
          subtitles: burned
            ? { ...o.subtitles, file: burned, fontsDir: tools.fontsDir }
            : null,
        };
      if (opts.overlay) {
        const text = overlay?.text ? extras[i++] : null;
        const logo = overlay?.logo ? extras[i++] : null;
        o = {
          ...o,
          overlay: {
            text:
              o.overlay?.text && text
                ? { file: text, fontsDir: tools.fontsDir }
                : null,
            logo:
              o.overlay?.logo && logo
                ? { ...o.overlay.logo, file: logo }
                : null,
          },
        };
      }
      return buildVideoArgs(
        input,
        output,
        o,
        meta.width ?? null,
        meta.height ?? null,
        music && opts.music ? extras.slice(0, 1) : [],
      );
    },
    onProgress,
    signal,
  });
}

export interface MergeClip {
  file: File;
  start: number;
  length: number;
}

export function mergeVideo(
  clips: MergeClip[],
  opts: Omit<VideoMergeOptions, "music">,
  song: {
    file: File;
    volume: number;
    originalVolume: number;
    from?: number;
  } | null,
  allowCopy: boolean,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<{ blob: Blob; filename: string }> {
  const files = Array.from(new Set(clips.map((c) => c.file)));
  return runFFmpegJob({
    kind: "video",
    file: files[0],
    outputExt: opts.outputFormat,
    mime: MIME[opts.outputFormat],
    extraFiles: [...files.slice(1), ...(song ? [song.file] : [])],
    buildArgs: async (input, output, extras, tools) => {
      const names = [input, ...extras];
      const log = await tools.probe([
        "-hide_banner",
        ...names.slice(0, files.length).flatMap((n) => ["-i", n]),
        "-t",
        "0",
        "-f",
        "null",
        "-",
      ]);
      if (allowCopy && sameStreams(log, files.length)) {
        await tools.write("clips.txt", concatList(names));
        return buildConcatCopyArgs("clips.txt", output);
      }
      const audio = inputsWithAudio(log);
      return buildVideoMergeArgs(
        clips.map((c) => {
          const i = files.indexOf(c.file);
          return {
            file: names[i],
            start: c.start,
            length: c.length,
            hasAudio: audio.has(i),
          };
        }),
        output,
        {
          ...opts,
          music: song
            ? {
                file: names[files.length],
                volume: song.volume,
                originalVolume: song.originalVolume,
                from: song.from,
              }
            : null,
        },
      );
    },
    onProgress,
    signal,
  });
}
