// Copies the FFmpeg WASM core and the ffmpeg.wasm worker into /public so the
// application serves processing assets from its own origin (no third-party CDN).
// Runs automatically before `dev` and `build`. The assets are generated, not committed.
//
// The wasm (~31 MB) is split into parts below 25 MiB, the per-file limit of
// Cloudflare Pages. Parts keep a .wasm extension so hosts serve them as
// application/wasm (and compress them). src/media/ffmpeg/loader.ts joins them.
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PART_BYTES = 20 * 1024 * 1024;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const coreSrc = resolve(root, "node_modules/@ffmpeg/core/dist/esm");
const ffmpegSrc = resolve(root, "node_modules/@ffmpeg/ffmpeg/dist/esm");
const outDir = resolve(root, "public/ffmpeg");
const coreDir = resolve(outDir, "core");
const workerDir = resolve(outDir, "worker");

if (!existsSync(coreSrc)) {
  console.error("[copy-ffmpeg] @ffmpeg/core is not installed. Run npm install first.");
  process.exit(1);
}
rmSync(outDir, { recursive: true, force: true });
mkdirSync(coreDir, { recursive: true });
mkdirSync(workerDir, { recursive: true });

cpSync(resolve(coreSrc, "ffmpeg-core.js"), resolve(coreDir, "ffmpeg-core.js"));
for (const f of ["worker.js", "const.js", "errors.js"]) {
  cpSync(resolve(ffmpegSrc, f), resolve(workerDir, f));
}

const wasm = readFileSync(resolve(coreSrc, "ffmpeg-core.wasm"));
const wasmParts = [];
for (let i = 0, offset = 0; offset < wasm.length; i++, offset += PART_BYTES) {
  const name = `ffmpeg-core.${i}.wasm`;
  writeFileSync(resolve(coreDir, name), wasm.subarray(offset, offset + PART_BYTES));
  wasmParts.push(`/ffmpeg/core/${name}`);
}

const manifest = {
  core: "/ffmpeg/core/ffmpeg-core.js",
  worker: "/ffmpeg/worker/worker.js",
  wasmParts,
  wasmSize: wasm.length,
};
writeFileSync(resolve(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`[copy-ffmpeg] Copied FFmpeg core (wasm in ${wasmParts.length} parts, ${wasm.length} bytes) and worker into public/ffmpeg/`);
