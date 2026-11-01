import type { Recipe } from "@/lib/registry";

const KEEP: (keyof Recipe)[] = [
  "format",
  "bitrate",
  "size",
  "squeeze",
  "sharpness",
  "gifWidth",
  "gifFps",
  "aspect",
  "cropPos",
  "follow",
  "fill",
  "platform",
  "denoise",
  "silence",
  "captionSize",
  "transcriptFormat",
  "language",
  "musicMode",
  "musicVolume",
  "originalVolume",
  "captionStyle",
  "captionColor",
  "captionPos",
  "speechModel",
];
const KEY = "recipe:prefs";

export function loadPrefs(): Partial<Recipe> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      KEEP.filter((k) => k in data).map((k) => [k, data[k]]),
    ) as Partial<Recipe>;
  } catch {
    return {};
  }
}

export function savePrefs(recipe: Recipe) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(Object.fromEntries(KEEP.map((k) => [k, recipe[k]]))),
    );
  } catch {
    /* private mode or full storage: just don't remember */
  }
}
