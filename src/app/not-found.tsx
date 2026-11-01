import Link from "next/link";
import { DeskHeader } from "@/components/desk/header";
import { DropArt } from "@/components/desk/art";

export default function NotFound() {
  return (
    <>
      <DeskHeader page="desk" />
      <main
        id="main"
        className="mat relative mx-auto mt-[30px] flex max-w-desk flex-col items-center gap-5 px-6 py-16 text-center"
      >
        <DropArt />
        <h1 className="m-0 font-display text-[clamp(36px,4.6vw,60px)] font-extrabold leading-none tracking-[-0.035em]">
          Nothing on this mat
        </h1>
        <Link
          href="/"
          className="inline-flex min-h-[52px] items-center rounded-button border-2 border-ill-line bg-accent px-6 text-[17px] font-extrabold text-on-accent no-underline shadow-on-mat"
        >
          back to the desk
        </Link>
      </main>
    </>
  );
}
