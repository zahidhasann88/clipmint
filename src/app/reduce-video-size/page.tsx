import type { Metadata } from "next";
import { DeskScreen } from "@/components/desk/desk-screen";
import { getDeskRoute } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Reduce Video Size — Honest, Local Compression",
  description: "Make videos smaller for sharing with stronger compression and optional resolution limits. We show actual output size — no guaranteed percentages.",
  alternates: { canonical: "/reduce-video-size" },
  openGraph: { images: [{ url: "/og.png", width: 1200, height: 630, alt: "Clipmint — audio and video tools that run in your browser" }], title: "Reduce Video Size — Honest, Local Compression", description: "Make videos smaller for sharing with stronger compression and optional resolution limits. We show actual output size — no guaranteed percentages.", url: "/reduce-video-size" },
};

export default function Page() {
  const route = getDeskRoute("reduce-video-size");
  return <DeskScreen tool={route.tool} defaults={route.defaults} label={route.label} icon={route.icon} />;
}
