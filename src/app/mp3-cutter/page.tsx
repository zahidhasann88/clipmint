import type { Metadata } from "next";
import { DeskScreen } from "@/components/desk/desk-screen";
import { getDeskRoute } from "@/lib/routes";

export const metadata: Metadata = {
  title: "MP3 Cutter — Cut MP3 Online Without Uploading",
  description: "Cut MP3 and other audio files in your browser. Waveform selection, segment preview, exact start/end times. Local FFmpeg re-encode, no upload.",
  alternates: { canonical: "/mp3-cutter" },
  openGraph: { images: [{ url: "/og.png", width: 1200, height: 630, alt: "Clipmint — audio and video tools that run in your browser" }], title: "MP3 Cutter — Cut MP3 Online Without Uploading", description: "Cut MP3 and other audio files in your browser. Waveform selection, segment preview, exact start/end times. Local FFmpeg re-encode, no upload.", url: "/mp3-cutter" },
};

export default function Page() {
  const route = getDeskRoute("mp3-cutter");
  return <DeskScreen tool={route.tool} defaults={route.defaults} label={route.label} icon={route.icon} />;
}
