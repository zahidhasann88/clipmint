// Fetches the captions models (Whisper tiny, and base for "better accuracy", ONNX) and the ONNX
// Runtime WebAssembly files into /public so speech recognition loads from this site only. Runs
// before `dev` and `build`. Base is optional: set CLIPMINT_SPEECH_MODELS=tiny to leave it out.
// /public/models/speech.json lists the models served, so the app only offers those.
// Downloads are cached in .cache/models; files over 24 MiB are split into parts (Cloudflare Pages
// serves at most 25 MiB per file) and listed in /public/models/parts.json for the browser to rejoin.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = resolve(root, ".cache/models");
const PART = 24 * 1024 * 1024;

// Whisper (multilingual). Each repo is pinned to its current revision so builds are reproducible.
const WANTED = (process.env.CLIPMINT_SPEECH_MODELS || "tiny,base").split(",").map((m) => m.trim());
const MODELS = [
  // The _timestamped exports add the cross-attentions that word timings need.
  { name: "tiny", repo: "onnx-community/whisper-tiny_timestamped", required: true },
  { name: "base", repo: "onnx-community/whisper-base_timestamped", required: false },
].filter((m) => m.required || WANTED.includes(m.name));
const MODEL_FILES = [
  "config.json", "generation_config.json", "preprocessor_config.json", "tokenizer.json", "tokenizer_config.json",
  "onnx/encoder_model_quantized.onnx", "onnx/decoder_model_merged_quantized.onnx", // CPU (WebAssembly), int8
  "onnx/encoder_model_fp16.onnx", "onnx/decoder_model_merged_fp16.onnx",           // WebGPU, half precision
];
const ORT_FILES = ["ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"];

const parts = {};

/** Copies `src` to public/<rel>, splitting it when it is too big for one file. */
function publish(src, rel) {
  const dest = resolve(root, "public", rel);
  mkdirSync(dirname(dest), { recursive: true });
  for (const old of readdirSync(dirname(dest)).filter((n) => n.startsWith(`${rel.split("/").pop()}.part`))) rmSync(join(dirname(dest), old));
  const size = statSync(src).size;
  if (size <= PART) { copyFileSync(src, dest); return; }
  if (existsSync(dest)) rmSync(dest);
  const buf = readFileSync(src);
  const names = [];
  for (let i = 0, n = 0; i < size; i += PART, n++) {
    const name = `${rel}.part${n}`;
    writeFileSync(resolve(root, "public", name), buf.subarray(i, i + PART));
    names.push(`/${name}`);
  }
  parts[`/${rel}`] = { size, parts: names, sha256: createHash("sha256").update(buf).digest("hex") };
}

async function download(url, to) {
  if (existsSync(to)) return;
  mkdirSync(dirname(to), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[fetch-models] ${res.status} for ${url}`);
  writeFileSync(to, Buffer.from(await res.arrayBuffer()));
  console.log(`[fetch-models] downloaded ${url.split("/").slice(-2).join("/")} (${(statSync(to).size / 1e6).toFixed(1)} MB)`);
}

const served = [];
for (const m of MODELS) {
  let sha = "main";
  try {
    const info = await (await fetch(`https://huggingface.co/api/models/${m.repo}`)).json();
    sha = info.sha || "main";
  } catch { /* offline: use whatever is cached */ }
  const modelCache = resolve(cacheDir, m.repo.replace("/", "__"));
  try {
    for (const f of MODEL_FILES) await download(`https://huggingface.co/${m.repo}/resolve/${sha}/${f}`, resolve(modelCache, f));
  } catch (e) {
    if (!MODEL_FILES.every((f) => existsSync(resolve(modelCache, f)))) {
      console.warn(`${e.message}\n[fetch-models] Whisper ${m.name} unavailable (offline?).${m.required ? " Captions will show an error until it is fetched." : " It won't be offered."}`);
      continue;
    }
  }
  for (const f of MODEL_FILES) publish(resolve(modelCache, f), `models/whisper-${m.name}/${f}`);
  served.push(m.name);
  console.log(`[fetch-models] Whisper ${m.name} @ ${sha.slice(0, 10)}`);
}
// A model left out of this build must not linger from an earlier one.
for (const m of ["base"]) if (!served.includes(m)) rmSync(resolve(root, `public/models/whisper-${m}`), { recursive: true, force: true });
writeFileSync(resolve(root, "public/models/speech.json"), JSON.stringify({ models: served }));

const ortDir = resolve(root, "node_modules/onnxruntime-web/dist");
for (const f of ORT_FILES) publish(resolve(ortDir, f), `ort/${f}`);

writeFileSync(resolve(root, "public/models/parts.json"), JSON.stringify(parts, null, 1));
console.log(`[fetch-models] ${served.join(" + ")} + ONNX Runtime ready (${Object.keys(parts).length} split files)`);
