type PartsIndex = Record<string, { size: number; parts: string[] }>;

let index: Promise<PartsIndex> | null = null;
function loadIndex(): Promise<PartsIndex> {
  index ??= fetch("/models/parts.json")
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return index;
}

const pathOf = (url: string) => {
  try {
    return new URL(url, self.location.origin).pathname;
  } catch {
    return url;
  }
};

export async function isSplit(url: string): Promise<boolean> {
  return pathOf(url) in (await loadIndex());
}

export async function fetchJoined(
  url: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Response> {
  const entry = (await loadIndex())[pathOf(url)];
  if (!entry) return fetch(url);
  const out = new Uint8Array(entry.size);
  let offset = 0;
  for (const part of entry.parts) {
    const res = await fetch(part);
    if (!res.ok) throw new Error(`Missing model part ${part} (${res.status}).`);
    const buf = new Uint8Array(await res.arrayBuffer());
    out.set(buf, offset);
    offset += buf.length;
    onProgress?.(offset, entry.size);
  }
  if (offset !== entry.size)
    throw new Error(`Model file ${url} is incomplete.`);
  return new Response(out, {
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(entry.size),
    },
  });
}
