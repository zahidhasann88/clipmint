import type { Capabilities } from "@/lib/capabilities";

const LIMIT = { audio: 50e6, video: 100e6 };
const GIF_SECONDS = 15;
const BATCH_FILES = 5;

export function memoryNote(
  caps: Capabilities | null,
  job: {
    engine: "audio" | "video" | null;
    totalBytes: number;
    count: number;
    gifSeconds?: number | null;
  },
): string | null {
  if (!caps || !job.engine) return null;
  const low =
    caps.deviceMemoryGb != null ? caps.deviceMemoryGb <= 4 : caps.mobile;
  if (!low) return null;
  const tooBig = job.totalBytes > LIMIT[job.engine];
  const longGif = job.gifSeconds != null && job.gifSeconds > GIF_SECONDS;
  const many = job.count > BATCH_FILES;
  if (!tooBig && !longGif && !many) return null;
  const where =
    caps.deviceMemoryGb != null
      ? `This device has about ${caps.deviceMemoryGb} GB of memory`
      : "Phones have little memory";
  const tip = longGif
    ? `keep GIFs under ${GIF_SECONDS} s`
    : many
      ? `brew ${BATCH_FILES} files or fewer at a time`
      : `keep it under ${LIMIT[job.engine] / 1e6} MB`;
  return `${where}: ${tip}, or it may stop halfway.`;
}
