import {
  SUPPORTED_AUDIO_INPUT_EXTS,
  SUPPORTED_VIDEO_INPUT_EXTS,
} from "@/media/formats";
import { getExt } from "@/lib/utils";

export const MAX_AUDIO_BYTES = 1024 * 1024 * 1024; // 1 GB
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
export const WARN_AUDIO_BYTES = 50 * 1024 * 1024;
export const WARN_VIDEO_BYTES = 100 * 1024 * 1024;

export interface ValidationResult {
  ok: boolean;
  error?: string;
  warning?: string;
}

export function validateFile(
  file: File,
  kind: "audio" | "video" | "any",
): ValidationResult {
  if (!file || file.size === 0)
    return { ok: false, error: "File is empty or unreadable." };
  const ext = getExt(file.name);
  const max = kind === "audio" ? MAX_AUDIO_BYTES : MAX_VIDEO_BYTES;
  const warn = kind === "audio" ? WARN_AUDIO_BYTES : WARN_VIDEO_BYTES;
  const mb = (file.size / 1024 / 1024).toFixed(1);
  if (file.size > max) {
    return {
      ok: false,
      error: `File too large (${mb} MB). Limit is ${max / 1024 / 1024 / 1024} GB for ${kind}. Try a smaller file or trim it first.`,
    };
  }
  const supported =
    kind === "audio"
      ? SUPPORTED_AUDIO_INPUT_EXTS
      : kind === "video"
        ? SUPPORTED_VIDEO_INPUT_EXTS
        : [...SUPPORTED_AUDIO_INPUT_EXTS, ...SUPPORTED_VIDEO_INPUT_EXTS];
  const looksLikeMedia =
    file.type.startsWith("audio/") || file.type.startsWith("video/");
  const knownExt = !!ext && supported.includes(ext);
  if (ext && !knownExt && !looksLikeMedia) {
    const list = Array.from(new Set(supported)).join(", ");
    return {
      ok: false,
      error: `".${ext}" is not a supported ${kind === "any" ? "media" : kind} file here. Try: ${list}.`,
    };
  }
  const warnings: string[] = [];
  if (ext && !knownExt) {
    warnings.push(
      `Unusual extension .${ext}. We will validate the actual content; if the codec is unsupported you will get an error rather than a broken file.`,
    );
  }
  if (file.size > warn) {
    warnings.push(
      `Large file (${mb} MB) may be slow or run out of memory on mobile. Close other tabs for best results.`,
    );
  }
  return warnings.length
    ? { ok: true, warning: warnings.join(" ") }
    : { ok: true };
}

export function downloadBlob(blob: Blob, filename: string): boolean {
  let url: string | null = null;
  try {
    url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  } finally {
    if (url) setTimeout(() => URL.revokeObjectURL(url as string), 2000);
  }
}
