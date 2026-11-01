"use client";
import { fetchFile } from "@ffmpeg/util";
import { getFFmpeg, disposeFFmpeg } from "@/media/ffmpeg/loader";
import { clampRatio, progressLabel } from "@/media/progress";
import { assertWorkerSupport } from "@/media/workers";
import { sanitizeFilename } from "@/lib/utils";

export type ProgressCallback = (p: number | null, msg: string) => void;

const MOUNT_OVER = 8e6;

export interface JobTools {
  fontsDir: string | null;
  probe: (args: string[]) => Promise<string>;
  write: (name: string, text: string) => Promise<void>;
}

export interface FFmpegJob {
  kind: "audio" | "video";
  file: File;
  outputExt: string;
  mime: string;
  extraFiles?: File[];
  fonts?: File[];
  buildArgs: (
    inputName: string,
    outputName: string,
    extraNames: string[],
    tools: JobTools,
  ) => string[] | Promise<string[]>;
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}

const cancelled = () => new DOMException("Cancelled", "AbortError");

export function describeFailure(
  kind: "audio" | "video",
  log: string[],
): string {
  const text = log.join("\n");
  if (/matches no streams/i.test(text)) {
    return kind === "audio"
      ? "No audio stream was found in this file."
      : "No video stream was found in this file. For audio-only files use an audio tool.";
  }
  if (
    /Invalid data found|moov atom not found|EBML header parsing failed|could not find codec parameters/i.test(
      text,
    )
  ) {
    return "The file looks corrupted or is not a supported media format.";
  }
  if (
    /Decoder .* not found|unknown codec|codec not currently supported/i.test(
      text,
    )
  ) {
    return "This file uses a codec the bundled FFmpeg build cannot decode.";
  }
  if (
    /Cannot allocate memory|out of memory|\bOOM\b|memory access out of bounds/i.test(
      text,
    )
  ) {
    return "The browser ran out of memory. Try a shorter clip, a lower resolution, or close other tabs.";
  }
  const last = log.filter((l) => /error|invalid|failed/i.test(l)).pop();
  return last
    ? `FFmpeg reported: ${last.trim().slice(0, 200)}`
    : "FFmpeg could not process this file.";
}

