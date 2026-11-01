// Copies the MediaPipe vision runtime (WebAssembly) into /public so face tracking loads
// from this site only. Runs before `dev` and `build`; the copies are generated, not committed.
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const from = resolve(root, "node_modules/@mediapipe/tasks-vision/wasm");
const to = resolve(root, "public/mediapipe");
mkdirSync(to, { recursive: true });
// The app requires WebAssembly SIMD, so MediaPipe's fallback build can never load.
for (const name of readdirSync(from).filter((n) => !n.includes("nosimd"))) {
  const size = statSync(join(from, name)).size;
  if (size > 25 * 1024 * 1024) throw new Error(`[copy-models] ${name} is over Cloudflare's 25 MiB file limit`);
  copyFileSync(join(from, name), join(to, name));
}
console.log(`[copy-models] MediaPipe runtime → public/mediapipe (${readdirSync(to).length} files)`);
