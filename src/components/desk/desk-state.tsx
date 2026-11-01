"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BASE_RECIPE,
  accepts,
  engineFor,
  getTool,
  suggestionsFor,
  toolKey,
  type Engine,
  type FileFacts,
  type Recipe,
  type Tool,
} from "@/lib/registry";
import {
  EDITS,
  activeEdits,
  merging,
  outputKind,
  startRecipe,
  toggle,
  type ActiveEdit,
} from "@/lib/edits";
import {
  clearSession,
  dropFile,
  dropResults,
  getFile,
  loadState,
  putFile,
  saveState,
  type DeskState,
} from "@/lib/session";
import {
  audioJob,
  estimateAudioBytes,
  outputDims,
  videoMergePlan,
  videoPlanFor,
  type Range,
} from "@/media/recipe";
import { mergeAudio, processAudio } from "@/media/audio/engine";
import { mergeVideo, processVideo, type MergeClip } from "@/media/video/engine";
import { wavSamples } from "@/media/files/wav";
import { beatPieces, beatTimes } from "@/media/beats";
import { fillerRanges, removeRanges, toggleRange } from "@/media/textcut";
import { translateLines } from "@/media/captions/translate";
import { parseSubtitles } from "@/media/captions/format";
import { detectCodecs } from "@/media/files/codecs";
import { downloadBlob, validateFile } from "@/media/files";
import { zipBlobs } from "@/media/files/zip";
import { SAMPLE_MAX_BYTES, sampleVideo } from "@/media/sample";
import { loadPrefs, savePrefs } from "@/lib/saved-recipes";
import { denoiseModel } from "@/media/models";
import { trackAllFaces, trackFaces, type TrackKey } from "@/media/track";
import {
  toSRT,
  toText,
  toVTT,
  transcribe,
  type CaptionStage,
  type Segment,
} from "@/media/captions";
import { loadFile } from "@/media/models";
import { loudness } from "@/media/loudness";
import { goodBits } from "@/media/highlights";
import { keepSpans, keptSeconds } from "@/media/jumpcut";
import { overlayASS, toASS } from "@/media/captions/ass";
import { fontsFor } from "@/media/captions/fonts";
import {
  filterClock,
  outputClock,
  overlapFor,
  trimsInGraph,
  type FaceBox,
} from "@/media/ffmpeg/commands";
import { getExt } from "@/lib/utils";
import { takeSharedFiles } from "@/lib/share";

export type Stage = "desk" | "opening" | "edit" | "brewing" | "result";

export interface Item {
  id: number;
  file: File;
  facts: FileFacts;
  ready?: boolean;
}
export interface JobState {
  ratio: number | null;
  message: string;
  secondsLeft: number | null;
  index: number;
  count: number;
  unit?: "file" | "short";
}
export interface CaptionDraft {
  itemId: number;
  language: string;
  range: Range | null;
  segments: Segment[];
  removed?: Range[];
  original?: Segment[];
}
export interface CaptionCheck {
  busy: boolean;
  message: string;
  error: string | null;
}
export type SideJob = "captions" | "preview";
export interface ResultState {
  blob: Blob;
  url: string;
  filename: string;
  size: number;
  duration: number | null;
  text?: string;
  extras?: { name: string; blob: Blob; label: string }[];
}
export interface BatchResult {
  item: Item;
  out: ResultState | null;
  error: string | null;
}

export const MAX_BATCH = 20;

interface DeskValue {
  stage: Stage;
  restoring: boolean;
  output: "audio" | "video" | "text";
  merge: boolean;
  edits: ActiveEdit[];
  editOn: (key: string) => boolean;
  setEdit: (key: string, on: boolean) => void;
  entering: boolean;
  items: Item[];
  batch: boolean;
  file: File | null;
  sourceUrl: string | null;
  facts: FileFacts | null;
  tool: Tool | null;
  preferred: string | null;
  recipe: Recipe;
  range: Range | null;
  ranges: Record<number, Range>;
  estimate: number | null;
  brewSeconds: number | null;
  music: File | null;
  setMusic: (f: File | null) => void;
  logo: File | null;
  setLogo: (f: File | null) => void;
  moveItem: (id: number, by: -1 | 1) => void;
  job: JobState;
  result: ResultState | null;
  results: BatchResult[];
  error: string | null;
  warning: string | null;
  notice: string | null;
  openFile: (file: File) => void;
  openFiles: (files: File[], mode?: "replace" | "add") => void;
  removeItem: (id: number) => void;
  pickTool: (key: string, turnOn?: boolean) => void;
  preselect: (key: string | null, defaults?: Partial<Recipe>) => void;
  setRecipe: (patch: Partial<Recipe>) => void;
  setRange: (range: Range) => void;
  setItemRange: (id: number, range: Range) => void;
  brew: () => void;
  stop: () => void;
  tweak: () => void;
  newFile: () => void;
  toDesk: () => void;
  resume: () => void;
  download: (index?: number) => void;
  downloadAll: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  captionDraft: CaptionDraft | null;
  captionLines: Segment[] | null;
  captionCheck: CaptionCheck;
  checkCaptions: () => void;
  stopCheck: () => void;
  setCaptionLine: (index: number, text: string) => void;
  toggleCut: (word: Range) => void;
  clearCuts: () => void;
  importCaptions: (file: File) => void;
  translateCaptions: (to: string) => void;
  restoreCaptions: () => void;
  previewAB: (
    kind: "clean" | "loudness",
    signal: AbortSignal,
  ) => Promise<{ before: Blob; after: Blob }>;
  makeShorts: (length: number) => void;
}

export const PREVIEW_SECONDS = 10;
const OVERLAY_SECONDS = 3;
const LOGO_SHARE = { S: 0.1, M: 0.16, L: 0.24 };

export function draftLines(
  d: CaptionDraft | null,
  itemId: number,
  range: Range | null,
  language: string,
): Segment[] | null {
  if (!d || d.itemId !== itemId || d.language !== language) return null;
  const had = d.range ?? { start: 0, end: Infinity };
  const want = range ?? { start: 0, end: Infinity };
  if (want.start < had.start - 0.05 || want.end > had.end + 0.05) return null;
  return d.segments
    .filter((s) => s.text.trim() && s.end > want.start && s.start < want.end)
    .map((s) => ({
      ...s,
      start: Math.max(s.start, want.start),
      end: Math.min(s.end, want.end),
      text: s.text.trim(),
    }));
}

export function captionMessage(stage: CaptionStage, f: number | null): string {
  const pct = f == null ? "" : ` ${Math.round(f * 100)}%`;
  return stage === "audio"
    ? "Pulling out the speech…"
    : stage === "download"
      ? `Getting the speech model (once)…${pct}`
      : stage === "speech"
        ? `Finding where people speak…${pct}`
        : `Listening…${pct}`;
}

interface Snapshot {
  recipe: Recipe;
  ranges: Record<number, Range>;
}
interface RunJob {
  item: Item;
  range: Range | null;
  name?: string;
}

const DeskContext = createContext<DeskValue | null>(null);
const IDLE_JOB: JobState = {
  ratio: null,
  message: "",
  secondsLeft: null,
  index: 0,
  count: 0,
};

