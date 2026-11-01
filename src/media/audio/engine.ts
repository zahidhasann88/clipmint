"use client";
import {
  buildAudioArgs,
  buildMergeArgs,
  AudioJobOptions,
} from "@/media/ffmpeg/commands";
import { runFFmpegJob, type ProgressCallback } from "@/media/ffmpeg/run";

export type AudioProcessOptions = AudioJobOptions;

const MIME: Record<AudioJobOptions["outputFormat"], string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
};

export function processAudio(
  file: File,
  opts: AudioProcessOptions,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
  model?: File | null,
): Promise<{ blob: Blob; filename: string }> {
  return runFFmpegJob({
    kind: "audio",
    file,
    extraFiles: model ? [model] : [],
    outputExt: opts.outputFormat,
    mime: MIME[opts.outputFormat] ?? "application/octet-stream",
    buildArgs: (input, output, extras) =>
      buildAudioArgs(
        input,
        output,
        opts.denoise
          ? { ...opts, denoise: { ...opts.denoise, model: extras[0] ?? null } }
          : opts,
      ),
    onProgress,
    signal,
  });
}

export function mergeAudio(
  files: File[],
  ranges: ({ start: number; end: number } | null)[],
  opts: AudioProcessOptions,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
  lengths: (number | null)[] = [],
): Promise<{ blob: Blob; filename: string }> {
  return runFFmpegJob({
    kind: "audio",
    file: files[0],
    extraFiles: files.slice(1),
    outputExt: opts.outputFormat,
    mime: MIME[opts.outputFormat] ?? "application/octet-stream",
    buildArgs: (input, output, extras) =>
      buildMergeArgs([input, ...extras], output, opts, ranges, lengths),
    onProgress,
    signal,
  });
}
