# Technical reference

Formats, browser support, limits, build and deploy, troubleshooting and license notes for Clipmint.
How the code fits together is in [ARCHITECTURE.md](ARCHITECTURE.md).

## FFmpeg build

Packages: `@ffmpeg/ffmpeg@0.12.10` + `@ffmpeg/core@0.12.10` (single-threaded). Configure line read from
the wasm itself:

```
--enable-gpl --enable-libx264 --enable-libx265 --enable-libvpx --enable-libmp3lame --enable-libtheora
--enable-libvorbis --enable-libopus --enable-zlib --enable-libwebp --enable-libzimg --disable-pthreads
-msimd128
```

- Single-threaded: no `SharedArrayBuffer`, so no COOP/COEP headers are needed.
- Built with `-msimd128`: the browser must support WebAssembly SIMD.
- The wasm is 32,232,419 bytes. `scripts/copy-ffmpeg.mjs` splits it into parts under 25 MiB (the
  Cloudflare Pages per-file limit), and `src/media/ffmpeg/loader.ts` joins them in the browser.
- It is downloaded only when the first job starts, then cached by the browser.

## Supported formats

### Audio

| Format | Input | Output | Encoder / notes |
|---|---|---|---|
| MP3 | ✅ | ✅ | libmp3lame, 96–320 kbps |
| WAV | ✅ | ✅ | PCM 16-bit (lossless, but cannot restore quality lost earlier) |
| OGG Vorbis | ✅ | ✅ | libvorbis at the chosen bitrate (quality 4, ~128 kbps, when none is set) |
| Opus | ✅ | ✅ | FFmpeg's native `opus` encoder at the chosen bitrate, Ogg container, always 48 kHz (libopus crashes on stereo in this build) |
| M4A / AAC | ✅ | ✅ | native `aac` encoder, 96–256 kbps |
| FLAC | ✅ | ✅ | FFmpeg's native `flac` encoder, lossless |
| WMA | ✅ | ❌ | decode only |
| WebM audio (.weba) | ✅ | ❌ | what browsers record from a microphone (Opus in WebM) |

Audio jobs keep only the first audio stream (cover art and video are dropped). Fades and loudness use a
filter graph (`atrim` → `afade` → `loudnorm=I=…:TP=-1.5:LRA=11`, single pass); trimming then happens
inside the graph instead of with `-ss`/`-t`.

### Video

| Container | Input | Output | Notes |
|---|---|---|---|
| MP4 | ✅ | ✅ | H.264 (libx264, `veryfast`, CRF or a size-target bitrate) + AAC, `yuv420p`, `+faststart` |
| WebM | ✅ | ✅ | VP8 (libvpx, `-deadline realtime -cpu-used 5`, constrained quality or size target) + Vorbis |
| GIF | — | ✅ | `fps` → `scale` → `palettegen` (128 colors) → `paletteuse` (Bayer dither), loops forever, no audio |
| MOV / MKV / AVI | ✅ | ❌ | input only, when the codec inside is supported |

VP9 (`libvpx-vp9`) still crashes with `RuntimeError: table index is out of bounds` in this build, so
WebM output is VP8. Earlier notes said every libvpx encode crashed; VP8 in realtime mode was tested
working on 2026-10-29 with a 12 s 720p clip (default and realtime deadlines, Vorbis and Opus audio).
Long or high-resolution VP8 encodes are untested. After any wasm crash the engine discards the
FFmpeg instance, so the next job starts on a fresh one.

Speed uses `setpts=PTS/speed` and an `atempo` chain (0.5–2 per stage, pitch kept); with a speed
change, trimming moves into the filter graph (`trim`/`atrim`) because `-ss`/`-t` would count output
time. Rotation is `transpose=1/2` (90°) or `hflip,vflip` (180°), mirroring `hflip`/`vflip`; both run
before scaling. Size presets follow the picture's orientation after rotation, so "720p" is a
720-pixel short side for portrait video too.

Video jobs keep the first video stream and the first audio stream (if any); subtitles are dropped.
Presets: Smaller = CRF 28, Balanced = CRF 23, Higher quality = CRF 18; custom CRF is clamped to 0–51.
Resize presets fit inside 1920×1080, 1280×720 or 854×480 with aspect ratio kept and even dimensions.

## On-device models

