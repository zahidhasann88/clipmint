"use client";
import { Books, BrewMug } from "./art";
import { Icon } from "./icons";
import type { Item, JobState } from "./desk-state";
import {
  getShelf,
  type FileFacts,
  type Recipe,
  type Tool,
} from "@/lib/registry";
import type { ActiveEdit } from "@/lib/edits";
import {
  LOSSLESS,
  clockTenths,
  outputDims,
  timeLeft,
  turned,
  type Range,
} from "@/media/recipe";
import { cn } from "@/lib/utils";
import { bytesLabel, useNetStats } from "@/lib/net-meter";

const STEPS = ["drop", "edit", "brew · export", "download"];

type Output = "audio" | "video" | "text";

export function outputName(facts: FileFacts, output: Output, recipe: Recipe) {
  const base = facts.name.replace(/\.[^/.]+$/, "") || "clip";
  return {
    base,
    ext:
      output === "video"
        ? recipe.videoFormat
        : output === "text"
          ? recipe.transcriptFormat
          : recipe.format,
  };
}

export function recipeStamps(
  output: Output,
  recipe: Recipe,
  facts: FileFacts,
  range: Range | null,
  edits: ActiveEdit[] = [],
): string[] {
  const trimmed =
    range &&
    facts.duration &&
    (range.start > 0.05 || range.end < facts.duration - 0.05);
  const span = trimmed
    ? `${clockTenths(range!.start)} → ${clockTenths(range!.end)}`
    : null;
  const on = edits
    .filter(
      (e) =>
        !e.skipped &&
        !e.key.endsWith("/trim") &&
        !e.key.endsWith("/gif") &&
        !e.key.endsWith("/extract") &&
        !e.key.endsWith("/transcribe"),
    )
    .map((e) => e.label);
  let base: (string | null)[];
  if (output === "text")
    base = [`.${recipe.transcriptFormat}`, "speech → text", "on this device"];
  else if (output === "video" && recipe.videoFormat === "gif")
    base = ["GIF", `${recipe.gifWidth} px`, `${recipe.gifFps} fps`, "loop"];
  else if (output === "video") {
    const dims =
      recipe.frame === "social"
        ? null
        : outputDims(recipe.size, turned(facts, recipe));
    base = [
      recipe.videoFormat.toUpperCase(),
      recipe.frame === "social"
        ? null
        : dims
          ? `${Math.min(dims.w, dims.h)}p`
          : recipe.size,
      recipe.squeeze === "chat"
        ? "chat · 25 MB"
        : recipe.squeeze === "email"
          ? "email · 10 MB"
          : null,
    ];
  } else {
    base = [
      recipe.format.toUpperCase(),
      LOSSLESS.includes(recipe.format) ? null : `${recipe.bitrate} kbps`,
      recipe.format === "opus"
        ? "48 kHz"
        : `${+(recipe.sampleRate / 1000).toFixed(1)} kHz`,
      recipe.channels === 1 ? "mono" : "stereo",
    ];
  }
  return [...base, ...on, span].filter((x): x is string => !!x);
}

