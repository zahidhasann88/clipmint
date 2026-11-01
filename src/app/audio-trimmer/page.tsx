import type { Metadata } from "next";
import { DeskScreen } from "@/components/desk/desk-screen";
import { getDeskRoute } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Audio Trimmer — Trim Audio Online, Locally",
  description: "Trim MP3, WAV and OGG audio with a waveform timeline and numeric controls. Preview the selection and export lossless WAV or compressed MP3.",
  alternates: { canonical: "/audio-trimmer" },
  openGraph: { images: [{ url: "/og.png", width: 1200, height: 630, alt: "Clipmint — audio and video tools that run in your browser" }], title: "Audio Trimmer — Trim Audio Online, Locally", description: "Trim MP3, WAV and OGG audio with a waveform timeline and numeric controls. Preview the selection and export lossless WAV or compressed MP3.", url: "/audio-trimmer" },
};

export default function Page() {
  const route = getDeskRoute("audio-trimmer");
  return <DeskScreen tool={route.tool} defaults={route.defaults} label={route.label} icon={route.icon} />;
}
