import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import { fileURLToPath } from "node:url";

const transformersWeb = fileURLToPath(new URL("./node_modules/@huggingface/transformers/dist/transformers.web.js", import.meta.url));

/** @type {(phase: string) => import('next').NextConfig} */
const nextConfig = (phase) => ({
  // Static export: every route is prerendered to HTML in ./out, so the site runs on
  // any static host (Cloudflare Pages). There is no server, API route or upload endpoint.
  // Response headers (security, caching) live in public/_headers.
  output: "export",
  // `next dev` uses its own folder so `npm run build` can run while the dev server is open.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    // Speech recognition (transformers.js) only ever runs in a Web Worker in the browser:
    // use its browser build, and leave it out of the server (prerender) build entirely.
    config.resolve.alias = { ...config.resolve.alias, "@huggingface/transformers": isServer ? false : transformersWeb };
    // ONNX Runtime points at its .wasm files with `new URL(..., import.meta.url)`. Don't let webpack
    // bundle them (one is over Cloudflare's 25 MiB limit); the app serves them itself from /ort.
    config.module.rules.push({
      test: /[\\/]node_modules[\\/](onnxruntime-web|@huggingface[\\/]transformers)[\\/]/,
      parser: { url: false },
    });
    return config;
  },
});
export default nextConfig;
