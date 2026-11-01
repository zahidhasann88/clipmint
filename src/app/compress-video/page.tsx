import type { Metadata } from "next";
import { DeskScreen } from "@/components/desk/desk-screen";
import { getDeskRoute } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Compress Video Online — Private, Local FFmpeg",
  description: "Compress MP4 and WebM video in your browser with quality presets, resolution caps and audio removal. No uploads; real H.264 encoding to MP4.",
  alternates: { canonical: "/compress-video" },
  openGraph: { images: [{ url: "/og.png", width: 1200, height: 630, alt: "Clipmint — audio and video tools that run in your browser" }], title: "Compress Video Online — Private, Local FFmpeg", description: "Compress MP4 and WebM video in your browser with quality presets, resolution caps and audio removal. No uploads; real H.264 encoding to MP4.", url: "/compress-video" },
};

export default function Page() {
  const route = getDeskRoute("compress-video");
  return <DeskScreen tool={route.tool} defaults={route.defaults} label={route.label} icon={route.icon} />;
}
