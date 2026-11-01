// Fetches the Noto fonts that burn captions and text in scripts Atkinson Hyperlegible doesn't cover.
// Runs before `dev` and `build`, like fetch-models.mjs. Downloads are pinned to a commit, cached in
// .cache/fonts and copied to /public/fonts, so the browser loads them from this site only, and only
// when the text needs them (see src/media/captions/fonts.ts).
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cache = resolve(root, ".cache/fonts");
const out = resolve(root, "public/fonts");

const GOOGLE = "https://raw.githubusercontent.com/google/fonts/6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl";
const CJK = "https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/SubsetOTF";
const FONTS = [
  ["NotoSans.ttf", `${GOOGLE}/notosans/NotoSans%5Bwdth,wght%5D.ttf`],
  ["NotoSansBengali.ttf", `${GOOGLE}/notosansbengali/NotoSansBengali%5Bwdth,wght%5D.ttf`],
  ["NotoSansDevanagari.ttf", `${GOOGLE}/notosansdevanagari/NotoSansDevanagari%5Bwdth,wght%5D.ttf`],
  ["NotoSansArabic.ttf", `${GOOGLE}/notosansarabic/NotoSansArabic%5Bwdth,wght%5D.ttf`],
  ["NotoSansJP-Bold.otf", `${CJK}/JP/NotoSansJP-Bold.otf`],
  ["NotoSansKR-Bold.otf", `${CJK}/KR/NotoSansKR-Bold.otf`],
  ["NotoSansSC-Bold.otf", `${CJK}/SC/NotoSansSC-Bold.otf`],
  ["OFL-Noto.txt", `${GOOGLE}/notosans/OFL.txt`],
];

mkdirSync(cache, { recursive: true });
mkdirSync(out, { recursive: true });
let bytes = 0;
for (const [name, url] of FONTS) {
  const file = resolve(cache, name);
  if (!existsSync(file)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`[fetch-fonts] ${res.status} for ${url}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  copyFileSync(file, resolve(out, name));
  bytes += statSync(file).size;
}
console.log(`[fetch-fonts] ${FONTS.length - 1} fonts ready (${(bytes / 1e6).toFixed(1)} MB)`);
