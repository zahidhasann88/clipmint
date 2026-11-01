import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { ALL_INPUT_EXTS } from "@/lib/registry";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — private audio & video tools`,
    short_name: SITE_NAME,
    description: SITE_TAGLINE,
    start_url: "/",
    display: "standalone",
    background_color: "#F8F3EA",
    theme_color: "#2F5D3F",
    // Installed, Clipmint shows up in the phone's share sheet: public/sw.js receives the files.
    // (Next's Manifest type predates shared files, hence the cast.)
    ...({
      share_target: {
        action: "/share-target",
        method: "POST",
        enctype: "multipart/form-data",
        params: {
          files: [
            {
              name: "media",
              accept: [
                "audio/*",
                "video/*",
                ...ALL_INPUT_EXTS.map((e) => `.${e}`),
              ],
            },
          ],
        },
      },
    } as unknown as Partial<MetadataRoute.Manifest>),
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
