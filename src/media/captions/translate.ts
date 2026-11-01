"use client";

// Uses the browser's built-in on-device Translator API (Chrome and Edge 138+).
// The browser fetches and manages the language pack itself; the text stays on this device.
interface TranslatorLike {
  translate(text: string): Promise<string>;
  destroy?: () => void;
}
interface TranslatorApi {
  availability(o: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<string>;
  create(o: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: EventTarget) => void;
  }): Promise<TranslatorLike>;
}

const api = () =>
  (globalThis as unknown as { Translator?: TranslatorApi }).Translator;

export const canTranslate = () => typeof window !== "undefined" && !!api();

export async function translateLines(
  lines: string[],
  from: string,
  to: string,
  signal: AbortSignal,
  onProgress?: (ratio: number) => void,
): Promise<string[]> {
  const t = api();
  if (!t) throw new Error("This browser has no built-in translator.");
  const pair = { sourceLanguage: from, targetLanguage: to };
  if ((await t.availability(pair)) === "unavailable")
    throw new Error("This browser can't translate between those languages.");
  const translator = await t.create({
    ...pair,
    monitor: (m) =>
      m.addEventListener("downloadprogress", (e) =>
        onProgress?.((e as ProgressEvent).loaded),
      ),
  });
  try {
    const out: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      out.push(lines[i].trim() ? await translator.translate(lines[i]) : "");
      onProgress?.((i + 1) / lines.length);
    }
    return out;
  } finally {
    translator.destroy?.();
  }
}