export function BrewingMat({
  job,
  tool,
  recipe,
  facts,
  range,
  onStop,
  items = [],
  output,
  edits = [],
}: {
  job: JobState;
  tool: Tool;
  recipe: Recipe;
  facts: FileFacts;
  range: Range | null;
  onStop: () => void;
  items?: Item[];
  output: Output;
  edits?: ActiveEdit[];
}) {
  const pct = job.ratio != null ? Math.round(job.ratio * 100) : null;
  const { uploaded } = useNetStats();
  const { base, ext } = outputName(facts, output, recipe);
  const many = items.length > 1;
  const shorts = job.unit === "short";
  const left =
    [
      many || shorts
        ? `${shorts ? "short" : "file"} ${job.index + 1} of ${job.count}`
        : null,
      timeLeft(job.secondsLeft),
    ]
      .filter(Boolean)
      .join(" · ") || null;
  return (
    <>
      <section
        aria-label="Brewing"
        className="mat relative flex min-h-[680px] min-w-0 flex-[999_1_600px] flex-col items-center gap-[18px] p-[30px_clamp(18px,3vw,40px)_36px] max-sm:min-h-0 max-sm:gap-3.5 max-sm:p-[20px_16px_26px]"
      >
        <ol
          aria-label="Steps"
          className="m-0 flex list-none flex-wrap items-center justify-center gap-y-2 p-0"
        >
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === 2 ? "step" : undefined}
              className="flex items-center"
            >
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-extrabold",
                  i < 2
                    ? "bg-mat-chip"
                    : i === 2
                      ? "bg-accent text-on-accent"
                      : "",
                )}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="w-[22px] border-t-2 border-dashed border-mat-border max-sm:w-3"
                />
              )}
            </li>
          ))}
        </ol>

        <div className="mt-2">
          <BrewMug level={job.ratio} />
        </div>

        <p className="m-0 -mt-1.5 text-center">
          <span className="block font-display text-[96px] font-extrabold leading-[0.9] tracking-[-0.05em] tabular-nums max-sm:text-[72px]">
            {pct != null ? `${pct}%` : "…"}
          </span>
          <span className="mt-2 block text-base font-extrabold text-on-mat-soft">
            {left ?? (pct != null ? "steeping…" : job.message)}
          </span>
        </p>

        <div
          role="progressbar"
          aria-label={
            many ? `Brewing ${items.length} files` : `Brewing ${base}.${ext}`
          }
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? undefined}
          aria-valuetext={
            pct != null ? `${pct}%${left ? `, ${left}` : ""}` : job.message
          }
          className="relative h-11 w-full max-w-[560px] overflow-hidden rounded-[12px_14px_12px_10px] border-2 border-ill-line bg-ruler shadow-on-mat"
        >
          <div
            className={cn(
              "ruler-fill anim-march absolute inset-y-0 left-0 border-r-2 border-ill-line transition-[width] duration-500",
              pct == null && "opacity-60",
            )}
            style={{ width: `${pct ?? 100}%` }}
          />
          <div
            aria-hidden="true"
            className="ruler-ticks absolute inset-x-0 top-0 h-3.5"
          />
          <div
            aria-hidden="true"
            className="ruler-ticks-lg absolute inset-x-0 top-0 h-[22px]"
          />
        </div>

        <button
          type="button"
          onClick={onStop}
          className="inline-flex min-h-[50px] items-center gap-2.5 rounded-[16px_18px_16px_14px] border-2 border-on-mat bg-transparent pl-4 pr-[22px] text-[17px] font-extrabold text-on-mat"
        >
          <Icon name="close" strokeWidth={2.6} />
          Stop
        </button>

        <p className="m-0 mt-1 inline-flex items-center gap-2 text-center font-hand text-[26px] font-bold text-accent max-sm:text-[22px]">
          <Icon name="home" size={22} />
          brewing right here, on your device
        </p>
        <p
          className="m-0 -mt-3 text-sm font-extrabold tabular-nums text-on-mat-soft"
          aria-live="off"
        >
          {bytesLabel(uploaded)} uploaded so far
        </p>
      </section>

      <aside
        aria-label="On the stove"
        className="flex flex-[1_1_300px] flex-col gap-4 rounded-panel bg-surface p-6 max-sm:p-5"
      >
        <h2 className="m-0 font-hand text-[30px] font-bold leading-none">
          on the stove
        </h2>
        <p className="m-0 -mt-2 text-sm font-bold text-ink-soft">
          {shorts ? "cutting shorts" : "being exported"}, on this device
        </p>
        {many ? (
          <ol
            aria-label="Files"
            className="m-0 flex max-h-[260px] list-none flex-col gap-2 overflow-y-auto p-0"
          >
            {items.map((it, i) => {
              const o = outputName(it.facts, output, recipe);
              const state =
                i < job.index
                  ? "done"
                  : i === job.index
                    ? "brewing"
                    : "waiting";
              return (
                <li
                  key={it.id}
                  aria-current={state === "brewing" ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[14px] border-2 bg-paper px-3 py-2 text-sm font-extrabold",
                    state === "brewing" ? "border-edge" : "border-transparent",
                    state === "waiting" && "opacity-60",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-6 w-6 flex-none place-items-center rounded-full text-xs",
                      state === "done"
                        ? "bg-primary text-on-primary"
                        : "bg-surface",
                    )}
                  >
                    {state === "done" ? "✓" : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {o.base}
                    <span className="text-primary">.{o.ext}</span>
                  </span>
                  <span className="sr-only">{state}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="flex items-center gap-3 rounded-[18px] border-2 border-edge bg-paper p-3.5">
            <span
              aria-hidden="true"
              className="grid h-11 w-11 flex-none place-items-center rounded-xl text-ink"
              style={{ background: getShelf(tool.shelf).tint }}
            >
              <Icon
                name={getShelf(tool.shelf).icon}
                size={22}
                strokeWidth={2}
              />
            </span>
            <p className="m-0 min-w-0 text-[15px] font-extrabold [overflow-wrap:anywhere]">
              {base}
              <span className="text-primary">.{ext}</span>
            </p>
          </div>
        )}
        <ul
          aria-label="Recipe"
          className="m-0 flex list-none flex-wrap gap-2 p-0"
        >
          {recipeStamps(output, recipe, facts, many ? null : range, edits).map(
            (t, i) => (
              <li
                key={t}
                className="rounded-[10px] border-2 border-dashed border-primary px-3 py-[7px] text-sm font-extrabold text-primary"
                style={{
                  transform: `rotate(${[-2, 1.5, -1, 2, -1.5][i % 5]}deg)`,
                }}
              >
                {t}
              </li>
            ),
          )}
        </ul>
        <Books className="mt-auto self-end max-sm:hidden" />
      </aside>
    </>
  );
}