export async function runFFmpegJob(
  job: FFmpegJob,
): Promise<{ blob: Blob; filename: string }> {
  const { kind, file, outputExt, mime, buildArgs, onProgress, signal } = job;
  if (signal?.aborted) throw cancelled();
  assertWorkerSupport();
  onProgress?.(null, "Loading encoder… (downloaded once, then cached)");
  const ffmpeg = await getFFmpeg();
  if (signal?.aborted) throw cancelled();

  const stamp = Date.now();
  const extIn =
    (file.name.split(".").pop() || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "bin";
  const inputName = `in_${stamp}.${extIn}`;
  const extras = job.extraFiles ?? [];
  const extraNames = extras.map(
    (f, i) =>
      `in_${stamp}_${i + 1}.${(f.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"}`,
  );
  const outputName = `out_${stamp}.${outputExt}`;
  const mountDir = `/in_${stamp}`;
  const fontsDir = `/fonts_${stamp}`;
  const toRemove: string[] = [];
  let mounted = false;
  let fontsMade = false;
  let fontsMounted = false;

  const log: string[] = [];
  const onLog = ({ message }: { message: string }) => {
    log.push(message);
    if (log.length > 60) log.shift();
  };
  const onProg = ({ progress }: { progress: number }) => {
    const p = clampRatio(progress);
    onProgress?.(p, progressLabel(p));
  };
  ffmpeg.on("log", onLog);
  ffmpeg.on("progress", onProg);
  const onAbort = () => disposeFFmpeg();
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    onProgress?.(null, "Reading file…");
    const all: [File, string][] = [
      [file, inputName],
      ...extras.map((f, i): [File, string] => [f, extraNames[i]]),
    ];
    // Big files are read on demand instead of being copied into WebAssembly memory.
    const large = all.filter(([f]) => f.size >= MOUNT_OVER);
    if (large.length) {
      try {
        await ffmpeg.createDir(mountDir);
        mounted = await ffmpeg.mount(
          "WORKERFS" as never,
          { blobs: large.map(([data, name]) => ({ name, data })) },
          mountDir,
        );
      } catch {
        mounted = false;
      }
    }
    const paths = new Map<string, string>();
    for (const [f, name] of all) {
      if (signal?.aborted) throw cancelled();
      if (mounted && f.size >= MOUNT_OVER) {
        paths.set(name, `${mountDir}/${name}`);
        continue;
      }
      await ffmpeg.writeFile(name, await fetchFile(f));
      toRemove.push(name);
      paths.set(name, name);
    }
    if (signal?.aborted) throw cancelled();
    const fonts = job.fonts ?? [];
    if (fonts.length) {
      await ffmpeg.createDir(fontsDir);
      fontsMade = true;
      try {
        fontsMounted = await ffmpeg.mount(
          "WORKERFS" as never,
          { blobs: fonts.map((data) => ({ name: data.name, data })) },
          fontsDir,
        );
      } catch {
        fontsMounted = false;
      }
      if (!fontsMounted)
        for (const f of fonts) {
          const path = `${fontsDir}/${f.name}`;
          await ffmpeg.writeFile(path, await fetchFile(f));
          toRemove.push(path);
        }
    }
    const tools: JobTools = {
      fontsDir: fonts.length ? fontsDir : null,
      probe: async (args) => {
        const lines: string[] = [];
        const note = ({ message }: { message: string }) => lines.push(message);
        ffmpeg.on("log", note);
        try {
          await ffmpeg.exec(args);
        } finally {
          ffmpeg.off("log", note);
        }
        return lines.join("\n");
      },
      write: async (name, text) => {
        await ffmpeg.writeFile(name, text);
        toRemove.push(name);
      },
    };

    onProgress?.(
      null,
      kind === "video" ? "Encoding video… this can take minutes" : "Encoding…",
    );
    const code = await ffmpeg.exec(
      await buildArgs(
        paths.get(inputName)!,
        outputName,
        extraNames.map((n) => paths.get(n)!),
        tools,
      ),
    );
    if (signal?.aborted) throw cancelled();
    if (code !== 0) throw new Error(describeFailure(kind, log));

    const data = (await ffmpeg.readFile(outputName)) as Uint8Array;
    if (!data || data.length === 0)
      throw new Error(
        "The encoder produced an empty file. The source may be unsupported or corrupted.",
      );
    const blob = new Blob([data as unknown as BlobPart], { type: mime });
    const base = sanitizeFilename(file.name.replace(/\.[^/.]+$/, "")) || kind;
    onProgress?.(1, "Done");
    return { blob, filename: `${base}.${outputExt}` };
  } catch (e: unknown) {
    if (
      signal?.aborted ||
      (e instanceof Error && /terminate\(\)/i.test(e.message))
    )
      throw cancelled();
    const msg = e instanceof Error ? e.message : String(e);
    if (
      /RuntimeError|out of bounds|Aborted|unreachable/i.test(msg) ||
      log.some((l) => /RuntimeError|Aborted\(/.test(l))
    ) {
      try {
        disposeFFmpeg();
      } catch {
        /* already gone */
      }
    }
    console.warn("[ffmpeg] job failed:", msg, log.slice(-15).join(" | "));
    const detail = /^(No |The |This |FFmpeg )/.test(msg)
      ? msg
      : describeFailure(kind, [...log, msg]);
    throw new Error(
      `${kind === "audio" ? "Audio" : "Video"} processing failed. ${detail}`,
    );
  } finally {
    try {
      ffmpeg.off("log", onLog);
    } catch {}
    try {
      ffmpeg.off("progress", onProg);
    } catch {}
    signal?.removeEventListener("abort", onAbort);
    for (const n of toRemove) {
      try {
        await ffmpeg.deleteFile(n);
      } catch {}
    }
    if (mounted) {
      try {
        await ffmpeg.unmount(mountDir);
        await ffmpeg.deleteDir(mountDir);
      } catch {}
    }
    if (fontsMade) {
      try {
        if (fontsMounted) await ffmpeg.unmount(fontsDir);
        await ffmpeg.deleteDir(fontsDir);
      } catch {}
    }
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {}
  }
}