function readMediaFacts(
  url: string,
  engine: "audio" | "video",
): Promise<{
  duration: number | null;
  width: number | null;
  height: number | null;
}> {
  return new Promise((resolve) => {
    const el = document.createElement(engine === "video" ? "video" : "audio");
    el.preload = "metadata";
    el.muted = true;
    let done = false;
    const finish = (duration: number | null) => {
      if (done) return;
      done = true;
      const v = el as HTMLVideoElement;
      resolve({
        duration,
        width: v.videoWidth || null,
        height: v.videoHeight || null,
      });
      el.removeAttribute("src");
      el.load();
    };
    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration) && el.duration > 0)
        return finish(el.duration);
      el.ondurationchange = () => {
        if (Number.isFinite(el.duration) && el.duration > 0)
          finish(el.duration);
      };
      try {
        el.currentTime = 1e7;
      } catch {
        /* ignore */
      }
    };
    el.onerror = () => finish(null);
    setTimeout(
      () =>
        finish(
          Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null,
        ),
      4000,
    );
    el.src = url;
  });
}

const isAbort = (e: unknown) => (e as Error)?.name === "AbortError";
const estimateOne = (
  engine: Engine,
  recipe: Recipe,
  facts: FileFacts,
  range: Range | null,
  music: boolean,
) => {
  const kind = outputKind(engine, recipe);
  return kind === "video"
    ? videoPlanFor(recipe, facts, range, music).estimate
    : kind === "text"
      ? Math.round(
          (range ? range.end - range.start : (facts.duration ?? 0)) * 20,
        )
      : estimateAudioBytes(recipe, facts, range);
};

const NO_AUDIO =
  /matches no streams|Stream specifier ':a'|does not contain any stream|Invalid stream specifier/i;

