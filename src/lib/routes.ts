import type { IconName } from "@/components/desk/icons";
import type { Recipe } from "@/lib/registry";

export interface DeskRouteDef {
  slug: string;
  tool: string;
  label: string;
  icon: IconName;
  defaults?: Partial<Recipe>;
}

export const DESK_ROUTES: DeskRouteDef[] = [
  {
    slug: "audio-converter",
    tool: "audio/export",
    label: "Convert audio",
    icon: "swap",
  },
  {
    slug: "mp3-cutter",
    tool: "audio/export",
    label: "Cut MP3",
    icon: "cut",
    defaults: { format: "mp3" },
  },
  {
    slug: "audio-trimmer",
    tool: "audio/export",
    label: "Trim audio",
    icon: "cut",
  },
  {
    slug: "wav-to-mp3",
    tool: "audio/export",
    label: "WAV → MP3",
    icon: "shrink",
    defaults: { format: "mp3", bitrate: 192 },
  },
  {
    slug: "ogg-converter",
    tool: "audio/export",
    label: "Convert to OGG",
    icon: "swap",
    defaults: { format: "ogg" },
  },
  {
    slug: "compress-video",
    tool: "video/export",
    label: "Compress video",
    icon: "squeeze",
    defaults: { squeeze: "custom", sharpness: 50 },
  },
  {
    slug: "compress-mp4",
    tool: "video/export",
    label: "Compress MP4",
    icon: "squeeze",
    defaults: { squeeze: "custom", sharpness: 50, videoFormat: "mp4" },
  },
  {
    slug: "reduce-video-size",
    tool: "video/export",
    label: "Shrink to share",
    icon: "plane",
    defaults: { squeeze: "chat", size: "720p" },
  },
  {
    slug: "resize-video",
    tool: "video/export",
    label: "Resize video",
    icon: "resize",
    defaults: { size: "720p", squeeze: "custom", sharpness: 60 },
  },
  {
    slug: "trim-video",
    tool: "video/export",
    label: "Trim video",
    icon: "cut",
    defaults: { squeeze: "custom", sharpness: 60 },
  },
];

export const getDeskRoute = (slug: string) =>
  DESK_ROUTES.find((r) => r.slug === slug)!;
