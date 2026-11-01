import type { Metadata } from "next";
import { DeskScreen } from "@/components/desk/desk-screen";
import { getDeskRoute } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Compress MP4 — Reduce MP4 Size Locally",
  description: "Compress MP4 files to H.264/AAC in your browser. Balanced or smaller presets, optional 1080p/720p/480p output. Fully local, no upload.",
  alternates: { canonical: "/compress-mp4" },
  openGraph: { images: [{ url: "/og.png", width: 1200, height: 630, alt: "Clipmint — audio and video tools that run in your browser" }], title: "Compress MP4 — Reduce MP4 Size Locally", description: "Compress MP4 files to H.264/AAC in your browser. Balanced or smaller presets, optional 1080p/720p/480p output. Fully local, no upload.", url: "/compress-mp4" },
};

export default function Page() {
  const route = getDeskRoute("compress-mp4");
  return <DeskScreen tool={route.tool} defaults={route.defaults} label={route.label} icon={route.icon} />;
}
