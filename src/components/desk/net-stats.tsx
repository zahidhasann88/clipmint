"use client";
import { bytesLabel, useNetStats } from "@/lib/net-meter";

export function NetStatsCard() {
  const s = useNetStats();
  const rows: [string, string, string][] = [
    [
      "Uploaded",
      bytesLabel(s.uploaded),
      s.sends
        ? `${s.sends} ${s.sends === 1 ? "request" : "requests"} carried data`
        : "no request has carried any data",
    ],
    [
      "Downloaded",
      bytesLabel(s.downloaded),
      `${s.files} files from this site: the app, and the encoder and models when a tool needs them (files the browser already had count as 0)`,
    ],
    [
      "Other sites",
      String(s.offsite),
      s.offsite
        ? "requests went to another site"
        : "requests went anywhere but this site",
    ],
  ];
  return (
    <section
      aria-labelledby="net-title"
      className="flex w-full max-w-[640px] flex-col gap-3 self-center rounded-[24px_28px_24px_20px] border-2 border-edge bg-surface p-5"
    >
      <h2
        id="net-title"
        className="m-0 font-hand text-[30px] font-bold leading-none"
      >
        counted live, this visit
      </h2>
      <dl className="m-0 grid grid-cols-[auto_auto_1fr] items-baseline gap-x-4 gap-y-2.5 max-sm:grid-cols-[auto_1fr]">
        {rows.map(([k, v, note]) => (
          <div key={k} className="contents">
            <dt className="text-sm font-extrabold text-ink-soft">{k}</dt>
            <dd className="m-0 font-display text-2xl font-extrabold tabular-nums">
              {v}
            </dd>
            <dd className="m-0 text-[13px] font-bold text-ink-soft max-sm:col-span-2 max-sm:-mt-2">
              {note}
            </dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-[13px] font-bold text-ink-soft">
        Every way this page can send data (fetch, XHR, beacons, WebSockets) is
        counted as it happens. The site&rsquo;s security policy also stops the
        page from connecting to any other site at all. Workers that load the
        encoder and speech models only fetch this site&rsquo;s own files and
        aren&rsquo;t counted here.
      </p>
    </section>
  );
}
