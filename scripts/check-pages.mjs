// Verifies the static export in ./out against Cloudflare Pages limits and checks
// that every route and the FFmpeg assets are present. Runs after `npm run build`.
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { resolve, relative, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // Cloudflare Pages per-file limit
const MAX_FILES = 20000; // Cloudflare Pages file-count limit (free plan)

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "out");
const errors = [];

if (!existsSync(out)) {
  console.error("[check-pages] ./out not found. Run `npm run build` first.");
  process.exit(1);
}

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(out);

for (const f of files) {
  const size = statSync(f).size;
  if (size > MAX_FILE_BYTES) errors.push(`${relative(out, f)} is ${(size / 1048576).toFixed(1)} MiB (limit 25 MiB)`);
}
if (files.length > MAX_FILES) errors.push(`${files.length} files (limit ${MAX_FILES})`);

const routes = [
  "index", "about", "privacy", "404",
  "audio-converter", "mp3-cutter", "audio-trimmer", "wav-to-mp3", "ogg-converter",
  "compress-video", "compress-mp4", "reduce-video-size", "resize-video", "trim-video",
];
for (const r of routes) if (!existsSync(resolve(out, `${r}.html`))) errors.push(`missing route ${r}.html`);
for (const f of ["sitemap.xml", "robots.txt", "_headers", "ffmpeg/manifest.json", "ffmpeg/core/ffmpeg-core.js", "ffmpeg/worker/worker.js",
  "mediapipe/vision_wasm_internal.wasm", "models/face/blaze_face_short_range.tflite", "models/rnnoise/sh.rnnn", "models/silero-vad/onnx/model.onnx"]) {
  if (!existsSync(resolve(out, f))) errors.push(`missing ${f}`);
}

const manifestPath = resolve(out, "ffmpeg/manifest.json");
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  let total = 0;
  for (const part of manifest.wasmParts) {
    const p = resolve(out, part.replace(/^\//, ""));
    if (!existsSync(p)) errors.push(`missing wasm part ${part}`);
    else total += statSync(p).size;
  }
  if (total !== manifest.wasmSize) errors.push(`wasm parts total ${total} bytes, manifest expects ${manifest.wasmSize}`);
}

if (errors.length) {
  console.error("[check-pages] Static export is NOT ready for Cloudflare Pages:\n  - " + errors.join("\n  - "));
  process.exit(1);
}
const largest = Math.max(...files.map((f) => statSync(f).size));
console.log(`[check-pages] OK: ${files.length} files, largest ${(largest / 1048576).toFixed(1)} MiB, all ${routes.length} routes present.`);
