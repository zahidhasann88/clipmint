import type { Metadata } from "next";
import { DeskScreen } from "@/components/desk/desk-screen";
import { getDeskRoute } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Resize Video — 1080p, 720p, 480p Locally",
  description: "Resize video to 1080p, 720p or 480p while preserving aspect ratio, including portrait video. Local FFmpeg WASM encoding to MP4.",
  alternates: { canonical: "/resize-video" },
  openGraph: { images: [{ url: "/og.png", width: 1200, height: 630, alt: "Clipmint — audio and video tools that run in your browser" }], title: "Resize Video — 1080p, 720p, 480p Locally", description: "Resize video to 1080p, 720p or 480p while preserving aspect ratio, including portrait video. Local FFmpeg WASM encoding to MP4.", url: "/resize-video" },
};

export default function Page() {
  const route = getDeskRoute("resize-video");
  return <DeskScreen tool={route.tool} defaults={route.defaults} label={route.label} icon={route.icon} />;
}