export function DeskProvider({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>("desk");
  const [items, setItems] = useState<Item[]>([]);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [toolId, setToolId] = useState<string | null>(null);
  const [preferred, setPreferred] = useState<string | null>(null);
  const [routeDefaults, setRouteDefaults] = useState<
    Partial<Recipe> | undefined
  >(undefined);
  const [recipe, setRecipeState] = useState<Recipe>(BASE_RECIPE);
  const [ranges, setRanges] = useState<Record<number, Range>>({});
  const [job, setJob] = useState<JobState>(IDLE_JOB);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const [restoring, setRestoring] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const sampleRef = useRef<AbortController | null>(null);
  const [measured, setMeasured] = useState<{
    key: string;
    bytes: number;
    seconds: number;
  } | null>(null);
  const [music, setMusic] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const jobIdRef = useRef(0);
  const resultUrlsRef = useRef<string[]>([]);
  const nextId = useRef(0);
  const sessionRef = useRef(0);
  const backRef = useRef<"edit" | "result">("edit");
  const [captionDraft, setCaptionDraft] = useState<CaptionDraft | null>(null);
  const [captionCheck, setCaptionCheck] = useState<CaptionCheck>({
    busy: false,
    message: "",
    error: null,
  });
  const history = useRef<{
    past: Snapshot[];
    future: Snapshot[];
    at: Snapshot | null;
  }>({ past: [], future: [], at: null });
  const resetHistory = () => {
    history.current = { past: [], future: [], at: null };
  };

  const sideRef = useRef<{ ac: AbortController; kind: SideJob } | null>(null);
  const [sideJob, setSideJob] = useState<SideJob | null>(null);
  const startSide = useCallback((kind: SideJob) => {
    sideRef.current?.ac.abort();
    sampleRef.current?.abort();
    sampleRef.current = null;
    const ac = new AbortController();
    sideRef.current = { ac, kind };
    setSideJob(kind);
    return ac;
  }, []);
  const endSide = useCallback((ac: AbortController) => {
    if (sideRef.current?.ac !== ac) return;
    sideRef.current = null;
    setSideJob(null);
  }, []);
  const stopSide = useCallback(() => {
    if (!sideRef.current) return;
    sideRef.current.ac.abort();
    sideRef.current = null;
    setSideJob(null);
  }, []);

  const file = items[0]?.file ?? null;
  const facts = items[0]?.facts ?? null;
  const batch = items.length > 1;

  const clearResult = useCallback(() => {
    resultUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    resultUrlsRef.current = [];
    setResults([]);
  }, []);

  const cancelJob = useCallback(() => {
    jobIdRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    setJob(IDLE_JOB);
  }, []);

  useEffect(() => {
    if (!file) {
      setSourceUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      resultUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  useEffect(() => {
    setRanges((prev) => {
      let next = prev;
      for (const it of items) {
        if (it.facts.duration && !prev[it.id]) {
          next = next === prev ? { ...prev } : next;
          next[it.id] = { start: 0, end: it.facts.duration };
        }
      }
      return next;
    });
  }, [items]);
  const range = items.length === 1 ? (ranges[items[0].id] ?? null) : null;

  const loadFacts = useCallback((item: Item) => {
    const engine = item.facts.engine;
    if (!engine) {
      setItems((list) =>
        list.map((it) => (it.id === item.id ? { ...it, ready: true } : it)),
      );
      return;
    }
    const session = sessionRef.current;
    const url = URL.createObjectURL(item.file);
    Promise.all([
      readMediaFacts(url, engine),
      detectCodecs(item.file).catch(() => null),
    ]).then(([media, codecs]) => {
      URL.revokeObjectURL(url);
      if (sessionRef.current !== session) return;
      setItems((list) =>
        list.map((it) =>
          it.id === item.id
            ? {
                ...it,
                ready: true,
                facts: {
                  ...it.facts,
                  ...media,
                  sampleRate: codecs?.sampleRate ?? null,
                  channels: codecs?.channels ?? null,
                },
              }
            : it,
        ),
      );
    });
  }, []);

  const openFiles = useCallback(
    (files: File[], mode: "replace" | "add" = "replace") => {
      const base = mode === "add" ? items : [];
      let engine = base[0]?.facts.engine ?? null;
      const fresh: Item[] = [];
      const notes: string[] = [];
      let firstError: string | null = null;
      let otherKind = 0;
      for (const f of files) {
        const ext = getExt(f.name);
        const e = engineFor(ext, f.type);
        const check = validateFile(f, e ?? "any");
        if (!check.ok) {
          firstError ??= check.error ?? "This file can't be used.";
          continue;
        }
        if (engine && e !== engine) {
          otherKind++;
          continue;
        }
        if (
          [...base, ...fresh].some(
            (it) => it.file.name === f.name && it.file.size === f.size,
          )
        )
          continue;
        if (base.length + fresh.length >= MAX_BATCH) {
          notes.push(`Up to ${MAX_BATCH} files at a time.`);
          break;
        }
        engine ??= e;
        if (check.warning) notes.push(check.warning);
        fresh.push({
          id: ++nextId.current,
          file: f,
          facts: {
            name: f.name,
            ext,
            size: f.size,
            engine: e,
            duration: null,
            width: null,
            height: null,
            sampleRate: null,
            channels: null,
          },
        });
      }
      if (otherKind)
        notes.unshift(
          `${otherKind} ${otherKind === 1 ? "file was" : "files were"} left out: one kind (audio or video) per batch.`,
        );
      if (!fresh.length) {
        setError(
          firstError ??
            (otherKind
              ? "A batch holds one kind of file: audio or video."
              : "Those files are already on the mat."),
        );
        return;
      }
      if (mode === "replace") {
        cancelJob();
        clearResult();
        stopSide();
        sessionRef.current++;
        setToolId(null);
        setMusic(null);
        setLogo(null);
        setCaptionDraft(null);
        setCaptionCheck({ busy: false, message: "", error: null });
        resetHistory();
        setStage("opening");
        setEntering(true);
      }
      if (mode === "replace") setRanges({});
      setError(
        firstError && fresh.length
          ? `Some files were skipped. ${firstError}`
          : null,
      );
      setWarning(notes.length ? Array.from(new Set(notes)).join(" ") : null);
      setItems([...base, ...fresh]);
      fresh.forEach(loadFacts);
    },
    [items, cancelJob, clearResult, loadFacts, stopSide],
  );

  const openFile = useCallback((f: File) => openFiles([f]), [openFiles]);
  const openFilesRef = useRef(openFiles);
  openFilesRef.current = openFiles;

  const tool = getTool(toolId);

  const removeItem = useCallback((id: number) => {
    setItems((list) => {
      const next = list.filter((it) => it.id !== id);
      if (!next.length) {
        setToolId(null);
        setStage("desk");
      }
      return next;
    });
  }, []);

  const editCtx = useMemo(
    () => ({
      engine: (facts?.engine ?? "audio") as Engine,
      music,
      logo,
      count: items.length,
      range: items.length === 1 ? (ranges[items[0].id] ?? null) : null,
      duration: facts?.duration ?? null,
    }),
    [facts, music, logo, items, ranges],
  );
  const editOn = useCallback(
    (key: string) => !!EDITS[key]?.on(recipe, editCtx),
    [recipe, editCtx],
  );

  const pickTool = useCallback(
    (name: string, turnOn = false) => {
      const t = getTool(name);
      if (!t) return;
      const key = toolKey(t);
      if (!facts) {
        setPreferred(key);
        setRouteDefaults(undefined);
        return;
      }
      setToolId(key);
      if (turnOn && EDITS[key] && !EDITS[key].on(recipe, editCtx))
        setRecipeState((r) => ({ ...r, ...toggle(key, true, r) }));
      setError(null);
      setStage("edit");
    },
    [facts, recipe, editCtx],
  );

  useEffect(() => {
    if (!entering || stage !== "opening") {
      if (entering && stage !== "opening") setEntering(false);
      return;
    }
    if (!items.length || !items.every((it) => it.ready)) return;
    setEntering(false);
    const first = fittingTools(items, preferred)[0];
    if (!first) return;
    const route = preferred === toolKey(first) ? first : null;
    setRecipeState(
      startRecipe(
        items[0].facts,
        loadPrefs(),
        route,
        route ? routeDefaults : undefined,
      ),
    );
    setToolId(toolKey(first));
    setError(null);
    setStage("edit");
  }, [entering, stage, items, preferred, routeDefaults]);

  const preselect = useCallback(
    (key: string | null, defaults?: Partial<Recipe>) => {
      const t = getTool(key);
      setPreferred(t ? toolKey(t) : key);
      setRouteDefaults(defaults);
    },
    [],
  );

  const setRecipe = useCallback((patch: Partial<Recipe>) => {
    setRecipeState((r) => {
      const next = { ...r, ...patch };
      if (next.format === "opus") next.sampleRate = 48000;
      return next;
    });
  }, []);

  useEffect(() => {
    if (stage !== "edit") return;
    const t = setTimeout(() => savePrefs(recipe), 400);
    return () => clearTimeout(t);
  }, [stage, recipe]);

  useEffect(() => {
    if (stage !== "edit") return;
    const h = history.current;
    if (!h.at) {
      h.at = { recipe, ranges };
      return;
    }
    if (h.at.recipe === recipe && h.at.ranges === ranges) return;
    const t = setTimeout(() => {
      h.past.push(h.at!);
      if (h.past.length > 100) h.past.shift();
      h.future = [];
      h.at = { recipe, ranges };
    }, 400);
    return () => clearTimeout(t);
  }, [stage, recipe, ranges]);
  const unsettled = () => {
    const h = history.current;
    return !!h.at && (h.at.recipe !== recipe || h.at.ranges !== ranges);
  };
  const step = useCallback(
    (dir: "undo" | "redo") => {
      const h = history.current;
      if (!h.at || stage !== "edit") return;
      if (h.at.recipe !== recipe || h.at.ranges !== ranges) {
        h.past.push(h.at);
        h.future = [];
        h.at = { recipe, ranges };
      }
      const to = dir === "undo" ? h.past.pop() : h.future.pop();
      if (!to) return;
      (dir === "undo" ? h.future : h.past).push(h.at);
      h.at = to;
      setRecipeState(to.recipe);
      setRanges(to.ranges);
    },
    [stage, recipe, ranges],
  );
  const undo = useCallback(() => step("undo"), [step]);
  const redo = useCallback(() => step("redo"), [step]);
  const canUndo =
    stage === "edit" && (history.current.past.length > 0 || unsettled());
  const canRedo =
    stage === "edit" && history.current.future.length > 0 && !unsettled();

  const moveItem = useCallback((id: number, by: -1 | 1) => {
    setItems((list) => {
      const i = list.findIndex((it) => it.id === id),
        j = i + by;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = list.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const firstId = items[0]?.id;
  const setRange = useCallback(
    (r: Range) => {
      if (firstId != null) setRanges((m) => ({ ...m, [firstId]: r }));
    },
    [firstId],
  );
  const setItemRange = useCallback(
    (id: number, r: Range) => setRanges((m) => ({ ...m, [id]: r })),
    [],
  );

  const setEdit = useCallback(
    (key: string, on: boolean) => {
      if (key === "video/music") {
        if (!on) setMusic(null);
        return;
      }
      if (key.endsWith("/trim")) {
        if (!on)
          setRanges(
            Object.fromEntries(
              items
                .filter((it) => it.facts.duration)
                .map((it) => [it.id, { start: 0, end: it.facts.duration! }]),
            ),
          );
        return;
      }
      setRecipeState((r) => {
        const next = { ...r, ...toggle(key, on, r) };
        if (next.format === "opus") next.sampleRate = 48000;
        return next;
      });
    },
    [items],
  );

  const engine: Engine = facts?.engine ?? "audio";
  const output = outputKind(engine, recipe);
  const merge = merging(engine, recipe, items.length);
  const fitting = useMemo(() => fittingTools(items, null), [items]);
  const edits = useMemo(
    () => activeEdits(recipe, editCtx, fitting),
    [recipe, editCtx, fitting],
  );
  const songUsed =
    engine === "video" && output === "video" && recipe.videoFormat !== "gif"
      ? music
      : null;

  const sampleKey =
    stage === "edit" &&
    !sideJob &&
    output === "video" &&
    engine === "video" &&
    items.length === 1 &&
    items[0].facts.duration &&
    items[0].file.size <= SAMPLE_MAX_BYTES &&
    !videoPlanFor(
      recipe,
      items[0].facts,
      ranges[items[0].id] ?? null,
      !!songUsed,
    ).job.targetVideoKbps
      ? JSON.stringify([
          items[0].id,
          recipe,
          ranges[items[0].id] ?? null,
          songUsed?.name ?? null,
        ])
      : null;
  useEffect(() => {
    if (!sampleKey) {
      sampleRef.current?.abort();
      sampleRef.current = null;
      return;
    }
    if (measured?.key === sampleKey) return;
    const it = items[0];
    const r = ranges[it.id] ?? null;
    const t = setTimeout(() => {
      sampleRef.current?.abort();
      const ac = new AbortController();
      sampleRef.current = ac;
      sampleVideo(it.file, recipe, it.facts, r, ac.signal, songUsed)
        .then(({ bytes, seconds }) => {
          if (!ac.signal.aborted)
            setMeasured({ key: sampleKey, bytes, seconds });
        })
        .catch(() => {
          /* keep the formula's guess */
        })
        .finally(() => {
          if (sampleRef.current === ac) sampleRef.current = null;
        });
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleKey]);

  const brewSeconds =
    sampleKey && measured?.key === sampleKey ? measured.seconds : null;
  const estimate = useMemo(() => {
    if (!items.length) return null;
    if (sampleKey && measured?.key === sampleKey) return measured.bytes;
    let sum = 0;
    for (const it of items) {
      const e = estimateOne(
        engine,
        recipe,
        it.facts,
        ranges[it.id] ?? null,
        !!songUsed,
      );
      if (e == null) return null;
      sum += e;
    }
    return sum;
  }, [items, engine, recipe, ranges, sampleKey, measured, songUsed]);

  const runJobs = useCallback(
    async (
      jobs: RunJob[],
      back: "edit" | "result",
      unit: "file" | "short",
      ac: AbortController,
      jobId: number,
    ): Promise<boolean> => {
      const stale = () => jobIdRef.current !== jobId;
      const n = jobs.length;
      const startedAt = performance.now();
      const out: BatchResult[] = [];
      const fresh: string[] = [];
      const notes = new Set<string>();
      const fail = (message: string | null) => {
        fresh.forEach((u) => URL.revokeObjectURL(u));
        setJob(IDLE_JOB);
        setStage(back);
        if (message) setError(message);
      };
      const keep = (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        fresh.push(url);
        return url;
      };

      let model: File | null = null;
      if (
        recipe.clean &&
        output !== "text" &&
        !(output === "video" && (recipe.videoFormat === "gif" || !recipe.sound))
      ) {
        try {
          model = await denoiseModel(recipe.denoise);
        } catch (e) {
          if (!stale()) fail((e as Error).message);
          return false;
        }
      }

      for (let i = 0; i < n; i++) {
        const { item: it, range: r } = jobs[i];
        const onProgress = (ratio: number | null, message: string) => {
          if (stale()) return false;
          const overall =
            ratio == null ? (i > 0 ? i / n : null) : (i + ratio) / n;
          let secondsLeft: number | null = null;
          if (overall != null && overall > 0.03 && overall < 1) {
            const elapsed = (performance.now() - startedAt) / 1000;
            secondsLeft = (elapsed / overall) * (1 - overall);
          }
          setJob({
            ratio: overall,
            message,
            secondsLeft,
            index: i,
            count: n,
            unit,
          });
        };
        try {
          const song = songUsed;
          const follows =
            output === "video" &&
            recipe.follow &&
            (recipe.frame === "crop" ||
              (recipe.frame === "social" && recipe.fill === "crop"));
          let track: TrackKey[] | null = null;
          if (follows && it.facts.duration) {
            setJob({
              ratio: null,
              message: "Looking for faces…",
              secondsLeft: null,
              index: i,
              count: n,
              unit,
            });
            track = await trackFaces(
              it.file,
              r ?? { start: 0, end: it.facts.duration },
              ac.signal,
              (f) => {
                if (!stale())
                  setJob({
                    ratio: null,
                    message: `Looking for faces… ${Math.round(f * 100)}%`,
                    secondsLeft: null,
                    index: i,
                    count: n,
                    unit,
                  });
              },
            );
            if (stale()) return false;
          }

          let faces: FaceBox[][] | null = null;
          if (output === "video" && recipe.blurFaces && it.facts.duration) {
            const say = (f: number | null) =>
              setJob({
                ratio: null,
                message: `Finding every face…${f == null ? "" : ` ${Math.round(f * 100)}%`}`,
                secondsLeft: null,
                index: i,
                count: n,
                unit,
              });
            say(null);
            const found = await trackAllFaces(
              it.file,
              r ?? { start: 0, end: it.facts.duration },
              ac.signal,
              (f) => {
                if (!stale()) say(f);
              },
            );
            if (stale()) return false;
            faces = found.length ? found : null;
            notes.add(
              found.length
                ? "Faces are found by AI and it can miss some. Watch the whole video before you share it."
                : "No faces were found, so nothing was blurred. Check the video before you share it.",
            );
          }

          let segments: Segment[] | null = null;
          const burning =
            output === "video" &&
            recipe.captions &&
            recipe.videoFormat !== "gif";
          const cutting = output === "video" && (recipe.textCut || recipe.fillers);
          const checked =
            burning || cutting
              ? draftLines(captionDraft, it.id, r, recipe.language)
              : null;
          if (checked) {
            segments = checked;
            if (burning && !segments.length)
              throw new Error(
                "Every caption line is empty. Type the words back in, or switch Captions off to export without them.",
              );
          } else if (burning || cutting || output === "text") {
            const heard = await transcribe(
              it.file,
              r,
              ac.signal,
              (stage, f) => {
                if (!stale())
                  setJob({
                    ratio: stage === "listen" ? f : null,
                    message: captionMessage(stage, f),
                    secondsLeft: null,
                    index: i,
                    count: n,
                    unit,
                  });
              },
              recipe.language,
              recipe.speechModel,
            );
            if (stale()) return false;
            segments = heard.segments;
            if (!segments.length && burning)
              throw new Error(
                "No speech was found in this video, so there are no captions to add. Switch Captions off to export without them.",
              );
          }
          const base =
            jobs[i].name ?? (it.facts.name.replace(/\.[^/.]+$/, "") || "clip");
          if (output === "text") {
            if (!segments?.length)
              throw new Error("No speech was found in this file.");
            const fmt = recipe.transcriptFormat,
              shift = -(r?.start ?? 0);
            const body =
              fmt === "srt"
                ? toSRT(segments, shift)
                : fmt === "vtt"
                  ? toVTT(segments, shift)
                  : `${toText(segments)}\n`;
            const blob = new Blob([body], {
              type: fmt === "vtt" ? "text/vtt" : "text/plain",
            });
            out.push({
              item: it,
              out: {
                blob,
                url: keep(blob),
                filename: `${base}.${fmt}`,
                size: blob.size,
                duration: r ? r.end - r.start : it.facts.duration,
                text: toText(segments),
              },
              error: null,
            });
            continue;
          }

          let cuts: Range[] | null = null;
          if (output === "video" && recipe.trimSilence && it.facts.duration) {
            setJob({
              ratio: null,
              message: "Finding the pauses…",
              secondsLeft: null,
              index: i,
              count: n,
              unit,
            });
            const env = await loudness(it.file, ac.signal);
            if (stale()) return false;
            const span = r ?? { start: 0, end: it.facts.duration };
            const kept = env ? keepSpans(env, span, recipe.silence) : [span];
            cuts =
              kept.length === 1 &&
              kept[0].start === span.start &&
              kept[0].end === span.end
                ? null
                : kept;
          }
          if (cutting && it.facts.duration) {
            const gone = [
              ...(recipe.textCut && captionDraft?.itemId === it.id
                ? (captionDraft.removed ?? [])
                : []),
              ...(recipe.fillers && segments
                ? fillerRanges(segments, recipe.language)
                : []),
            ];
            if (recipe.fillers && !segments?.some((s) => s.words?.length))
              notes.add(
                "Filler words need word timings, and this transcript has none, so none were cut.",
              );
            if (gone.length) {
              const span = r ?? { start: 0, end: it.facts.duration };
              cuts = removeRanges(cuts ?? [span], gone);
              if (!cuts.length)
                throw new Error(
                  "Those cuts remove the whole video. Keep some of the words.",
                );
            }
          }
          const dims = videoPlanFor(recipe, it.facts, r, !!song).dims ?? {
            w: 1280,
            h: 720,
          };
          const span = cuts
            ? keptSeconds(cuts)
            : r
              ? r.end - r.start
              : (it.facts.duration ?? 0);
          const finalLength = span / (recipe.speed || 1);
          const words = recipe.overlayText.trim();
          const marking =
            output === "video" &&
            recipe.overlayOn &&
            recipe.videoFormat !== "gif";
          const showing = marking && !!words;
          const stamping = marking && !!logo;
          const planJob = (rec: Recipe) => {
            const job = videoPlanFor(rec, it.facts, r, !!song).job;
            if (faces) job.blur = faces;
            if (showing || stamping)
              job.overlay = {
                text: showing ? { file: "" } : null,
                logo: stamping
                  ? {
                      file: "",
                      width: Math.round(dims.w * LOGO_SHARE[rec.logoSize]),
                      corner: rec.logoCorner,
                    }
                  : null,
              };
            if (track && job.frame) job.frame = { ...job.frame, track };
            if (cuts) {
              job.cuts = cuts;
              if (job.music)
                job.music = {
                  ...job.music,
                  duration: keptSeconds(cuts) / (rec.speed || 1),
                };
            }
            return job;
          };
          const plan = output === "video" ? planJob(recipe) : null;
          const look = {
            style: recipe.captionStyle,
            color: recipe.captionColor,
            size: recipe.captionSize,
            pos: recipe.captionPos,
          };
          const shift = plan && !trimsInGraph(plan) ? (plan.trimStart ?? 0) : 0;
          const marks =
            showing || stamping
              ? {
                  text: showing
                    ? new File(
                        [
                          overlayASS(
                            words,
                            recipe.overlayPlace,
                            dims.w,
                            dims.h,
                            shift +
                              (recipe.overlayWhen === "end"
                                ? Math.max(0, finalLength - OVERLAY_SECONDS)
                                : 0),
                            shift +
                              (recipe.overlayWhen === "start"
                                ? OVERLAY_SECONDS
                                : finalLength + 1),
                            recipe.language,
                          ),
                        ],
                        "overlay.ass",
                      )
                    : null,
                  logo: stamping ? logo : null,
                }
              : null;
          const script =
            burning && segments?.length && plan
              ? new File(
                  [
                    toASS(
                      segments,
                      look,
                      dims.w,
                      dims.h,
                      filterClock(plan),
                      recipe.language,
                    ),
                  ],
                  "captions.ass",
                )
              : null;
          const written = [
            ...(script ? (segments ?? []).map((s) => s.text) : []),
            ...(showing ? [words] : []),
          ];
          const fonts = written.length
            ? await Promise.all(
                fontsFor(written, recipe.language).map((f) =>
                  loadFile(`/fonts/${f.file}`, f.file),
                ),
              )
            : [];
          const run = (rec: Recipe) =>
            output === "video"
              ? processVideo(
                  it.file,
                  planJob(rec),
                  { width: it.facts.width, height: it.facts.height },
                  onProgress,
                  ac.signal,
                  song,
                  model,
                  script,
                  marks,
                  fonts,
                )
              : processAudio(
                  it.file,
                  audioJob(rec, it.facts, r),
                  onProgress,
                  ac.signal,
                  model,
                );
          let res;
          try {
            res = await run(recipe);
          } catch (e) {
            if (
              song &&
              recipe.musicMode === "mix" &&
              !isAbort(e) &&
              NO_AUDIO.test((e as Error)?.message ?? "")
            )
              res = await run({ ...recipe, musicMode: "replace" });
            else throw e;
          }
          if (stale()) return false;
          const filename = jobs[i].name
            ? `${jobs[i].name}.${res.filename.split(".").pop()}`
            : res.filename;
          let extras: { name: string; blob: Blob; label: string }[] | undefined;
          if (burning && segments?.length && plan) {
            const at = outputClock(plan);
            const timed = segments.flatMap((sg) => {
              const a = at(sg.start) ?? at(sg.end),
                b = at(sg.end) ?? a;
              return a != null && b != null && b > a
                ? [{ ...sg, start: a, end: b }]
                : [];
            });
            extras = [
              {
                name: `${base}.srt`,
                blob: new Blob([toSRT(timed)], { type: "text/plain" }),
                label: "captions .srt",
              },
            ];
          }
          const length = cuts
            ? keptSeconds(cuts) / (recipe.speed || 1)
            : r
              ? r.end - r.start
              : it.facts.duration;
          out.push({
            item: it,
            out: {
              blob: res.blob,
              url: keep(res.blob),
              filename,
              size: res.blob.size,
              duration: length,
              extras,
            },
            error: null,
          });
        } catch (e) {
          if (stale()) return false;
          if (isAbort(e)) {
            fail(null);
            return false;
          }
          const message =
            (e as Error)?.message || "That didn't brew. Try again.";
          if (n === 1) {
            fail(message);
            return false;
          }
          out.push({ item: it, out: null, error: message });
        }
      }
      if (!out.some((r) => r.out)) {
        fail(out[0]?.error ?? "That didn't brew. Try again.");
        return false;
      }
      resultUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      resultUrlsRef.current = fresh;
      setResults(out);
      setJob(IDLE_JOB);
      setStage("result");
      if (notes.size) setNotice(Array.from(notes).join(" "));
      return true;
    },
    [recipe, output, songUsed, captionDraft, logo],
  );

  const claimEncoder = useCallback(() => {
    sampleRef.current?.abort();
    sampleRef.current = null;
    stopSide();
    setCaptionCheck((c) =>
      c.busy ? { busy: false, message: "", error: null } : c,
    );
    const jobId = ++jobIdRef.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    return { jobId, ac };
  }, [stopSide]);

  const brew = useCallback(async () => {
    if (!items.length || stage === "brewing") return;
    if (
      items.some((it) => {
        const x = ranges[it.id];
        return x && x.end - x.start < 0.05;
      })
    ) {
      setError("Pick a longer piece.");
      return;
    }
    clearResult();
    const { jobId, ac } = claimEncoder();
    const stale = () => jobIdRef.current !== jobId;
    const n = items.length;
    backRef.current = "edit";
    setNotice(null);
    setError(null);
    setJob({
      ratio: null,
      message: "Warming up…",
      secondsLeft: null,
      index: 0,
      count: n,
    });
    setStage("brewing");

    if (merge) {
      const startedAt = performance.now();
      try {
        const onMergeProgress = (ratio: number | null, message: string) => {
          if (stale()) return;
          let secondsLeft: number | null = null;
          if (ratio != null && ratio > 0.03 && ratio < 1)
            secondsLeft =
              ((performance.now() - startedAt) / 1000 / ratio) * (1 - ratio);
          setJob({ ratio, message, secondsLeft, index: 0, count: 1 });
        };
        const lengths = items.map((it) => {
          const x = ranges[it.id];
          return x ? x.end - x.start : it.facts.duration;
        });
        let mergedLength: number | null = null;
        const res =
          engine === "video"
            ? await (async () => {
                if (lengths.some((l) => !l))
                  throw new Error(
                    "The length of one of these videos couldn't be read, so it can't be merged. Convert it to MP4 first.",
                  );
                const whole = items.map((it) => ({
                  start: ranges[it.id]?.start ?? 0,
                  end: ranges[it.id]?.end ?? it.facts.duration!,
                }));
                let clips: MergeClip[] = items.map((it, i) => ({
                  file: it.file,
                  start: whole[i].start,
                  length: whole[i].end - whole[i].start,
                }));
                let songFrom = 0;
                if (recipe.beatSync) {
                  if (!music)
                    throw new Error(
                      "Cutting on the beat needs a song. Pick one in Add music.",
                    );
                  onMergeProgress(null, "Listening for the beat…");
                  const wav = await processAudio(
                    music,
                    { outputFormat: "wav", sampleRate: 8000, channels: 1 },
                    undefined,
                    ac.signal,
                  );
                  const beats = beatTimes(
                    wavSamples(await wav.blob.arrayBuffer()),
                    8000,
                  );
                  const cut = beatPieces(beats, whole);
                  if (cut.length < 2)
                    throw new Error(
                      "No steady beat was found in this song. Try another, or switch off Cut on the beat.",
                    );
                  songFrom = beats[0];
                  clips = cut.map((p) => ({
                    file: items[p.clip].file,
                    start: p.start,
                    length: p.end - p.start,
                  }));
                }
                const seconds = clips.reduce((n, c) => n + c.length, 0);
                const bytes = items.reduce((n, it) => n + it.file.size, 0);
                const plan = videoMergePlan(
                  recipe,
                  items[0].facts,
                  seconds,
                  bytes,
                );
                const cross = recipe.beatSync ? null : plan.transition;
                mergedLength =
                  seconds -
                  (cross
                    ? overlapFor(
                        cross,
                        clips.map((c) => c.length),
                      ) *
                      (clips.length - 1)
                    : 0);
                const untouched = items.every(
                  (it, i) =>
                    whole[i].start <= 0.01 &&
                    Math.abs(whole[i].end - it.facts.duration!) < 0.1,
                );
                const sameSize = items.every((it) => {
                  const d = outputDims(recipe.size, it.facts);
                  return (
                    d &&
                    !d.scaled &&
                    it.facts.width === items[0].facts.width &&
                    it.facts.height === items[0].facts.height
                  );
                });
                const allowCopy =
                  untouched &&
                  !!sameSize &&
                  !cross &&
                  !music &&
                  !recipe.beatSync &&
                  recipe.sound &&
                  recipe.videoFormat === "mp4" &&
                  !plan.targetVideoKbps &&
                  items.every((it) => ["mp4", "m4v", "mov"].includes(it.facts.ext));
                return mergeVideo(
                  clips,
                  {
                    ...plan,
                    transition: cross,
                    fit: recipe.mergeFit,
                  },
                  music
                    ? {
                        file: music,
                        volume: recipe.musicVolume,
                        originalVolume:
                          recipe.beatSync || recipe.musicMode === "replace"
                            ? 0
                            : recipe.originalVolume,
                        from: songFrom,
                      }
                    : null,
                  allowCopy,
                  onMergeProgress,
                  ac.signal,
                );
              })()
            : await mergeAudio(
                items.map((it) => it.file),
                items.map((it) => ranges[it.id] ?? null),
                audioJob(recipe, items[0].facts, null),
                onMergeProgress,
                ac.signal,
                lengths,
              );
        if (stale()) return;
        const url = URL.createObjectURL(res.blob);
        resultUrlsRef.current.push(url);
        const known = lengths.reduce<number>((t, l) => t + (l ?? 0), 0);
        const duration =
          mergedLength ??
          known -
            (engine === "audio"
              ? overlapFor(
                  recipe.crossfade,
                  lengths.map((l) => l ?? 0),
                ) *
                (items.length - 1)
              : 0);
        const base = items[0].facts.name.replace(/\.[^/.]+$/, "") || "merged";
        setResults([
          {
            item: items[0],
            out: {
              blob: res.blob,
              url,
              filename: `${base}-merged.${engine === "video" ? recipe.videoFormat : recipe.format}`,
              size: res.blob.size,
              duration,
            },
            error: null,
          },
        ]);
        setJob(IDLE_JOB);
        setStage("result");
      } catch (e) {
        if (stale()) return;
        setJob(IDLE_JOB);
        setStage("edit");
        if (!isAbort(e))
          setError((e as Error)?.message || "That didn't brew. Try again.");
      }
      return;
    }
    await runJobs(
      items.map((it) => ({ item: it, range: ranges[it.id] ?? null })),
      "edit",
      "file",
      ac,
      jobId,
    );
  }, [
    items,
    stage,
    ranges,
    recipe,
    merge,
    engine,
    music,
    clearResult,
    claimEncoder,
    runJobs,
  ]);

  const makeShorts = useCallback(
    async (length: number) => {
      if (items.length !== 1 || stage !== "result") return;
      const it = items[0];
      const { jobId, ac } = claimEncoder();
      const stale = () => jobIdRef.current !== jobId;
      backRef.current = "result";
      setNotice(null);
      setError(null);
      setJob({
        ratio: null,
        message: "Listening for the good bits…",
        secondsLeft: null,
        index: 0,
        count: 3,
        unit: "short",
      });
      setStage("brewing");
      let picks: { start: number; end: number }[] = [];
      try {
        const env = await loudness(it.file, ac.signal);
        if (stale()) return;
        picks = env ? goodBits(env, length, 3) : [];
      } catch (e) {
        if (stale()) return;
        setJob(IDLE_JOB);
        setStage("result");
        if (!isAbort(e))
          setError("Couldn't listen to this file to find the good bits.");
        return;
      }
      if (!picks.length) {
        setJob(IDLE_JOB);
        setStage("result");
        setError("There's no lively part to cut shorts from.");
        return;
      }
      const d = it.facts.duration ?? Infinity;
      const base = it.facts.name.replace(/\.[^/.]+$/, "") || "clip";
      const jobs = picks
        .slice()
        .sort((a, b) => a.start - b.start)
        .map((p, k) => ({
          item: it,
          range: { start: p.start, end: Math.min(d, p.end) },
          name: `${base}-short-${k + 1}`,
        }));
      const ok = await runJobs(jobs, "result", "short", ac, jobId);
      if (ok && jobs.length < 3) {
        setNotice(
          `Only ${jobs.length === 1 ? "one part was" : "two parts were"} lively enough for a ${length} s short${jobs.length === 1 ? "" : " each"}. A longer video, or a shorter length, gives more.`,
        );
      }
    },
    [items, stage, claimEncoder, runJobs],
  );

  const stop = useCallback(() => {
    cancelJob();
    if (backRef.current === "result") {
      setStage("result");
      return;
    }
    clearResult();
    setStage("edit");
  }, [cancelJob, clearResult]);
  const tweak = useCallback(() => {
    clearResult();
    setNotice(null);
    setStage("edit");
  }, [clearResult]);
  const newFile = useCallback(() => {
    cancelJob();
    clearResult();
    stopSide();
    sessionRef.current++;
    setItems([]);
    setRanges({});
    setToolId(null);
    setMusic(null);
    setLogo(null);
    setCaptionDraft(null);
    setCaptionCheck({ busy: false, message: "", error: null });
    resetHistory();
    setError(null);
    setWarning(null);
    setNotice(null);
    setStage("desk");
    savedFiles.current.clear();
    clearSession();
  }, [cancelJob, clearResult, stopSide]);
  const toDesk = useCallback(() => {
    if (stage === "brewing") return;
    setError(null);
    setStage("desk");
  }, [stage]);
  const resume = useCallback(() => {
    if (!items.length || !toolId) return;
    setError(null);
    setStage(results.some((r) => r.out) ? "result" : "edit");
  }, [items.length, toolId, results]);

  const result = results.find((r) => r.out)?.out ?? null;
  const download = useCallback(
    (index?: number) => {
      const r = index == null ? result : results[index]?.out;
      if (r && !downloadBlob(r.blob, r.filename))
        setError("The browser blocked the download.");
    },
    [result, results],
  );

  const firstItem = items.length === 1 ? items[0] : null;
  const captionLines = firstItem
    ? draftLines(
        captionDraft,
        firstItem.id,
        ranges[firstItem.id] ?? null,
        recipe.language,
      )
    : null;
  const checkCaptions = useCallback(async () => {
    if (!firstItem || stage !== "edit") return;
    const r = ranges[firstItem.id] ?? null,
      language = recipe.language,
      id = firstItem.id;
    const ac = startSide("captions");
    setCaptionCheck({
      busy: true,
      message: "Pulling out the speech…",
      error: null,
    });
    try {
      const heard = await transcribe(
        firstItem.file,
        r,
        ac.signal,
        (st, f) => {
          if (!ac.signal.aborted)
            setCaptionCheck({
              busy: true,
              message: captionMessage(st, f),
              error: null,
            });
        },
        language,
        recipe.speechModel,
      );
      if (ac.signal.aborted) return;
      setCaptionDraft(
        heard.segments.length
          ? { itemId: id, language, range: r, segments: heard.segments }
          : null,
      );
      setCaptionCheck({
        busy: false,
        message: "",
        error: heard.segments.length
          ? null
          : "No speech was found in this video.",
      });
    } catch (e) {
      if (!ac.signal.aborted)
        setCaptionCheck({
          busy: false,
          message: "",
          error: isAbort(e)
            ? null
            : (e as Error)?.message || "Couldn't listen to this video.",
        });
    } finally {
      endSide(ac);
    }
  }, [
    firstItem,
    stage,
    ranges,
    recipe.language,
    recipe.speechModel,
    startSide,
    endSide,
  ]);
  const stopCheck = useCallback(() => {
    if (sideRef.current?.kind === "captions") stopSide();
    setCaptionCheck({ busy: false, message: "", error: null });
  }, [stopSide]);
  const setCaptionLine = useCallback((index: number, text: string) => {
    setCaptionDraft(
      (d) =>
        d && {
          ...d,
          segments: d.segments.map((s, i) =>
            i === index ? { start: s.start, end: s.end, text } : s,
          ),
        },
    );
  }, []);
  const toggleCut = useCallback((word: Range) => {
    setCaptionDraft(
      (d) => d && { ...d, removed: toggleRange(d.removed ?? [], word) },
    );
  }, []);
  const clearCuts = useCallback(() => {
    setCaptionDraft((d) => d && { ...d, removed: [] });
  }, []);
  const importCaptions = useCallback(
    async (f: File) => {
      if (!firstItem) return;
      const segments = parseSubtitles(await f.text());
      if (!segments.length) {
        setCaptionCheck({
          busy: false,
          message: "",
          error: "No captions were found in that file. Use an .srt or .vtt file.",
        });
        return;
      }
      setCaptionDraft({
        itemId: firstItem.id,
        language: recipe.language,
        range: null,
        segments,
      });
      setCaptionCheck({ busy: false, message: "", error: null });
    },
    [firstItem, recipe.language],
  );
  const translateCaptions = useCallback(
    async (to: string) => {
      const draft = captionDraft;
      if (!draft) return;
      const ac = startSide("captions");
      const source = draft.original ?? draft.segments;
      const say = (f: number | null) =>
        setCaptionCheck({
          busy: true,
          message: `Translating…${f == null ? "" : ` ${Math.round(f * 100)}%`}`,
          error: null,
        });
      say(null);
      try {
        const texts = await translateLines(
          source.map((s) => s.text),
          recipe.language,
          to,
          ac.signal,
          (f) => {
            if (!ac.signal.aborted) say(f);
          },
        );
        if (ac.signal.aborted) return;
        setCaptionDraft({
          ...draft,
          original: source,
          segments: source.map((s, i) => ({
            start: s.start,
            end: s.end,
            text: texts[i],
          })),
        });
        setCaptionCheck({ busy: false, message: "", error: null });
      } catch (e) {
        if (!ac.signal.aborted)
          setCaptionCheck({
            busy: false,
            message: "",
            error: isAbort(e)
              ? null
              : (e as Error)?.message || "Couldn't translate these captions.",
          });
      } finally {
        endSide(ac);
      }
    },
    [captionDraft, recipe.language, startSide, endSide],
  );
  const restoreCaptions = useCallback(() => {
    setCaptionDraft(
      (d) =>
        d?.original ? { ...d, segments: d.original, original: undefined } : d,
    );
  }, []);

  const previewAB = useCallback(
    async (kind: "clean" | "loudness", signal: AbortSignal) => {
      if (!firstItem?.facts.duration)
        throw new Error("This file has no length to sample.");
      const d = firstItem.facts.duration;
      const r = ranges[firstItem.id] ?? { start: 0, end: d };
      const len = Math.min(PREVIEW_SECONDS, r.end - r.start);
      const start = r.start + (r.end - r.start - len) / 2;
      const window = { start, end: start + len };
      const plain: Recipe = {
        ...recipe,
        format: "wav",
        speed: 1,
        fadeIn: 0,
        fadeOut: 0,
        trimSilence: false,
        clean: false,
        loudness: "off",
      };
      const changed: Recipe =
        kind === "clean"
          ? { ...plain, clean: true }
          : {
              ...plain,
              loudness: recipe.loudness === "off" ? "voice" : recipe.loudness,
            };
      const ac = startSide("preview");
      const onAbort = () => ac.abort();
      signal.addEventListener("abort", onAbort, { once: true });
      try {
        const model =
          kind === "clean" ? await denoiseModel(recipe.denoise) : null;
        const before = await processAudio(
          firstItem.file,
          audioJob(plain, firstItem.facts, window),
          undefined,
          ac.signal,
        );
        const after = await processAudio(
          firstItem.file,
          audioJob(changed, firstItem.facts, window),
          undefined,
          ac.signal,
          model,
        );
        return { before: before.blob, after: after.blob };
      } finally {
        signal.removeEventListener("abort", onAbort);
        endSide(ac);
      }
    },
    [firstItem, ranges, recipe, startSide, endSide],
  );

  const downloadAll = useCallback(() => {
    const ok = results
      .filter((r) => r.out)
      .map((r) => ({ name: r.out!.filename, blob: r.out!.blob }));
    if (!ok.length) return;
    zipBlobs(ok)
      .then((zip) => {
        if (!downloadBlob(zip, `clipmint-${ok.length}-files.zip`))
          setError("The browser blocked the download.");
      })
      .catch(() =>
        setError("Couldn't pack the zip. Download the files one by one."),
      );
  }, [results]);

  const savedFiles = useRef(new Set<string>());
  const savedResults = useRef<BatchResult[] | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const shared = await takeSharedFiles();
      if (!live) return;
      if (shared.length) {
        await clearSession();
        setRestoring(false);
        openFilesRef.current(shared);
        return;
      }
      const st = await loadState();
      if (!live) return;
      if (!st || st.v !== 1 || !st.items?.length) {
        setRestoring(false);
        return;
      }
      const restored: Item[] = [];
      for (const it of st.items) {
        const blob = await getFile(`item:${it.id}`);
        if (blob)
          restored.push({
            id: it.id,
            file: new File([blob], it.facts.name, { type: blob.type }),
            facts: it.facts,
            ready: true,
          });
      }
      const songBlob = st.music ? await getFile("music") : null;
      const logoBlob = st.logo ? await getFile("logo") : null;
      let res: BatchResult[] = [];
      if (st.stage === "result") {
        for (let i = 0; i < st.results.length; i++) {
          const r = st.results[i];
          const item = restored.find((x) => x.id === r.itemId);
          if (!item) continue;
          if (!r.out) {
            res.push({ item, out: null, error: r.error });
            continue;
          }
          const blob = await getFile(`result:${i}`);
          if (!blob) {
            res = [];
            break;
          }
          const extras: { name: string; label: string; blob: Blob }[] = [];
          for (let k = 0; k < (r.out.extras?.length ?? 0); k++) {
            const b = await getFile(`extra:${i}:${k}`);
            if (b) extras.push({ ...r.out.extras![k], blob: b });
          }
          res.push({
            item,
            error: null,
            out: {
              ...r.out,
              blob,
              url: "",
              extras: extras.length ? extras : undefined,
            },
          });
        }
      }
      if (!live) return;
      if (!restored.length) {
        setRestoring(false);
        clearSession();
        return;
      }
      restored.forEach((it) => savedFiles.current.add(`item:${it.id}`));
      nextId.current = Math.max(nextId.current, ...restored.map((it) => it.id));
      for (const r of res)
        if (r.out) {
          r.out.url = URL.createObjectURL(r.out.blob);
          resultUrlsRef.current.push(r.out.url);
        }
      savedResults.current = res;
      setItems(restored);
      setRanges(st.ranges ?? {});
      setRecipeState({ ...BASE_RECIPE, ...st.recipe });
      const t = getTool(st.toolId); // tools folded into "Export" come back as Export
      setToolId(t ? toolKey(t) : null);
      if (st.captions && restored.some((it) => it.id === st.captions!.itemId))
        setCaptionDraft(st.captions);
      if (songBlob && st.music)
        setMusic(new File([songBlob], st.music.name, { type: songBlob.type }));
      if (logoBlob && st.logo)
        setLogo(new File([logoBlob], st.logo.name, { type: logoBlob.type }));
      setResults(res);
      setStage(res.some((r) => r.out) ? "result" : "edit");
      setRestoring(false);
    })().catch(() => {
      if (live) setRestoring(false);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (restoring) return;
    const want = new Set(items.map((it) => `item:${it.id}`));
    for (const it of items) {
      const k = `item:${it.id}`;
      if (!savedFiles.current.has(k)) {
        savedFiles.current.add(k);
        putFile(k, it.file);
      }
    }
    for (const k of Array.from(savedFiles.current))
      if (k.startsWith("item:") && !want.has(k)) {
        savedFiles.current.delete(k);
        dropFile(k);
      }
  }, [items, restoring]);
  useEffect(() => {
    if (restoring) return;
    if (music) putFile("music", music);
    else dropFile("music");
  }, [music, restoring]);
  useEffect(() => {
    if (restoring) return;
    if (logo) putFile("logo", logo);
    else dropFile("logo");
  }, [logo, restoring]);
  useEffect(() => {
    if (restoring || savedResults.current === results) return;
    savedResults.current = results;
    dropResults().then(() =>
      results.forEach((r, i) => {
        if (!r.out) return;
        putFile(`result:${i}`, r.out.blob);
        r.out.extras?.forEach((x, k) => putFile(`extra:${i}:${k}`, x.blob));
      }),
    );
  }, [results, restoring]);
  useEffect(() => {
    if (restoring) return;
    if (!items.length) {
      if (stage === "desk") clearSession();
      return;
    }
    if (!toolId || entering) return;
    const t = setTimeout(() => {
      const st: DeskState = {
        v: 1,
        items: items.map((it) => ({ id: it.id, facts: it.facts })),
        ranges,
        recipe,
        toolId,
        stage: stage === "result" ? "result" : "edit",
        music: music ? { name: music.name } : null,
        logo: logo ? { name: logo.name } : null,
        captions: captionDraft,
        results:
          stage === "result"
            ? results.map((r) => ({
                itemId: r.item.id,
                error: r.error,
                out: r.out && {
                  filename: r.out.filename,
                  size: r.out.size,
                  duration: r.out.duration,
                  text: r.out.text,
                  extras: r.out.extras?.map((x) => ({
                    name: x.name,
                    label: x.label,
                  })),
                },
              }))
            : [],
      };
      saveState(st);
    }, 300);
    return () => clearTimeout(t);
  }, [
    restoring,
    items,
    ranges,
    recipe,
    toolId,
    stage,
    music,
    logo,
    results,
    entering,
    captionDraft,
  ]);

  const value: DeskValue = {
    stage,
    restoring,
    output,
    merge,
    edits,
    editOn,
    setEdit,
    entering,
    items,
    batch,
    file,
    sourceUrl,
    facts,
    tool,
    preferred,
    recipe,
    range,
    ranges,
    estimate,
    brewSeconds,
    music,
    setMusic,
    logo,
    setLogo,
    moveItem,
    job,
    result,
    results,
    error,
    warning,
    notice,
    openFile,
    openFiles,
    removeItem,
    pickTool,
    preselect,
    setRecipe,
    setRange,
    setItemRange,
    brew,
    stop,
    tweak,
    newFile,
    toDesk,
    resume,
    download,
    downloadAll,
    undo,
    redo,
    canUndo,
    canRedo,
    captionDraft,
    captionLines,
    captionCheck,
    checkCaptions,
    stopCheck,
    setCaptionLine,
    toggleCut,
    clearCuts,
    importCaptions,
    translateCaptions,
    restoreCaptions,
    previewAB,
    makeShorts,
  };
  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}

export function useDesk() {
  const ctx = useContext(DeskContext);
  if (!ctx) throw new Error("useDesk must be used inside DeskProvider");
  return ctx;
}

function fittingTools(items: Item[], preferred: string | null): Tool[] {
  const facts = items[0]?.facts;
  if (!facts) return [];
  const s = suggestionsFor(facts, preferred, items.length);
  return [s.main, ...s.others].filter(
    (t): t is Tool => !!t && items.every((it) => accepts(t, it.facts)),
  );
}

export { toolKey };
