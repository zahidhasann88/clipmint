"use client";
import { useSyncExternalStore } from "react";

export interface NetStats {
  uploaded: number;
  sends: number;
  downloaded: number;
  files: number;
  offsite: number;
}

const START: NetStats = {
  uploaded: 0,
  sends: 0,
  downloaded: 0,
  files: 0,
  offsite: 0,
};
let stats = START;
const listeners = new Set<() => void>();
const emit = (patch: Partial<NetStats>) => {
  stats = { ...stats, ...patch };
  listeners.forEach((l) => l());
};

function bodySize(body: unknown): number | Promise<number> {
  if (body == null) return 0;
  if (typeof body === "string") return new TextEncoder().encode(body).length;
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  if (body instanceof URLSearchParams)
    return new TextEncoder().encode(body.toString()).length;
  if (body instanceof FormData) {
    let n = 0;
    body.forEach((v) => {
      n += typeof v === "string" ? new TextEncoder().encode(v).length : v.size;
    });
    return n;
  }
  if (body instanceof Request)
    return body.method === "GET" || body.method === "HEAD"
      ? 0
      : body
          .clone()
          .blob()
          .then((b) => b.size)
          .catch(() => 0);
  return 0;
}

function sent(body: unknown) {
  const n = bodySize(body);
  const add = (bytes: number) => {
    if (bytes > 0)
      emit({ uploaded: stats.uploaded + bytes, sends: stats.sends + 1 });
  };
  if (typeof n === "number") add(n);
  else n.then(add);
}

function readResources(list: PerformanceEntryList) {
  let { downloaded, files, offsite } = stats;
  for (const e of list as PerformanceResourceTiming[]) {
    if (/^(data|blob):/.test(e.name)) continue;
    files++;
    downloaded += e.transferSize || 0;
    try {
      if (new URL(e.name).origin !== location.origin) offsite++;
    } catch {
      /* not a URL */
    }
  }
  emit({ downloaded, files, offsite });
}

let installed = false;
export function installNetMeter() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const fetch0 = window.fetch;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    sent(init?.body ?? (input instanceof Request ? input : null));
    return fetch0.call(window, input, init);
  };
  const xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (
    body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    sent(
      body instanceof Document
        ? new XMLSerializer().serializeToString(body)
        : body,
    );
    return xhrSend.call(this, body as XMLHttpRequestBodyInit | null);
  };
  if (navigator.sendBeacon) {
    const beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      sent(data);
      return beacon(url, data);
    };
  }
  const wsSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (
    data: string | ArrayBufferLike | Blob | ArrayBufferView,
  ) {
    const devReload =
      process.env.NODE_ENV === "development" &&
      this.url.includes("/_next/webpack-hmr");
    if (!devReload) sent(data);
    return wsSend.call(this, data);
  };
  readResources(performance.getEntriesByType("resource"));
  try {
    new PerformanceObserver((l) => readResources(l.getEntries())).observe({
      type: "resource",
      buffered: false,
    });
  } catch {
    /* old browser: downloads just won't update */
  }
}

installNetMeter();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export function useNetStats(): NetStats {
  return useSyncExternalStore(
    subscribe,
    () => stats,
    () => START,
  );
}

export function privacyReceipt(
  files: { name: string; size: number }[],
  when = new Date(),
): string {
  const s = stats;
  return [
    "Clipmint privacy receipt",
    `Made: ${when.toISOString()}`,
    `Page: ${location.origin}`,
    "",
    "Files made on this device:",
    ...files.map((f) => `  ${f.name} (${bytesLabel(f.size)})`),
    "",
    "What this page counted during this visit:",
    `  Data uploaded: ${bytesLabel(s.uploaded)} (${s.sends} requests carried data)`,
    `  Files downloaded from this site: ${s.files} (${bytesLabel(s.downloaded)})`,
    `  Requests to other sites: ${s.offsite}`,
    "",
    "How to read this: the page counts its own fetch, XHR, beacon and WebSocket",
    "sends. Web Workers are not counted, and this file can be edited, so it is a",
    "record of what the page saw, not a tamper-proof certificate. To check for",
    "yourself, open the browser's Network panel while you work.",
    "",
  ].join("\n");
}

export function bytesLabel(n: number): string {
  if (n === 0) return "0 bytes";
  if (n < 1000) return `${n} bytes`;
  if (n < 1e6) return `${Math.round(n / 1000)} KB`;
  return `${(n / 1e6).toFixed(1)} MB`;
}
