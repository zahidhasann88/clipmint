"use client";
import type { FileFacts, Recipe } from "./registry";
import type { Segment } from "@/media/captions/format";

const DB = "clipmint";
const FILES = "files";
const STATE = "state";

export interface SavedItem {
  id: number;
  facts: FileFacts;
}
export interface SavedResult {
  itemId: number;
  error: string | null;
  out: {
    filename: string;
    size: number;
    duration: number | null;
    text?: string;
    extras?: { name: string; label: string }[];
  } | null;
}
export interface DeskState {
  v: 1;
  items: SavedItem[];
  ranges: Record<number, { start: number; end: number }>;
  recipe: Recipe;
  toolId: string | null;
  stage: "edit" | "result";
  music: { name: string } | null;
  logo?: { name: string } | null;
  results: SavedResult[];
  captions?: {
    itemId: number;
    language: string;
    range: { start: number; end: number } | null;
    segments: Segment[];
    removed?: { start: number; end: number }[];
    original?: Segment[];
  } | null;
}

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(FILES);
      req.result.createObjectStore(STATE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = d.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

const quiet = <T>(p: Promise<T>) => p.catch(() => undefined);

export const putFile = (key: string, blob: Blob) =>
  quiet(run(FILES, "readwrite", (s) => s.put(blob, key)));
export const dropFile = (key: string) =>
  quiet(run(FILES, "readwrite", (s) => s.delete(key)));
export const getFile = (key: string) =>
  quiet(run<Blob>(FILES, "readonly", (s) => s.get(key)));
export const saveState = (state: DeskState) =>
  quiet(run(STATE, "readwrite", (s) => s.put(state, "desk")));
export const loadState = () =>
  quiet(run<DeskState>(STATE, "readonly", (s) => s.get("desk")));

export async function dropResults() {
  await quiet(
    run(FILES, "readwrite", (s) => {
      s.openCursor().onsuccess = (e) => {
        const c = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (!c) return;
        if (/^(result|extra):/.test(String(c.key))) c.delete();
        c.continue();
      };
    }),
  );
}

export async function clearSession() {
  await quiet(run(FILES, "readwrite", (s) => s.clear()));
  await quiet(run(STATE, "readwrite", (s) => s.clear()));
}
