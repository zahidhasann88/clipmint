import type { Metadata } from "next";
import { DeskScreen } from "@/components/desk/desk-screen";
import { getDeskRoute } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Audio Converter — Convert MP3, WAV, OGG & More Locally",
  description: "Free browser audio converter. Convert MP3, WAV, OGG, Opus, M4A and AAC locally with FFmpeg WebAssembly — no uploads, no registration.",
  alternates: { canonical: "/audio-converter" },
  openGraph: { images: [{ url: "/og.png", width: 1200, height: 630, alt: "Clipmint — audio and video tools that run in your browser" }], title: "Audio Converter — Convert MP3, WAV, OGG & More Locally", description: "Free browser audio converter. Convert MP3, WAV, OGG, Opus, M4A and AAC locally with FFmpeg WebAssembly — no uploads, no registration.", url: "/audio-converter" },
};

export default function Page() {
  const route = getDeskRoute("audio-converter");
  return <DeskScreen tool={route.tool} defaults={route.defaults} label={route.label} icon={route.icon} />;
}
