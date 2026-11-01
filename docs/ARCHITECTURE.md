# How Clipmint is built

A short guide for developers. Formats, limits, models, build and deploy are in
[REFERENCE.md](REFERENCE.md).

## Principles

- **Everything runs in the browser.** FFmpeg (WebAssembly) processes the media; the AI models run in the
  page. No server, no uploads, no accounts.
- **A static site.** `next build` exports to `./out`. Every file the app needs is served from its own
  origin, and the CSP in `public/_headers` blocks connections to other sites.
- **One editor, one recipe.** Every tool changes one shared `Recipe`; everything switched on goes into
  one export.
- **Logic in pure functions** (tested with Vitest), components stay thin.

## Stack

Next.js 14 (static export) · React 18 · TypeScript · Tailwind (tokens in `src/styles/tokens.css`) ·
ffmpeg.wasm 0.12 (single-threaded) · transformers.js (Whisper + Silero VAD) · MediaPipe (faces) · Vitest.

## Where things are

| Path | What |
|---|---|
| `src/app/` | Routes: the desk (`page.tsx`), SEO pages that preselect a tool, privacy, manifest |
| `src/components/desk/desk-state.tsx` | The single state store: files, recipe, brewing, results, undo |
| `src/components/desk/` | The UI: mat, editor, tool strip, recipe card, result, recorder |
| `src/lib/registry.ts` | Tools, the `Recipe` type and its defaults |
| `src/lib/edits.ts` | Which edits are on, how they switch, their labels |
| `src/media/recipe.ts` | Recipe → job options (sizes, quality, estimates) |
| `src/media/ffmpeg/commands.ts` | Job options → FFmpeg arguments (pure), plus timeline helpers |
| `src/media/ffmpeg/run.ts` | Runs one FFmpeg job in the browser |
| `src/media/captions/` | Whisper worker, caption formats and styles, subtitle import, translation |
| `src/media/textcut.ts` | Filler words and turning cut words into kept spans |
| `src/media/beats.ts` | Finding a song's beat and cutting clips to it |
| `src/media/frames.ts` | Scoring frames for thumbnails |
| `scripts/` | Run before dev/build: copy FFmpeg and MediaPipe, download models, check the output |

## How it works

```
open file ──▶ edit (recipe) ──Brew it──▶ recipe.ts ──▶ commands.ts ──▶ ffmpeg.wasm ──▶ result
```

1. **Open**: a dropped, pasted, recorded or shared file is checked and read (duration, size, codecs).
2. **Edit**: each tool shows its settings; the output settings (the Export panel) sit under every tool.
3. **Brew**: `runJobs()` in `desk-state.tsx` finds faces, hears speech or finds pauses if needed, then
   plans the job and runs FFmpeg.
4. **Result**: download, share, zip a batch, or make shorts.

Only one FFmpeg job can run at a time, so the brew, the size estimate and side jobs (checking captions,
before/after samples) stop each other first. With Speed, music or jump cuts the trim happens inside the
filter graph; `filterClock()` keeps captions and face crops in sync with it.

## On-device AI

- **Captions**: a Web Worker finds speech (Silero VAD), then transcribes it with Whisper tiny ("fast") or
  base ("better"), on WebGPU when available, else WASM. Styles are written as an `.ass` script for libass.
- **Loudness** (`media/loudness.ts`) drives "good bit", "Make 3 shorts" and jump cuts.
- **Follow faces**: MediaPipe finds the main face; its path becomes a moving crop.
- **Blur faces**: `trackAllFaces()` follows up to six faces at a lower confidence than cropping, since a
  missed face matters more than an extra blur. Each track becomes a moving `crop`, `boxblur`, `overlay`.

## State and privacy

- The desk is saved in IndexedDB (`lib/session.ts`), so a refresh keeps the work; remembered choices are
  in localStorage (`lib/saved-recipes.ts`).
- `public/sw.js` only receives files shared to the installed app; it caches nothing.
- `lib/net-meter.ts` counts the bytes the page sends, for the "0 bytes uploaded" pill.

## Build

`npm run dev` / `npm run build` first run the `scripts/`: copy the FFmpeg core (split under 25 MiB),
copy MediaPipe, and download the Whisper models into `public/models` (cached in `.cache/models`). After
a build, `check-pages.mjs` checks file sizes and routes.

## Common changes

- **Add a tool**: an entry in `TOOLS` (`lib/registry.ts`); if it switches on and off, an entry in `EDITS`
  (`lib/edits.ts`). New settings go on `Recipe` and `BASE_RECIPE`; their UI goes in
  `components/desk/recipe.tsx`.
- **Add an FFmpeg step**: build it in `commands.ts`, fill it in `recipe.ts`, test it in `commands.test.ts`.
- **Add an SEO page**: an entry in `lib/routes.ts` and a folder in `src/app` like the others.
- **Add a social platform**: an entry in `PLATFORMS` (`lib/registry.ts`).
- **Change colours**: tokens in `src/styles/tokens.css` (the Tailwind theme only has token colours).

## Checks

`npm test`, `npm run typecheck`, `npm run lint`. Browser-only parts (FFmpeg itself, workers) aren't
unit-tested, so keep logic in pure functions.
