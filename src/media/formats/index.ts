export type MediaKind = "audio" | "video";

export interface FormatDef {
  ext: string;
  label: string;
  mime: string;
  kind: MediaKind;
  input: boolean;
  output: boolean;
  note?: string;
}

export const AUDIO_FORMATS: FormatDef[] = [
  {
    ext: "mp3",
    label: "MP3",
    mime: "audio/mpeg",
    kind: "audio",
    input: true,
    output: true,
  },
  {
    ext: "wav",
    label: "WAV",
    mime: "audio/wav",
    kind: "audio",
    input: true,
    output: true,
    note: "PCM 16-bit",
  },
  {
    ext: "ogg",
    label: "OGG Vorbis",
    mime: "audio/ogg",
    kind: "audio",
    input: true,
    output: true,
  },
  {
    ext: "opus",
    label: "Opus",
    mime: "audio/opus",
    kind: "audio",
    input: true,
    output: true,
    note: "In an Ogg container",
  },
  {
    ext: "flac",
    label: "FLAC",
    mime: "audio/flac",
    kind: "audio",
    input: true,
    output: true,
    note: "Lossless",
  },
  {
    ext: "m4a",
    label: "M4A / AAC",
    mime: "audio/mp4",
    kind: "audio",
    input: true,
    output: true,
  },
  {
    ext: "aac",
    label: "AAC",
    mime: "audio/aac",
    kind: "audio",
    input: true,
    output: true,
  },
  {
    ext: "wma",
    label: "WMA",
    mime: "audio/x-ms-wma",
    kind: "audio",
    input: true,
    output: false,
    note: "Decode only",
  },
  {
    ext: "weba",
    label: "WebM audio",
    mime: "audio/webm",
    kind: "audio",
    input: true,
    output: false,
    note: "Browser recordings",
  },
];

export const VIDEO_FORMATS: FormatDef[] = [
  {
    ext: "mp4",
    label: "MP4 (H.264/AAC)",
    mime: "video/mp4",
    kind: "video",
    input: true,
    output: true,
  },
  {
    ext: "webm",
    label: "WebM",
    mime: "video/webm",
    kind: "video",
    input: true,
    output: true,
    note: "VP8 + Vorbis",
  },
  {
    ext: "mov",
    label: "MOV",
    mime: "video/quicktime",
    kind: "video",
    input: true,
    output: false,
    note: "Input only — output to MP4",
  },
  {
    ext: "mkv",
    label: "MKV",
    mime: "video/x-matroska",
    kind: "video",
    input: true,
    output: false,
    note: "Input only — output to MP4",
  },
  {
    ext: "avi",
    label: "AVI",
    mime: "video/x-msvideo",
    kind: "video",
    input: true,
    output: false,
    note: "Decode only",
  },
];

export const SUPPORTED_AUDIO_INPUT_EXTS = AUDIO_FORMATS.filter(
  (f) => f.input,
).map((f) => f.ext);
export const SUPPORTED_VIDEO_INPUT_EXTS = VIDEO_FORMATS.filter(
  (f) => f.input,
).map((f) => f.ext);
