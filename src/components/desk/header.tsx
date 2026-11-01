"use client";
import Link from "next/link";
import { Icon } from "./icons";
import { LampToggle } from "./lamp";
import { Wordmark } from "./logo";
import { cn } from "@/lib/utils";
import { bytesLabel, useNetStats } from "@/lib/net-meter";

export type Page = "desk" | "privacy" | "about";

interface Props {
  page: Page;
  crumbs?: { shelf: string; tool: string; tint: string; onDesk: () => void };
  quiet?: boolean;
  phone?: React.ReactNode;
  onHome?: () => void;
}

export function DeskHeader({ page, crumbs, quiet, phone, onHome }: Props) {
  const onDeskPage = page === "desk";
  const { uploaded } = useNetStats();
  return (
    <header className="relative mx-auto w-full max-w-desk">
      {phone && <div className="sm:hidden">{phone}</div>}
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-[18px] gap-y-3.5",
          !!phone && "max-sm:hidden",
        )}
      >
        <Link
          href="/"
          onClick={onHome}
          aria-label={
            onDeskPage && !crumbs
              ? "Clipmint home"
              : "Clipmint, back to the desk"
          }
          className={cn(
            "flex items-center rounded-2xl no-underline",
            !crumbs && "mr-auto",
          )}
        >
          <Wordmark />
        </Link>

        {crumbs && (
          <nav aria-label="Breadcrumb" className="mr-auto">
            <ol className="m-0 flex list-none items-center gap-1.5 p-0 text-[15px] font-extrabold">
              <li>
                <button
                  type="button"
                  onClick={crumbs.onDesk}
                  className="inline-flex min-h-tap items-center rounded-lg px-1.5 text-ink-soft underline underline-offset-4"
                >
                  desk
                </button>
              </li>
              <li aria-hidden="true" className="text-wood">
                /
              </li>
              <li>
                <button
                  type="button"
                  onClick={crumbs.onDesk}
                  className="inline-flex min-h-tap items-center rounded-lg px-1.5 lowercase text-ink-soft underline underline-offset-4"
                >
                  {crumbs.shelf}
                </button>
              </li>
              <li aria-hidden="true" className="text-wood">
                /
              </li>
              <li
                aria-current="page"
                className="rounded-full px-3 py-1.5 lowercase"
                style={{ background: crumbs.tint }}
              >
                {crumbs.tool}
              </li>
            </ol>
          </nav>
        )}

        <nav
          aria-label="Pages and settings"
          className="order-2 flex items-center gap-2.5"
        >
          <Link
            href="/privacy"
            aria-current={page === "privacy" ? "page" : undefined}
            title="Counted live: every request this page sends. Your files stay on this device."
            className={cn(
              "inline-flex min-h-tap min-w-tap items-center justify-center gap-1.5 rounded-full px-3 text-sm font-extrabold tabular-nums no-underline sm:pl-3 sm:pr-4",
              page === "privacy"
                ? "bg-primary text-on-primary"
                : "bg-pill text-primary",
            )}
          >
            <Icon name="upload" size={18} />
            <span className="max-sm:hidden">
              {bytesLabel(uploaded)} uploaded
            </span>
            <span className="sm:hidden" aria-hidden="true">
              {uploaded ? bytesLabel(uploaded) : "0 B"}
            </span>
            <span className="sr-only sm:hidden">
              {bytesLabel(uploaded)} uploaded
            </span>
          </Link>
          {!quiet && (
            <>
              <Link
                href="/about"
                aria-label="About Clipmint"
                aria-current={page === "about" ? "page" : undefined}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full",
                  page === "about"
                    ? "bg-primary text-on-primary"
                    : "bg-surface text-ink",
                )}
              >
                <Icon name="book" />
              </Link>
              <LampToggle />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function PhoneBar({
  onBack,
  title,
  detail,
  pill,
  end,
}: {
  onBack: () => void;
  title: React.ReactNode;
  detail?: string;
  pill?: { text: string; tint: string };
  end?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to the desk"
        className="grid h-11 w-11 flex-none place-items-center rounded-full bg-surface text-ink"
      >
        <Icon name="arrowLeft" size={22} strokeWidth={2.4} />
      </button>
      <div className="min-w-0 flex-1">
        {title}
        {detail && (
          <p className="m-0 mt-0.5 text-xs font-extrabold text-ink-soft">
            {detail}
          </p>
        )}
      </div>
      {pill && (
        <span
          className="flex-none rounded-full px-2.5 py-1.5 text-[13px] font-extrabold lowercase"
          style={{ background: pill.tint }}
        >
          {pill.text}
        </span>
      )}
      {end}
    </div>
  );
}