| Feature | Model | Size | Source / license | Runs on |
|---|---|---|---|---|
| Captions, Transcribe ("fast") | Whisper tiny (multilingual), ONNX, with cross-attentions for word times | encoder 10 MB + decoder 31 MB (int8) · 16.5 + 60 MB (fp16) | onnx-community/whisper-tiny_timestamped (pinned revision), an ONNX export of openai/whisper-tiny (Apache-2.0), via transformers.js 4 (Apache-2.0) | WebGPU (fp16, needs `shader-f16`) else WebAssembly (int8, 1 thread) |
| Captions, Transcribe ("better") | Whisper base (multilingual), ONNX | encoder 23 MB + decoder 54 MB (int8) · 41 + 105 MB (fp16) | onnx-community/whisper-base_timestamped (pinned revision), from openai/whisper-base (Apache-2.0). Optional: `CLIPMINT_SPEECH_MODELS=tiny` leaves it out of a build; `/models/speech.json` lists what is served | as above, about twice as slow as tiny |
| Captions, Transcribe (speech detection) | Silero VAD v5, ONNX (fp32) | 2.2 MB | onnx-community/silero-vad (pinned revision), from snakers4/silero-vad, MIT (`public/models/silero-vad/LICENSE`) | WebAssembly |
| Voice / Strong clean-up | RNNoise `sh.rnnn` | ~300 KB | richardpl/arnndn-models (from GregorR/rnnoise-models; not subject to copyright) | FFmpeg `arnndn` |
| Follow faces | BlazeFace short range (float16) | 230 KB | MediaPipe, Apache-2.0 | WebGL (GPU) else WebAssembly |
| Interface fonts | Bricolage Grotesque, Nunito, Caveat (Latin) | 131 KB | Google Fonts, OFL (`src/app/fonts/`) | Kept in the repo so a build never contacts Google |
| Caption font | Atkinson Hyperlegible Bold | 55 KB | OFL (`public/fonts/OFL.txt`) | libass in FFmpeg |
| Fonts for other scripts | Noto Sans (Latin extended, Cyrillic, Greek), Bengali, Devanagari, Arabic, JP, KR, SC | 0.5 to 2 MB each, CJK 4.7 to 8.5 MB | Google Fonts and notofonts/noto-cjk (pinned commits), OFL (`public/fonts/OFL-Noto.txt`) | libass in FFmpeg. Fetched by `scripts/fetch-fonts.mjs`; the browser loads one only when the text uses that script |

Every model and runtime file is served from this site; the Content-Security-Policy keeps it that way.
transformers.js would otherwise load ONNX Runtime from a CDN, so `whisper.worker.ts` sets
`wasmPaths` to `/ort/`, disables remote models, and rejoins split files (`/models/parts.json`) through
its custom cache hook. ONNX Runtime runs single-threaded because the site isn't cross-origin
isolated. Transcription works in 30-second windows (Whisper's span), so a word can be split at a window edge.

## Captions, jump cuts and recording

- **Caption styles** are written as an `.ass` script (`src/media/captions/ass.ts`) and drawn by libass
  (FFmpeg's `ass` filter, because `shaping=complex` is what joins Bengali and Devanagari letters and
  `subtitles` can't set it), laid out for the output's frame size. Text and logo overlays use the same
  filter; `drawtext` doesn't shape these scripts. libass has no font fallback here, so
  `src/media/captions/fonts.ts` names a font for each run of text. The editor's preview uses the browser's
  own fonts, so non-Latin text can look a little different from the export. The editor's preview uses the same
  timing and sizes. Lines from an imported file or edited by hand have no word times, so each word gets a
  share of its line's time by length.
- **Word times** come from Whisper's cross-attention and run late by a steady amount (measured about
  0.4 s for tiny, 0.2 s for base). `alignWords()` finds the shift that puts the reported gaps on real
  silence, then moves each boundary to the quietest nearby moment. Words beside a pause are then
  accurate; inside continuous speech a cut can still clip a neighbouring word.
- **Jump cuts** find quiet stretches in the loudness envelope (`src/media/jumpcut.ts`; pauses over 0.6 s,
  keeping 0.15 s either side) and cut them with `select`/`aselect` plus `setpts`/`asetpts` at the end of
  the filter chain, so captions and face crops are drawn on the uncut timeline first.
- **Timelines:** with Speed, Add music or jump cuts the trim moves into the filter graph, so the filters'
  clock starts at the trim point and is scaled by the speed. `filterClock()` maps source time onto it
  for captions and face tracks; `outputClock()` times the `.srt` that comes with burned-in captions.
- **Recording** uses `getUserMedia` / `getDisplayMedia` and MediaRecorder (WebM, or MP4 on Safari).
  `Permissions-Policy` allows camera, microphone and display capture for this site only.
- **Sharing in** needs the installed app: `public/sw.js` receives the POST from the share sheet, keeps
  the files in Cache Storage until the page opens them (`/?shared=1`), then deletes them. The worker
  caches nothing else and handles no other request. **Sharing out** uses the Web Share API.
- **Upload counter** (`src/lib/net-meter.ts`): fetch, XHR, `sendBeacon` and WebSocket sends from the
  page are wrapped and their body sizes added up; downloads come from Resource Timing. Requests made
  inside Web Workers aren't wrapped (they only fetch this site's own files).

