export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://clipmint.pages.dev"
).replace(/\/+$/, "");
export const SITE_NAME = "Clipmint";
export const SITE_TAGLINE =
  "Audio and video tools that run in your browser. Your files never leave your device.";
export const SITE_DESCRIPTION =
  "Free, open-source audio and video tools that run entirely in your browser. Convert, trim, compress and resize media locally — no uploads, no accounts, no tracking.";
export const SOURCE_URL = (
  process.env.NEXT_PUBLIC_SOURCE_URL ??
  "https://github.com/zahidhasann88/clipmint"
).replace(/\/+$/, "");
