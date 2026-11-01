import type { Metadata } from "next";
import { DeskHeader } from "@/components/desk/header";
import { EveningDesk } from "@/components/desk/art";
import { Icon, type IconName } from "@/components/desk/icons";
import { SOURCE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: "Clipmint is a free, open-source workbench for sound and video that runs fully in your browser with FFmpeg WebAssembly.",
  alternates: { canonical: "/about" },
};

const BADGES: { t: string; tint: string; icon: IconName; r: number }[] = [
  { t: "Free", tint: "var(--tint-audio)", icon: "heart", r: -2 },
  { t: "Open source", tint: "var(--tint-video)", icon: "code", r: 1.5 },
  { t: "In your browser", tint: "var(--tint-rose)", icon: "browser", r: -1 },
];

const row = "flex min-h-12 items-center gap-3 text-[17px] font-extrabold text-ink no-underline";

export default function AboutPage() {
  return (
    <>
      <DeskHeader page="about" />
      <main id="main" className="relative mx-auto mt-10 flex max-w-[1240px] flex-wrap items-center gap-x-14 gap-y-10 max-sm:mt-6">
        <EveningDesk />
        <div className="flex flex-[1_1_380px] flex-col gap-[22px]">
          <h1 className="m-0 font-display text-[clamp(38px,4.6vw,60px)] font-extrabold leading-none tracking-[-0.04em]">A little workbench for sound &amp; video.</h1>
          <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
            {BADGES.map((b) => (
              <li key={b.t} className="inline-flex items-center gap-2 rounded-sticker border-2 border-edge py-2 pl-2 pr-3.5 text-[15px] font-extrabold shadow-sticker" style={{ background: b.tint, transform: `rotate(${b.r}deg)` }}>
                <span aria-hidden="true" className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-icon-well"><Icon name={b.icon} size={18} strokeWidth={2.1} /></span>
                {b.t}
              </li>
            ))}
          </ul>
          <nav aria-label="Project links" className="flex flex-col gap-1 border-t-2 border-dashed border-line pt-1.5">
            {SOURCE_URL && (
              <>
                <a href={SOURCE_URL} className={row}><Icon name="code" size={22} style={{ color: "var(--primary)" }} />Source code<Icon name="external" size={18} className="ml-auto text-ink-soft" /></a>
                <a href={`${SOURCE_URL}/issues`} className={row}><Icon name="sprout" size={22} style={{ color: "var(--primary)" }} />Suggest a tool<Icon name="external" size={18} className="ml-auto text-ink-soft" /></a>
              </>
            )}
            <details className="group">
              <summary className={`${row} cursor-pointer list-none rounded-lg [&::-webkit-details-marker]:hidden`}>
                <Icon name="book" size={22} style={{ color: "var(--primary)" }} />Licenses &amp; credits
                <Icon name="plus" size={18} className="ml-auto text-ink-soft group-open:rotate-45" />
              </summary>
              <div className="flex flex-col gap-2 pb-3 pl-[34px] text-[15px] font-bold leading-relaxed text-ink-soft">
                <p className="m-0">Clipmint is MIT licensed.</p>
                <p className="m-0">
                  Media is processed by FFmpeg compiled to WebAssembly (ffmpeg.wasm). The bundled core, @ffmpeg/core 0.12.10,
                  includes libx264 and libx265 and is GPL-2.0-or-later. Its source code is available
                  from <a href="https://github.com/ffmpegwasm/ffmpeg.wasm" className="text-primary underline underline-offset-2">ffmpeg.wasm on GitHub</a> and
                  FFmpeg&rsquo;s from <a href="https://ffmpeg.org/download.html" className="text-primary underline underline-offset-2">ffmpeg.org</a>.
                </p>
                <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5">
                  <li>Speech recognition: Whisper tiny (OpenAI, Apache-2.0) and Silero VAD (Silero Team, MIT), run with transformers.js (Apache-2.0) and ONNX Runtime Web (MIT).</li>
                  <li>Noise reduction: RNNoise models from GregorR/rnnoise-models (not subject to copyright).</li>
                  <li>Face detection: MediaPipe BlazeFace and MediaPipe Tasks Vision (Apache-2.0).</li>
                  <li>Fonts: Bricolage Grotesque, Nunito, Caveat, Atkinson Hyperlegible and Noto Sans (SIL Open Font License).</li>
                </ul>
              </div>
            </details>
          </nav>
          <p className="m-0 font-hand text-[26px] font-bold text-note">made with care, kept tiny on purpose</p>
        </div>
      </main>
    </>
  );
}