## Browser support

| Browser | Minimum | Reason |
|---|---|---|
| Chrome / Edge | 91 | WebAssembly SIMD |
| Firefox | 114 | module workers (used by ffmpeg.wasm) |
| Safari | 16.4 | WebAssembly SIMD |

The app checks for WebAssembly SIMD and shows an error if it is missing.

## Limits

| Control | Value |
|---|---|
| Max audio file | 1 GB (rejected before processing) |
| Max video file | 2 GB (rejected before processing) |
| Size warning | 50 MB audio, 100 MB video |
| Waveform | skipped above 40 MB (timeline fallback) |
| Low-memory warning | `navigator.deviceMemory` ≤ 4 GB |
| Concurrent jobs | one at a time |

Inputs of 8 MB or more are mounted with WORKERFS and read on demand, so they aren't copied into
WebAssembly memory; the output still is, along with the codec buffers. WebAssembly encoding is several
times slower than native FFmpeg. `@ffmpeg/core-mt@0.12.10` hung on its first H.264 encode when tested on
2026-11-01 (Chrome, 8 cores, cross-origin isolated), so the single-threaded core stays. Long or 4K videos may run out of memory,
especially on phones.

## Build and deploy

```bash
npm run build      # static site in ./out (checks every file is under Cloudflare's 25 MiB limit)
npm run preview    # serve ./out locally with Wrangler
npm run deploy     # upload ./out to Cloudflare Pages
```

Any static host works. Response headers live in `public/_headers`: the Content-Security-Policy that
stops the page from connecting to other sites, the Permissions-Policy that allows camera, microphone and
screen capture for this site only, and cache rules. On another host, set the same headers there.

`npm test`, `npm run typecheck` and `npm run lint` run the unit tests, TypeScript and ESLint.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "The encoder failed to load" | `/ffmpeg/manifest.json` or a wasm part is missing. Rebuild with `npm run build` (it runs `scripts/copy-ffmpeg.mjs`) and deploy the whole `out/` folder. |
| Browser not supported | WebAssembly SIMD is missing. Update the browser (see table above). |
| Preview fails but processing works | The browser cannot play that codec, but FFmpeg can decode it. Use "Try converting anyway". |
| Output is larger than input | Efficient sources can grow when re-encoded. Try a higher CRF, a lower resolution or removing audio. |
| Out of memory | Use shorter clips, 480p, or close other tabs. There is no server fallback by design. |
| Duration shows `--:--` | Some recordings (MediaRecorder WebM/OGG) omit duration. Enter it manually (video) or convert the whole file (audio). |
| MP3 cut is a few ms off | MP3 frames are ~26 ms and encoders add padding. Use WAV for sample-exact cuts. |

## License notes

Not legal advice — verify before redistribution.

| Component | License |
|---|---|
| Application source | MIT (`LICENSE`) |
| next, react, tailwindcss, @ffmpeg/ffmpeg, @ffmpeg/util, onnxruntime-web | MIT |
| @huggingface/transformers, @mediapipe/tasks-vision | Apache-2.0 |
| @ffmpeg/core (wasm) | GPL-2.0-or-later (built with `--enable-gpl`, links libx264/libx265) |
| libmp3lame | LGPL-2.1 |
| libvpx, libvorbis, libopus | BSD-style |

A deployment that serves `public/ffmpeg/` distributes GPL-covered binaries and must meet the GPL's
terms for them (for example, point to the FFmpeg and ffmpeg.wasm sources and keep their notices). For
a permissive-only distribution you would need an LGPL core without libx264/libx265, which removes
H.264 encoding.

## Brand

**Name:** Clipmint — "clip" (cut and trim media) + "mint" (fresh, freshly made; the color).

**Mark:** a mint leaf on a mustard blob, cut lengthwise by the "clip".
Source: `assets/brand/clipmint-mark.svg`. Derived assets: `src/app/icon.svg` (cropped to the blob),
`src/app/favicon.ico` (16/32/48), `src/app/apple-icon.png`, `public/icon-192.png`, `public/icon-512.png`,
`public/icon-maskable-512.png`, `public/og.png`, and the light/dark lockups in `assets/brand/` (their
wordmark uses the Bricolage Grotesque font, so outline the text before using them outside the web).

**Colors, type and shapes:** the "sunny creative desk" look. All tokens are in
`src/styles/tokens.css`. The in-app logo is `components/desk/logo.tsx`.
