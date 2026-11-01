import type { Metadata } from "next";
import { DeskScreen } from "@/components/desk/desk-screen";
import { getDeskRoute } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Trim Video Online — Cut Clips Locally",
  description: "Trim MP4, WebM, MOV and MKV videos with start/end controls and selection preview. Audio stays in sync. Local re-encode, no upload.",
  alternates: { canonical: "/trim-video" },
  openGraph: { images: [{ url: "/og.png", width: 1200, height: 630, alt: "Clipmint — audio and video tools that run in your browser" }], title: "Trim Video Online — Cut Clips Locally", description: "Trim MP4, WebM, MOV and MKV videos with start/end controls and selection preview. Audio stays in sync. Local re-encode, no upload.", url: "/trim-video" },
};

export default function Page() {
  const route = getDeskRoute("trim-video");
  return <DeskScreen tool={route.tool} defaults={route.defaults} label={route.label} icon={route.icon} />;
}
