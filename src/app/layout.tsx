import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { DeskProvider } from "@/components/desk/desk-state";
import { Room } from "@/components/desk/room";
import { GlobalDrop } from "@/components/desk/global-drop";
import { ScrollActivity } from "@/components/desk/scroll-activity";
import { themeScript } from "@/components/desk/lamp";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

const display = localFont({
  src: "./fonts/bricolage-700-800.woff2",
  weight: "700 800",
  variable: "--nf-display",
  display: "swap",
});
const ui = localFont({
  src: "./fonts/nunito-700-800.woff2",
  weight: "700 800",
  variable: "--nf-ui",
  display: "swap",
});
const hand = localFont({
  src: "./fonts/caveat-700.woff2",
  weight: "700",
  variable: "--nf-hand",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Private Audio & Video Tools`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Clipmint contributors" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Private Audio & Video Tools`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Clipmint — audio and video tools that run in your browser",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Private Audio & Video Tools`,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F3EA" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1915" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${ui.variable} ${hand.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only rounded-xl focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:bg-paper focus:px-4 focus:py-2 focus:font-extrabold"
        >
          Skip to content
        </a>
        <DeskProvider>
          <GlobalDrop />
          <ScrollActivity />
          <Room>{children}</Room>
        </DeskProvider>
      </body>
    </html>
  );
}
