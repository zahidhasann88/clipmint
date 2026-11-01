import type { Metadata } from "next";
import { DeskScreen } from "@/components/desk/desk-screen";
import { JsonLd } from "@/components/json-ld";
import { SITE_URL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME} — Private Audio & Video Tools in Your Browser`,
  },
  description:
    "Convert and trim audio, compress, resize and trim video entirely in your browser. Free and open source. Files never leave your device — no uploads, no accounts.",
  alternates: { canonical: "/" },
};

const appLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any modern browser",
  browserRequirements:
    "Requires WebAssembly SIMD. Chrome/Edge 91+, Firefox 114+, Safari 16.4+.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  license: "https://opensource.org/license/mit",
  isAccessibleForFree: true,
};

export default function Home() {
  return (
    <>
      <DeskScreen />
      <JsonLd data={appLd} />
    </>
  );
}
