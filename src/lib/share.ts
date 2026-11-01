"use client";

const SHARE_CACHE = "clipmint-share";

export function registerShareWorker() {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    !window.isSecureContext
  )
    return;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    /* sharing in just won't be offered */
  });
}

export async function takeSharedFiles(): Promise<File[]> {
  if (
    typeof window === "undefined" ||
    !new URLSearchParams(location.search).has("shared")
  )
    return [];
  history.replaceState(null, "", location.pathname);
  if (!("caches" in window)) return [];
  try {
    const cache = await caches.open(SHARE_CACHE);
    const files: File[] = [];
    for (const req of await cache.keys()) {
      const res = await cache.match(req);
      if (!res) continue;
      const blob = await res.blob();
      files.push(
        new File(
          [blob],
          decodeURIComponent(res.headers.get("x-name") || "shared"),
          { type: blob.type },
        ),
      );
    }
    await caches.delete(SHARE_CACHE);
    return files;
  } catch {
    return [];
  }
}

export function canShare(files: File[]): boolean {
  try {
    return (
      typeof navigator !== "undefined" &&
      !!navigator.canShare &&
      files.length > 0 &&
      navigator.canShare({ files })
    );
  } catch {
    return false;
  }
}

export async function shareFiles(files: File[]): Promise<boolean> {
  try {
    await navigator.share({ files });
    return true;
  } catch (e) {
    return (e as Error)?.name === "AbortError";
  }
}
