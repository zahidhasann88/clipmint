import type { Metadata } from "next";
import { DeskScreen } from "@/components/desk/desk-screen";
import { getDeskRoute } from "@/lib/routes";

export const metadata: Metadata = {
  title: "WAV to MP3 Converter — Free & Local",
  description: "Convert WAV to MP3 at 96–320 kbps in your browser. Real libmp3lame encoding via FFmpeg WebAssembly. Optional trim, no upload, no signup.",
  alternates: { canonical: "/wav-to-mp3" },
  openGraph: { images: [{ url: "/og.png", width: 1200, height: 630, alt: "Clipmint — audio and video tools that run in your browser" }], title: "WAV to MP3 Converter — Free & Local", description: "Convert WAV to MP3 at 96–320 kbps in your browser. Real libmp3lame encoding via FFmpeg WebAssembly. Optional trim, no upload, no signup.", url: "/wav-to-mp3" },
};

export default function Page() {
  const route = getDeskRoute("wav-to-mp3");
  return <DeskScreen tool={route.tool} defaults={route.defaults} label={route.label} icon={route.icon} />;
}
