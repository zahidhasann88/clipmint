export function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = sec.toFixed(3).padStart(6, "0");
  return `${hh}:${mm}:${ss}`;
}

export type AudioJobOptions = {
  trimStart?: number | null;
  trimEnd?: number | null;
  outputFormat: "mp3" | "wav" | "flac" | "ogg" | "m4a" | "aac" | "opus";
  mp3Bitrate?: number;
  sampleRate?: number | null;
  channels?: number | null;
  aacBitrate?: string;
  bitrate?: number;
  fadeIn?: number | null;
  fadeOut?: number | null;
  loudness?: number | null;
  tempo?: number | null;
  denoise?: Denoise | null;
  silence?: { mode: "ends" | "pauses"; pause: number } | null;
  crossfade?: number | null;
};

export type Denoise = {
  level: "light" | "voice" | "strong";
  model?: string | null;
};

export function denoiseChain(d: Denoise): string[] {
  const out = ["highpass=f=70"];
  if (d.level === "light" || !d.model) out.push("afftdn=nr=12:nf=-30:tn=1");
  else {
    out.push(`arnndn=m=${d.model}`);
    if (d.level === "strong") out.push("afftdn=nr=10:nf=-35");
  }
  return out;
}

export function silenceChain(
  s: NonNullable<AudioJobOptions["silence"]>,
): string[] {
  const edge =
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1";
  if (s.mode === "ends") return [edge, "areverse", edge, "areverse"];
  return [
    `silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1:stop_periods=-1:stop_duration=${s.pause.toFixed(2)}:stop_threshold=-45dB:stop_silence=${Math.min(0.3, s.pause / 2).toFixed(2)}`,
  ];
}

export type VideoJobOptions = {
  trimStart?: number | null;
  trimEnd?: number | null;
  outputFormat: "mp4" | "webm" | "gif";
  preset: "smaller" | "balanced" | "quality";
  customCrf?: number | null;
  audioBitrate?: string | null;
  resizePreset: "original" | "1080p" | "720p" | "480p";
  removeAudio?: boolean;
  targetVideoKbps?: number | null;
  gif?: { fps: number; width: number } | null;
  speed?: number | null;
  rotate?: 0 | 90 | 180 | 270 | null;
  flip?: "h" | "v" | null;
  frame?: {
    aspect: number;
    mode: "crop" | "blur" | "bars";
    pos?: number;
    width?: number;
    height?: number;
    track?: { t: number; x: number; y: number }[] | null;
  } | null;
  maxFps?: number | null;
  speedMode?: "normal" | "fast" | null;
  subtitles?: { file?: string | null; fontsDir?: string | null } | null;
  denoise?: Denoise | null;
  music?: {
    mode: "mix" | "replace";
    volume: number;
    originalVolume: number;
    duration: number;
  } | null;
  cuts?: { start: number; end: number }[] | null;
  overlay?: {
    text?: { file: string; fontsDir?: string | null } | null;
    logo?: {
      file: string;
      width: number;
      corner: "tl" | "tr" | "bl" | "br";
    } | null;
  } | null;
  blur?: FaceBox[][] | null;
};

