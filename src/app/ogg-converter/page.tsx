import type { Metadata } from "next";
import { DeskScreen } from "@/components/desk/desk-screen";
import { getDeskRoute } from "@/lib/routes";

export const metadata: Metadata = {
  title: "OGG Converter — Convert to OGG Vorbis or Opus",
  description: "Convert audio to OGG Vorbis or Opus, or convert OGG to MP3/WAV. Runs locally with FFmpeg WASM. Honest codec support, no servers.",
  alternates: { canonical: "/ogg-converter" },
  openGraph: { images: [{ url: "/og.png", width: 1200, height: 630, alt: "Clipmint — audio and video tools that run in your browser" }], title: "OGG Converter — Convert to OGG Vorbis or Opus", description: "Convert audio to OGG Vorbis or Opus, or convert OGG to MP3/WAV. Runs locally with FFmpeg WASM. Honest codec support, no servers.", url: "/ogg-converter" },
};

export default function Page() {
  const route = getDeskRoute("ogg-converter");
  return <DeskScreen tool={route.tool} defaults={route.defaults} label={route.label} icon={route.icon} />;
}
