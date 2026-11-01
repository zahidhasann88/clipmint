import type { Metadata } from "next";
import Link from "next/link";
import { DeskHeader } from "@/components/desk/header";
import { Envelope } from "@/components/desk/art";
import { Icon, type IconName } from "@/components/desk/icons";
import { SOURCE_URL } from "@/lib/site";
import { NetStatsCard } from "@/components/desk/net-stats";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Clipmint handles media: no uploads, no cloud processing, no accounts, no tracking. Everything is done in your browser.",
  alternates: { canonical: "/privacy" },
};

const PROMISES: { t: string; tint: string; icon: IconName }[] = [
  { t: "Done on your device", tint: "var(--pill)", icon: "home" },
  { t: "Nothing uploaded", tint: "var(--tint-audio)", icon: "noCloud" },
  { t: "No accounts", tint: "var(--tint-rose)", icon: "noUser" },
  { t: "No tracking, no cookies", tint: "var(--tint-stone)", icon: "noEye" },
];

export default function PrivacyPage() {
  return (
    <>
      <DeskHeader page="privacy" />
      <main id="main" className="relative mx-auto mt-11 flex max-w-[980px] flex-col items-center max-sm:mt-6">
        <Envelope />
        <article className="flex w-full flex-col gap-8 rounded-[10px_34px_30px_36px] border-2 border-edge bg-paper px-[clamp(20px,5vw,64px)] pb-10 pt-[54px] shadow-[6px_7px_0_var(--edge)]">
          <h1 className="m-0 text-center font-display text-[clamp(36px,5vw,62px)] font-extrabold leading-none tracking-[-0.04em] text-primary">
            Your files never<br />leave this desk.
          </h1>
          <ul className="m-0 flex list-none flex-wrap justify-center gap-4 p-0">
            {PROMISES.map((p) => (
              <li key={p.t} className="lift flex max-w-[220px] flex-[1_1_180px] flex-col items-center gap-3 rounded-[24px_28px_24px_20px] px-3.5 py-[22px] text-center" style={{ background: p.tint }}>
                <span aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-full border-2 border-edge bg-paper shadow-sticker">
                  <Icon name={p.icon} size={30} strokeWidth={2} />
                </span>
                <span className="text-[17px] font-extrabold leading-tight">{p.t}</span>
              </li>
            ))}
          </ul>
          <NetStatsCard />
          <p className="m-0 max-w-[560px] self-center text-center text-[15px] font-bold text-ink-soft">
            Recordings from your microphone, camera or screen are made in this page and stay on this device too.
            Your work in progress is kept in this browser, so a refresh doesn’t lose it. <q>New file</q> clears it.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {SOURCE_URL && (
              <a href={SOURCE_URL} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border-2 border-edge bg-accent pl-3.5 pr-5 text-base font-extrabold text-on-accent no-underline shadow-[3px_4px_0_var(--edge)]">
                <Icon name="code" />Check the code
              </a>
            )}
            <Link href="/" className="inline-flex min-h-12 items-center gap-2 text-base font-extrabold text-primary underline-offset-4">
              <Icon name="arrowLeft" />back to the desk
            </Link>
          </div>
          <p className="m-0 text-right font-hand text-[28px] font-bold text-sign">— clipmint</p>
        </article>
      </main>
    </>
  );
}
