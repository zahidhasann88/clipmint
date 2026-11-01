export interface CodecInfo {
  container: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  sampleRate?: number | null;
  channels?: number | null;
}

const MP3_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
};

export function readAudioFormat(b: Uint8Array): {
  sampleRate: number | null;
  channels: number | null;
} {
  const none = { sampleRate: null, channels: null };
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = (o: number, s: string) =>
    s.split("").every((c, i) => b[o + i] === c.charCodeAt(0));
  try {
    if (tag(0, "RIFF") && tag(8, "WAVE")) {
      for (let o = 12; o + 8 <= b.length; ) {
        const size = view.getUint32(o + 4, true);
        if (tag(o, "fmt "))
          return {
            channels: view.getUint16(o + 10, true),
            sampleRate: view.getUint32(o + 12, true),
          };
        o += 8 + size + (size % 2);
      }
      return none;
    }
    if (tag(0, "fLaC")) {
      return {
        sampleRate: (b[18] << 12) | (b[19] << 4) | (b[20] >> 4),
        channels: ((b[20] >> 1) & 7) + 1,
      };
    }
    if (tag(0, "OggS")) {
      const p = 27 + b[26];
      if (b[p] === 1 && tag(p + 1, "vorbis"))
        return {
          channels: b[p + 11],
          sampleRate: view.getUint32(p + 12, true),
        };
      if (tag(p, "OpusHead")) return { channels: b[p + 9], sampleRate: 48000 };
      return none;
    }
    let i = tag(0, "ID3")
      ? 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9])
      : 0;
    const limit = Math.min(b.length - 3, i + 64 * 1024);
    for (; i < limit; i++) {
      if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) continue;
      const version = (b[i + 1] >> 3) & 3,
        layer = (b[i + 1] >> 1) & 3,
        rateIdx = (b[i + 2] >> 2) & 3;
      if (version === 1 || layer === 0 || rateIdx === 3) continue;
      return {
        sampleRate: MP3_RATES[version][rateIdx],
        channels: b[i + 3] >> 6 === 3 ? 1 : 2,
      };
    }
  } catch {
    /* truncated header */
  }
  return none;
}

const MP4_FOURCC: Record<string, string> = {
  avc1: "H.264 (avc1)",
  avc3: "H.264",
  hev1: "H.265/HEVC",
  hvc1: "H.265/HEVC",
  vp08: "VP8",
  vp09: "VP9",
  av01: "AV1",
  mp4v: "MPEG-4 Visual",
  mp4a: "AAC",
  "ac-3": "AC-3",
  ec3: "E-AC-3",
  alac: "ALAC",
  Opus: "Opus",
};
const WEBM_CODEC: Record<string, string> = {
  V_VP8: "VP8",
  V_VP9: "VP9",
  V_AV1: "AV1",
  A_OPUS: "Opus",
  A_VORBIS: "Vorbis",
  A_AAC: "AAC",
};

function latin1(buf: Uint8Array): string {
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return s;
}

export async function detectCodecs(file: File): Promise<CodecInfo> {
  const slice = file.slice(0, Math.min(file.size, 4 * 1024 * 1024));
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await slice.arrayBuffer());
  } catch {
    return { container: null, videoCodec: null, audioCodec: null };
  }

  const head = latin1(bytes.subarray(0, Math.min(bytes.length, 64)));
  const isMp4 = head.includes("ftyp");
  const isWebm =
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3;
  const isRiff = head.startsWith("RIFF");
  const isOgg = head.startsWith("OggS");
  const isMp3 =
    head.startsWith("ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);

  const fmt = readAudioFormat(bytes);
  if (isRiff)
    return {
      container: "WAV (RIFF)",
      videoCodec: null,
      audioCodec: "PCM",
      ...fmt,
    };
  if (isOgg)
    return {
      container: "OGG",
      videoCodec: null,
      audioCodec: head.includes("OpusHead")
        ? "Opus"
        : head.includes("vorbis")
          ? "Vorbis"
          : "Vorbis/Opus",
      ...fmt,
    };
  if (head.startsWith("fLaC"))
    return { container: "FLAC", videoCodec: null, audioCodec: "FLAC", ...fmt };
  if (isMp3)
    return {
      container: "MPEG audio",
      videoCodec: null,
      audioCodec: "MP3",
      ...fmt,
    };

  const text = latin1(bytes);
  let videoCodec: string | null = null;
  let audioCodec: string | null = null;

  const pickMp4 = (fourcc: string) => {
    const label = MP4_FOURCC[fourcc];
    if (!label) return;
    const isVideo = [
      "avc1",
      "avc3",
      "hev1",
      "hvc1",
      "vp08",
      "vp09",
      "av01",
      "mp4v",
    ].includes(fourcc);
    if (isVideo && !videoCodec) videoCodec = label;
    if (!isVideo && !audioCodec) audioCodec = label;
  };
  if (isMp4) {
    for (const fourcc of Object.keys(MP4_FOURCC)) {
      if (text.includes(`stsd`) && text.includes(fourcc)) pickMp4(fourcc);
    }
  }
  if (isWebm) {
    for (const [id, label] of Object.entries(WEBM_CODEC)) {
      if (!text.includes(id)) continue;
      if (id.startsWith("V_") && !videoCodec) videoCodec = label;
      if (id.startsWith("A_") && !audioCodec) audioCodec = label;
    }
  }
  const container = isMp4
    ? head.includes("isom") || head.includes("mp4")
      ? "MP4 (ISO BMFF)"
      : "MOV/ISO BMFF"
    : isWebm
      ? "WebM (Matroska)"
      : null;
  return { container, videoCodec, audioCodec };
}
