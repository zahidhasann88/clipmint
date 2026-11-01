"use client";
import { DENOISE_MODEL } from "@/media/recipe";
import type { Recipe } from "@/lib/registry";

const cache = new Map<string, Promise<File>>();

export function loadFile(url: string, name: string): Promise<File> {
  let hit = cache.get(url);
  if (!hit) {
    hit = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`Couldn't load ${name} (${r.status}).`);
      return new File([await r.blob()], name);
    });
    hit.catch(() => cache.delete(url));
    cache.set(url, hit);
  }
  return hit;
}

export function denoiseModel(level: Recipe["denoise"]): Promise<File | null> {
  const name = DENOISE_MODEL[level];
  return name
    ? loadFile(`/models/rnnoise/${name}.rnnn`, `${name}.rnnn`)
    : Promise.resolve(null);
}