export interface FaceBox {
  t: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const speedOf = (o: Pick<VideoJobOptions, "speed">) =>
  o.speed && Math.abs(o.speed - 1) > 1e-6 ? o.speed : null;

export function trimsInGraph(
  o: Pick<
    VideoJobOptions,
    "speed" | "music" | "cuts" | "removeAudio" | "outputFormat"
  >,
): boolean {
  return !!(
    speedOf(o) ||
    (o.music && !o.removeAudio && o.outputFormat !== "gif") ||
    o.cuts?.length
  );
}

export function filterClock(
  o: Pick<
    VideoJobOptions,
    "speed" | "music" | "cuts" | "removeAudio" | "outputFormat" | "trimStart"
  >,
): (s: number) => number {
  const from = trimsInGraph(o) ? (o.trimStart ?? 0) : 0;
  const k = speedOf(o) ?? 1;
  return (s) => (s - from) / k;
}

function cutPlan(o: VideoJobOptions) {
  if (!o.cuts?.length) return null;
  const clock = filterClock(o);
  const keep = o.cuts
    .map((c) => ({ start: Math.max(0, clock(c.start)), end: clock(c.end) }))
    .filter((c) => c.end - c.start > 0.02);
  const gaps: { at: number; len: number }[] = [];
  let last = 0;
  for (const k of keep) {
    if (k.start - last > 0.001) gaps.push({ at: k.start, len: k.start - last });
    last = k.end;
  }
  return { keep, gaps };
}

export function outputClock(o: VideoJobOptions): (s: number) => number | null {
  const clock = filterClock(o);
  const plan = cutPlan(o);
  const from = trimsInGraph(o) ? 0 : clock(o.trimStart ?? 0);
  return (s) => {
    const t = clock(s);
    if (t < from - 1e-3) return null;
    if (!plan) return t - from;
    if (!plan.keep.some((k) => t >= k.start - 1e-3 && t <= k.end + 1e-3))
      return null;
    return (
      t -
      plan.gaps.filter((g) => g.at <= t + 1e-3).reduce((n, g) => n + g.len, 0)
    );
  };
}

export function cutFilters(
  o: VideoJobOptions,
): { video: string[]; audio: string[] } | null {
  const plan = cutPlan(o);
  if (!plan || !plan.keep.length) return null;
  const sel = plan.keep
    .map((k) => `between(t,${k.start.toFixed(3)},${k.end.toFixed(3)})`)
    .join("+");
  const shift = plan.gaps.length
    ? plan.gaps
        .map((g) => `gte(T,${g.at.toFixed(3)})*${g.len.toFixed(3)}`)
        .join("+")
    : "0";
  return {
    video: [`select='${sel}'`, `setpts='(T-(${shift}))/TB'`],
    audio: [`aselect='${sel}'`, `asetpts='(T-(${shift}))/TB'`],
  };
}

export function keyframeExpr(keys: { t: number; v: number }[]): string {
  if (!keys.length) return "0.5";
  let expr = keys[keys.length - 1].v.toFixed(4);
  for (let i = keys.length - 2; i >= 0; i--) {
    const a = keys[i],
      b = keys[i + 1],
      dt = Math.max(1e-3, b.t - a.t);
    expr = `if(lt(t,${b.t.toFixed(3)}),${a.v.toFixed(4)}+${(b.v - a.v).toFixed(4)}*(t-${a.t.toFixed(3)})/${dt.toFixed(3)},${expr})`;
  }
  return `if(lt(t,${keys[0].t.toFixed(3)}),${keys[0].v.toFixed(4)},${expr})`;
}

export function blurFilter(
  track: FaceBox[],
  index: number,
  at: (s: number) => number,
): string {
  const keys = track.map((k) => ({ ...k, t: at(k.t) }));
  const x = keyframeExpr(keys.map((k) => ({ t: k.t, v: k.x })));
  const y = keyframeExpr(keys.map((k) => ({ t: k.t, v: k.y })));
  const w = Math.min(1, Math.max(...keys.map((k) => k.w)) * 1.5).toFixed(4);
  const h = Math.min(1, Math.max(...keys.map((k) => k.h)) * 1.7).toFixed(4);
  const from = Math.max(0, keys[0].t - 0.6).toFixed(3),
    to = (keys[keys.length - 1].t + 0.6).toFixed(3);
  return (
    `split[fb${index}][fa${index}];` +
    `[fa${index}]crop=w='max(16,trunc(iw*${w}/2)*2)':h='max(16,trunc(ih*${h}/2)*2)':x='clip((${x})*iw-ow/2,0,iw-ow)':y='clip((${y})*ih-oh/2,0,ih-oh)',boxblur=luma_radius='min(w,h)/5':luma_power=3[fc${index}];` +
    `[fb${index}][fc${index}]overlay=x='clip((${x})*W-w/2,0,W-w)':y='clip((${y})*H-h/2,0,H-h)':enable='between(t,${from},${to})'`
  );
}

// Complex shaping is what joins Bengali and Devanagari letters; the plain
// subtitles filter has no such option.
export const assFilter = (file: string, fontsDir?: string | null) =>
  `ass=filename=${file}:fontsdir=${fontsDir || "."}:shaping=complex`;

export function overlayFilters(
  vf: string[],
  overlay: VideoJobOptions["overlay"],
): void {
  const t = overlay?.text;
  if (t) vf.push(assFilter(t.file, t.fontsDir));
  const l = overlay?.logo;
  if (l) {
    const m = "(main_w*0.03)";
    const x = l.corner[1] === "l" ? m : `main_w-overlay_w-${m}`;
    const y = l.corner[0] === "t" ? m : `main_h-overlay_h-${m}`;
    const head = vf.length ? vf.join(",") : "null";
    vf.length = 0;
    vf.push(
      `${head}[base];movie=${l.file},scale=${Math.round(l.width / 2) * 2}:-2[logo];[base][logo]overlay=${x}:${y},format=yuv420p`,
    );
  }
}

export function atempoChain(speed: number): string[] {
  const out: string[] = [];
  let s = speed;
  while (s > 2) {
    out.push("atempo=2");
    s /= 2;
  }
  while (s < 0.5) {
    out.push("atempo=0.5");
    s /= 0.5;
  }
  if (Math.abs(s - 1) > 1e-6) out.push(`atempo=${+s.toFixed(4)}`);
  return out;
}

export function normalizeCrf(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(51, Math.max(0, Math.round(n)));
}

export function overlapFor(
  wanted: number | null | undefined,
  lengths: number[],
): number {
  if (!wanted || wanted <= 0 || lengths.length < 2) return 0;
  return Math.min(wanted, Math.min(...lengths) / 2);
}

export function buildMergeArgs(
  inputs: string[],
  outputName: string,
  opts: AudioJobOptions,
  ranges: ({ start: number; end: number } | null)[],
  lengths: (number | null)[] = [],
): string[] {
  const args: string[] = [];
  inputs.forEach((n) => args.push("-i", n));
  const rate = opts.outputFormat === "opus" ? 48000 : opts.sampleRate || 44100;
  const layout = opts.channels === 1 ? "mono" : "stereo";
  const parts = inputs.map((_, i) => {
    const r = ranges[i];
    const trim = r
      ? `atrim=start=${r.start.toFixed(3)}:end=${r.end.toFixed(3)},asetpts=PTS-STARTPTS,`
      : "";
    return `[${i}:a:0]${trim}aresample=${rate},aformat=sample_fmts=fltp:channel_layouts=${layout}[p${i}]`;
  });
  const known = lengths.length === inputs.length && lengths.every((l) => l);
  const cross = known ? overlapFor(opts.crossfade, lengths as number[]) : 0;
  const joins: string[] = [];
  let joined = "[p0]";
  if (cross > 0) {
    for (let i = 1; i < inputs.length - 1; i++) {
      joins.push(
        `${joined}[p${i}]acrossfade=d=${cross.toFixed(3)}[x${i}]`,
      );
      joined = `[x${i}]`;
    }
  }
  const chain = [
    cross > 0
      ? `${joined}[p${inputs.length - 1}]acrossfade=d=${cross.toFixed(3)}`
      : `${inputs.map((_, i) => `[p${i}]`).join("")}concat=n=${inputs.length}:v=0:a=1`,
  ];
  if (opts.fadeIn) chain.push(`afade=t=in:st=0:d=${opts.fadeIn.toFixed(2)}`);
  if (opts.fadeOut && known) {
    const total =
      (lengths as number[]).reduce((a, b) => a + b, 0) -
      cross * (inputs.length - 1);
    chain.push(
      `afade=t=out:st=${Math.max(0, total - opts.fadeOut).toFixed(3)}:d=${opts.fadeOut.toFixed(2)}`,
    );
  }
  if (opts.loudness)
    chain.push(
      `loudnorm=I=${opts.loudness}:TP=-1.5:LRA=11`,
      `aresample=${rate}`,
    );
  args.push(
    "-filter_complex",
    [...parts, ...joins, `${chain.join(",")}[out]`].join(";"),
    "-map",
    "[out]",
  );
  const enc = buildAudioArgs("x", outputName, {
    ...opts,
    trimStart: null,
    trimEnd: null,
    fadeIn: null,
    fadeOut: null,
    loudness: null,
    tempo: null,
  });
  args.push(...enc.slice(enc.indexOf("-map") + 2));
  return args;
}

export function buildAudioArgs(
  inputName: string,
  outputName: string,
  opts: AudioJobOptions,
): string[] {
  const args: string[] = ["-i", inputName, "-map", "0:a:0"];
  const fadeIn = opts.fadeIn && opts.fadeIn > 0 ? opts.fadeIn : 0;
  const fadeOut = opts.fadeOut && opts.fadeOut > 0 ? opts.fadeOut : 0;
  const tempo =
    opts.tempo && Math.abs(opts.tempo - 1) > 1e-6 ? opts.tempo : null;
  if (
    fadeIn ||
    fadeOut ||
    opts.loudness ||
    tempo ||
    opts.denoise ||
    opts.silence
  ) {
    const f: string[] = [];
    if (opts.trimStart != null || opts.trimEnd != null) {
      f.push(
        `atrim=start=${(opts.trimStart ?? 0).toFixed(3)}${opts.trimEnd != null ? `:end=${opts.trimEnd.toFixed(3)}` : ""}`,
        "asetpts=PTS-STARTPTS",
      );
    }
    if (fadeIn) f.push(`afade=t=in:st=0:d=${fadeIn.toFixed(2)}`);
    if (fadeOut) {
      const len =
        opts.trimEnd != null ? opts.trimEnd - (opts.trimStart ?? 0) : null;
      if (len != null)
        f.push(
          `afade=t=out:st=${Math.max(0, len - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(2)}`,
        );
    }
    if (opts.denoise)
      f.splice(
        f.findIndex((x) => x.startsWith("afade")) >= 0
          ? f.findIndex((x) => x.startsWith("afade"))
          : f.length,
        0,
        ...denoiseChain(opts.denoise),
      );
    if (opts.silence) f.push(...silenceChain(opts.silence));
    if (opts.loudness) f.push(`loudnorm=I=${opts.loudness}:TP=-1.5:LRA=11`);
    if (tempo) f.push(...atempoChain(tempo));
    if (f.length) args.push("-af", f.join(","));
    if (
      (opts.loudness || opts.denoise) &&
      !opts.sampleRate &&
      opts.outputFormat !== "opus"
    )
      args.push("-ar", "48000");
  } else if (opts.trimStart != null || opts.trimEnd != null) {
    const seek = opts.trimStart ?? 0;
    const dur = opts.trimEnd != null ? Math.max(0, opts.trimEnd - seek) : null;
    args.push("-ss", fmtTime(seek));
    if (dur != null && dur > 0) args.push("-t", fmtTime(dur));
  }

  switch (opts.outputFormat) {
    case "mp3":
      args.push("-c:a", "libmp3lame", "-b:a", `${opts.mp3Bitrate ?? 192}k`);
      break;
    case "wav":
      args.push("-c:a", "pcm_s16le");
      break;
    case "flac":
      args.push("-c:a", "flac");
      break;
    case "ogg":
      if (opts.bitrate)
        args.push("-c:a", "libvorbis", "-b:a", `${opts.bitrate}k`);
      else args.push("-c:a", "libvorbis", "-q:a", "4");
      break;
    case "opus":
      args.push(
        "-c:a",
        "opus",
        "-strict",
        "-2",
        "-b:a",
        `${opts.bitrate ?? 128}k`,
        "-ar",
        "48000",
      );
      break;
    case "m4a":
    case "aac":
      args.push("-c:a", "aac", "-b:a", opts.aacBitrate ?? "128k");
      break;
  }
  if (opts.sampleRate && opts.outputFormat !== "opus")
    args.push("-ar", String(opts.sampleRate));
  if (opts.channels) args.push("-ac", String(opts.channels));

  args.push("-y", outputName);
  return args;
}

const CRF_MAP = { smaller: 28, balanced: 23, quality: 18 };

export type ClipPiece = {
  file: string;
  start: number;
  length: number;
  hasAudio: boolean;
};

export type VideoMergeOptions = Pick<
  VideoJobOptions,
  | "outputFormat"
  | "preset"
  | "customCrf"
  | "targetVideoKbps"
  | "audioBitrate"
  | "speedMode"
> & {
  width: number;
  height: number;
  fps: number;
  fit: "bars" | "crop";
  transition?: number | null;
  sound: boolean;
  music?: {
    file: string;
    volume: number;
    originalVolume: number;
    from?: number;
  } | null;
};

function mergeEncodeArgs(o: VideoMergeOptions, out: string): string[] {
  const target =
    o.targetVideoKbps && o.targetVideoKbps > 0
      ? Math.round(o.targetVideoKbps)
      : null;
  const crf = normalizeCrf(o.customCrf) ?? CRF_MAP[o.preset];
  const rate = target
    ? [
        "-b:v",
        `${target}k`,
        "-maxrate",
        `${target}k`,
        "-bufsize",
        `${target * 2}k`,
      ]
    : null;
  const quiet = !o.sound && !o.music;
  if (o.outputFormat === "webm")
    return [
      "-c:v",
      "libvpx",
      "-deadline",
      "realtime",
      "-cpu-used",
      o.speedMode === "fast" ? "8" : "5",
      ...(rate ?? [
        "-crf",
        String(Math.min(63, Math.max(4, Math.round((crf - 18) * 2 + 10)))),
        "-b:v",
        "8M",
      ]),
      ...(quiet
        ? ["-an"]
        : ["-c:a", "libvorbis", "-b:a", o.audioBitrate ?? "128k"]),
      "-y",
      out,
    ];
  return [
    "-c:v",
    "libx264",
    "-preset",
    o.speedMode === "fast" ? "ultrafast" : "veryfast",
    ...(rate ?? ["-crf", String(crf)]),
    "-pix_fmt",
    "yuv420p",
    ...(quiet ? ["-an"] : ["-c:a", "aac", "-b:a", o.audioBitrate ?? "128k"]),
    "-movflags",
    "+faststart",
    "-y",
    out,
  ];
}

export function buildVideoMergeArgs(
  pieces: ClipPiece[],
  outputName: string,
  o: VideoMergeOptions,
): string[] {
  const W = Math.round(o.width / 2) * 2,
    H = Math.round(o.height / 2) * 2;
  const args: string[] = [];
  for (const p of pieces)
    args.push(
      "-ss",
      p.start.toFixed(3),
      "-t",
      p.length.toFixed(3),
      "-i",
      p.file,
    );
  const lengths = pieces.map((p) => p.length);
  const cross = overlapFor(o.transition, lengths);
  const fit =
    o.fit === "crop"
      ? `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`
      : `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`;
  const keepSound = o.sound && (!o.music || o.music.originalVolume > 0);
  const shape =
    "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo";
  const graph: string[] = [];
  pieces.forEach((p, i) => {
    graph.push(
      `[${i}:v:0]${fit},setsar=1,fps=${o.fps},format=yuv420p,settb=AVTB[v${i}]`,
    );
    if (!keepSound) return;
    const len = p.length.toFixed(3);
    graph.push(
      p.hasAudio
        ? `[${i}:a:0]aresample=48000,${shape},apad,atrim=0:${len},asetpts=PTS-STARTPTS[a${i}]`
        : `anullsrc=r=48000:cl=stereo,atrim=0:${len},${shape},asetpts=PTS-STARTPTS[a${i}]`,
    );
  });
  let v = "[v0]",
    a = "[a0]";
  if (pieces.length > 1 && cross > 0) {
    let at = 0;
    for (let i = 1; i < pieces.length; i++) {
      at += lengths[i - 1] - cross;
      const nv = `[vx${i}]`,
        na = `[ax${i}]`;
      graph.push(
        `${v}[v${i}]xfade=transition=fade:duration=${cross.toFixed(3)}:offset=${at.toFixed(3)}${nv}`,
      );
      if (keepSound)
        graph.push(`${a}[a${i}]acrossfade=d=${cross.toFixed(3)}${na}`);
      v = nv;
      a = na;
    }
  } else if (pieces.length > 1) {
    v = "[vout]";
    a = "[aout]";
    graph.push(
      keepSound
        ? `${pieces.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${pieces.length}:v=1:a=1[vout][aout]`
        : `${pieces.map((_, i) => `[v${i}]`).join("")}concat=n=${pieces.length}:v=1:a=0[vout]`,
    );
  }
  if (o.music) {
    const total =
      lengths.reduce((n, l) => n + l, 0) - cross * (pieces.length - 1);
    args.push("-stream_loop", "-1", "-i", o.music.file);
    const from = o.music.from ?? 0;
    const song = `[${pieces.length}:a:0]atrim=${from.toFixed(3)}:${(from + total).toFixed(3)},asetpts=PTS-STARTPTS,volume=${o.music.volume.toFixed(2)},afade=t=out:st=${Math.max(0, total - 2).toFixed(3)}:d=2`;
    if (keepSound)
      graph.push(
        `${a}volume=${o.music.originalVolume.toFixed(2)}[orig]`,
        `${song}[song]`,
        "[orig][song]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mixed]",
      );
    else graph.push(`${song}[mixed]`);
    a = "[mixed]";
  }
  args.push("-filter_complex", graph.join(";"), "-map", v);
  if (keepSound || o.music) args.push("-map", a);
  args.push(...mergeEncodeArgs(o, outputName));
  return args;
}

export function inputsWithAudio(log: string): Set<number> {
  const out = new Set<number>();
  let at = -1;
  for (const line of log.split("\n")) {
    const input = /Input #(\d+)/.exec(line);
    if (input) at = +input[1];
    if (/^\s*(Output #|Stream mapping)/.test(line)) break;
    if (at >= 0 && /Stream #\d+:\d+.*?: Audio:/.test(line)) out.add(at);
  }
  return out;
}

export function concatList(files: string[]): string {
  return (
    files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n"
  );
}

export function buildConcatCopyArgs(
  listName: string,
  outputName: string,
): string[] {
  return [
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listName,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    "-y",
    outputName,
  ];
}

// True when every input reports the same stream layout, so the files can be
// joined without re-encoding. Bitrates may differ.
export function sameStreams(log: string, count: number): boolean {
  const seen = new Map<string, string[]>();
  let at: string | null = null;
  for (const line of log.split("\n")) {
    const input = /Input #(\d+)/.exec(line);
    if (input) at = input[1];
    if (/^\s*(Output #|Stream mapping)/.test(line)) break;
    if (!at) continue;
    const s = /Stream #\d+:\d+.*?: (Video|Audio): (.*)$/.exec(line);
    const turn = /displaymatrix|rotate\s*:/.test(line);
    if (!s && !turn) continue;
    const text = s
      ? `${s[1]}:${s[2]
          .replace(/,\s*[\d.]+ kb\/s/g, "")
          .replace(/\s*\((default|attached pic)\)/g, "")}`
      : line.trim();
    seen.set(at, [...(seen.get(at) ?? []), text]);
  }
  if (seen.size !== count) return false;
  const all = Array.from(seen.values()).map((l) => l.join("|"));
  return all.every((l) => l === all[0]) && all[0].includes("Video:");
}

export function buildVideoArgs(
  inputName: string,
  outputName: string,
  opts: VideoJobOptions,
  _inputW?: number | null,
  _inputH?: number | null,
  extraNames: string[] = [],
): string[] {
  const music =
    opts.music &&
    extraNames[0] &&
    !opts.removeAudio &&
    opts.outputFormat !== "gif"
      ? opts.music
      : null;
  const args: string[] = ["-i", inputName];
  if (music) args.push("-stream_loop", "-1", "-i", extraNames[0]);
  args.push("-map", "0:v:0");
  if (!opts.removeAudio && !music) args.push("-map", "0:a:0?");

  const seek = opts.trimStart ?? null;
  const end = opts.trimEnd ?? null;
  const speed = speedOf(opts);
  const clock = filterClock(opts);
  const vf: string[] = [];
  const af: string[] = [];
  if (trimsInGraph(opts)) {
    if (seek != null || end != null) {
      const range = `start=${(seek ?? 0).toFixed(3)}${end != null ? `:end=${end.toFixed(3)}` : ""}`;
      vf.push(`trim=${range}`, "setpts=PTS-STARTPTS");
      af.push(`atrim=${range}`, "asetpts=PTS-STARTPTS");
    }
  } else if (seek != null) {
    args.push("-ss", fmtTime(seek));
    const dur = end != null ? Math.max(0, end - seek) : null;
    if (dur != null && dur > 0) args.push("-t", fmtTime(dur));
  } else if (end != null && end > 0) {
    args.push("-t", fmtTime(end));
  }

  if (opts.blur?.length)
    opts.blur.forEach((track, i) =>
      vf.push(blurFilter(track, i, (s) => clock(s) * (speed ?? 1))),
    );
  if (opts.rotate === 90) vf.push("transpose=1");
  else if (opts.rotate === 270) vf.push("transpose=2");
  else if (opts.rotate === 180) vf.push("hflip", "vflip");
  if (opts.flip === "h") vf.push("hflip");
  else if (opts.flip === "v") vf.push("vflip");
  if (opts.denoise) af.push(...denoiseChain(opts.denoise));
  if (speed) {
    vf.push(`setpts=PTS/${speed}`);
    af.push(...atempoChain(speed));
  }
  const fr = opts.frame;
  let framed = false;
  if (fr && fr.aspect > 0) {
    const a = +fr.aspect.toFixed(5),
      pos = Math.min(1, Math.max(0, fr.pos ?? 0.5));
    const W = fr.width ? Math.round(fr.width / 2) * 2 : null,
      H = fr.height ? Math.round(fr.height / 2) * 2 : null;
    if (fr.mode === "crop" || !W || !H) {
      const tr =
        fr.track && fr.track.length
          ? fr.track.map((k) => ({ ...k, t: clock(k.t) }))
          : null;
      const x = tr
        ? `clip(${keyframeExpr(tr.map((k) => ({ t: k.t, v: k.x })))}*iw-ow/2,0,iw-ow)`
        : `(iw-ow)*${pos}`;
      const y = tr
        ? `clip(${keyframeExpr(tr.map((k) => ({ t: k.t, v: k.y })))}*ih-oh/2,0,ih-oh)`
        : `(ih-oh)*${pos}`;
      vf.push(
        `crop=w='trunc(min(iw,ih*${a})/2)*2':h='trunc(min(ih,iw/${a})/2)*2':x='${x}':y='${y}'`,
      );
      if (W && H) vf.push(`scale=${W}:${H}`);
    } else if (fr.mode === "bars") {
      vf.push(
        `scale=${W}:${H}:force_original_aspect_ratio=decrease`,
        `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`,
      );
    } else {
      vf.push(
        `split[fg][bg];[bg]scale=${Math.round(W / 8)}:${Math.round(H / 8)}:force_original_aspect_ratio=increase,crop=${Math.round(W / 8)}:${Math.round(H / 8)},boxblur=6:2,scale=${W}:${H}[bgb];[fg]scale=${W}:${H}:force_original_aspect_ratio=decrease[fgs];[bgb][fgs]overlay=(W-w)/2:(H-h)/2`,
      );
    }
    vf.push("setsar=1");
    framed = !!(W && H);
  }
  if (opts.maxFps) vf.push(`fps=${opts.maxFps}`);

  const turned = opts.rotate === 90 || opts.rotate === 270;
  const w = turned ? _inputH : _inputW,
    h = turned ? _inputW : _inputH;
  const portrait = !!w && !!h && h > w;
  const base =
    opts.resizePreset === "1080p"
      ? { w: 1920, h: 1080 }
      : opts.resizePreset === "720p"
        ? { w: 1280, h: 720 }
        : opts.resizePreset === "480p"
          ? { w: 854, h: 480 }
          : null;
  const box = base && portrait ? { w: base.h, h: base.w } : base;
  if (box && !framed)
    vf.push(
      `scale=w=${box.w}:h=${box.h}:force_original_aspect_ratio=decrease`,
      "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    );
  else if (vf.length && opts.outputFormat !== "gif")
    vf.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
  if (opts.subtitles?.file && opts.outputFormat !== "gif") {
    vf.push(assFilter(opts.subtitles.file, opts.subtitles.fontsDir));
  }
  const cutsF = cutFilters(opts);
  if (cutsF) {
    vf.push(...cutsF.video);
    if (!opts.removeAudio) af.push(...cutsF.audio);
  }
  if (opts.outputFormat !== "gif") overlayFilters(vf, opts.overlay);
  if (music && opts.outputFormat !== "gif") {
    const len = music.duration;
    const song = `[1:a]atrim=0:${len.toFixed(3)},asetpts=PTS-STARTPTS,volume=${music.volume.toFixed(2)},afade=t=out:st=${Math.max(0, len - 2).toFixed(3)}:d=2[song]`;
    const graph = [`[0:v]${vf.length ? vf.join(",") : "null"}[v]`, song];
    if (music.mode === "mix") {
      graph.push(
        `[0:a]${af.length ? af.join(",") + "," : ""}volume=${music.originalVolume.toFixed(2)}[orig]`,
        "[orig][song]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]",
      );
    } else {
      graph.push("[song]anull[a]");
    }
    args.push(
      "-filter_complex",
      graph.join(";"),
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-shortest",
    );
    const at = args.indexOf("0:v:0");
    if (at > 0) args.splice(at - 1, 2); // [v] replaces the plain video map
  } else {
    if (vf.length) args.push("-vf", vf.join(","));
    if (af.length && !opts.removeAudio && opts.outputFormat !== "gif")
      args.push("-af", af.join(","));
  }

  const target =
    opts.targetVideoKbps && opts.targetVideoKbps > 0
      ? Math.round(opts.targetVideoKbps)
      : null;
  const crf = normalizeCrf(opts.customCrf) ?? CRF_MAP[opts.preset];

  if (opts.outputFormat === "gif") {
    const fps = opts.gif?.fps ?? 12;
    const width = opts.gif?.width ?? 480;
    const scale = `scale='min(${width},iw)':-2:flags=lanczos`;
    const at = args.indexOf("-vf");
    if (at >= 0) args.splice(at, 2);
    const pre = vf.filter((f) => !f.startsWith("scale="));
    args.push(
      "-vf",
      [
        ...pre,
        `fps=${fps}`,
        scale,
        "split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
      ].join(","),
    );
    args.push("-loop", "0", "-an", "-y", outputName);
    const m = args.indexOf("0:a:0?");
    if (m > 0) args.splice(m - 1, 2);
    return args;
  }

  if (opts.outputFormat === "webm") {
    args.push(
      "-c:v",
      "libvpx",
      "-deadline",
      "realtime",
      "-cpu-used",
      opts.speedMode === "fast" ? "8" : "5",
    );
    if (target)
      args.push(
        "-b:v",
        `${target}k`,
        "-maxrate",
        `${target}k`,
        "-bufsize",
        `${target * 2}k`,
      );
    else
      args.push(
        "-crf",
        String(Math.min(63, Math.max(4, Math.round((crf - 18) * 2 + 10)))),
        "-b:v",
        "8M",
      );
    if (opts.removeAudio) args.push("-an");
    else args.push("-c:a", "libvorbis", "-b:a", opts.audioBitrate ?? "128k");
    args.push("-y", outputName);
    return args;
  }

  args.push(
    "-c:v",
    "libx264",
    "-preset",
    opts.speedMode === "fast" ? "ultrafast" : "veryfast",
  );
  if (target) {
    args.push(
      "-b:v",
      `${target}k`,
      "-maxrate",
      `${target}k`,
      "-bufsize",
      `${target * 2}k`,
    );
  } else {
    args.push("-crf", String(crf));
  }
  args.push("-pix_fmt", "yuv420p");
  if (opts.removeAudio) args.push("-an");
  else
    args.push(
      "-c:a",
      "aac",
      "-b:a",
      opts.audioBitrate ??
        (opts.preset === "smaller"
          ? "96k"
          : opts.preset === "quality"
            ? "192k"
            : "128k"),
    );
  args.push("-movflags", "+faststart");

  args.push("-y", outputName);
  return args;
}
