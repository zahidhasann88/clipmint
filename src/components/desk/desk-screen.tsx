"use client";
import { useEffect, useRef, useState } from "react";
import { useDesk, type Stage } from "./desk-state";
import { DeskHeader, PhoneBar } from "./header";
import { LampToggle } from "./lamp";
import { DropMat } from "./mat";
import { BatchMat, BatchResultMat } from "./batch";
import { AudioEditMat, VideoEditMat } from "./edit";
import { RecipeCard } from "./recipe";
import { BrewingMat } from "./brew";
import { ResultMat } from "./result";
import { ToolStrip } from "./tool-strip";
import { Sparkle, type IconName } from "./icons";
import { ShortcutsDialog, isTyping, modKey } from "./shortcuts";
import {
  ASPECT_RATIO,
  PLATFORMS,
  getShelf,
  getTool,
  toolKey,
  type Recipe,
} from "@/lib/registry";
import { EDITS, toggle } from "@/lib/edits";
import { clock, formatSize } from "@/media/recipe";
import { SOURCE_URL } from "@/lib/site";
import { useCapabilities } from "@/lib/capabilities";
import { memoryNote } from "@/media/memory";
import { lengthsFor } from "@/media/highlights";
import { cn } from "@/lib/utils";

const STAGE_NAME: Record<Stage, string> = {
  desk: "The desk",
  opening: "Opening your file",
  edit: "Recipe",
  brewing: "Brewing",
  result: "Ready",
};

function DeskFooter() {
  const license = "Free & open source (MIT)";
  return (
    <footer className="relative mx-auto mt-[clamp(10px,2vh,22px)] flex max-w-desk flex-wrap justify-center gap-x-2 gap-y-1 text-[13px] font-bold text-ink-soft max-sm:hidden">
      <span>© {new Date().getFullYear()} Clipmint</span>
      <span aria-hidden="true">·</span>
      {SOURCE_URL ? (
        <a href={SOURCE_URL} className="text-ink-soft">
          {license}
        </a>
      ) : (
        <span>{license}</span>
      )}
    </footer>
  );
}

export function DeskScreen({
  tool: routeTool = null,
  defaults,
  label,
  icon,
}: {
  tool?: string | null;
  defaults?: Partial<Recipe>;
  label?: string;
  icon?: IconName;
}) {
  const d = useDesk();
  const [keysOpen, setKeysOpen] = useState(false);
  const caps = useCapabilities();
  const unsupported =
    caps && (!caps.wasm || !caps.simd)
      ? "This browser can't run the encoder. Update to Chrome/Edge 91+, Firefox 114+ or Safari 16.4+."
      : null;
  const mainRef = useRef<HTMLElement>(null);
  const prevStage = useRef<Stage | null>(null);

  const { preselect } = d;
  useEffect(() => {
    preselect(routeTool, defaults);
  }, [routeTool, defaults, preselect]);

  useEffect(() => {
    if (prevStage.current && prevStage.current !== d.stage) {
      window.scrollTo({ top: 0 });
      mainRef.current?.focus({ preventScroll: true });
    }
    prevStage.current = d.stage;
  }, [d.stage]);

  const { stage, undo, redo, brew } = d;
  useEffect(() => {
    if (stage !== "edit") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const k = e.key.toLowerCase();
      if (modKey(e) && !e.altKey) {
        if (k === "z" && !isTyping(e.target)) {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (k === "y" && !isTyping(e.target)) {
          e.preventDefault();
          redo();
        } else if (k === "enter") {
          e.preventDefault();
          brew();
        }
        return;
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !isTyping(e.target)) {
        e.preventDefault();
        setKeysOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, undo, redo, brew]);

  const facts = d.facts;
  const tool = d.tool;
  const totalBytes = d.items.reduce((n, it) => n + it.file.size, 0);
  const memo = memoryNote(caps, {
    engine: facts?.engine ?? null,
    totalBytes,
    count: d.items.length,
    gifSeconds:
      d.output === "video" && d.recipe.videoFormat === "gif"
        ? d.range
          ? d.range.end - d.range.start
          : (facts?.duration ?? null)
        : null,
  });

  let header: React.ReactNode;
  let body: React.ReactNode;

  switch (d.stage) {
    case "desk": {
      header = <DeskHeader page="desk" />;
      const edits = d.edits.filter((e) => !e.skipped).length;
      body = (
        <DropMat
          onFiles={(f) => d.openFiles(f)}
          error={d.error ?? unsupported}
          warning={d.warning}
          pill={(() => {
            const t = routeTool ? getTool(routeTool) : null;
            if (!t) return null;
            const shelf = getShelf(t.shelf);
            return {
              name: label ?? t.name,
              icon: icon ?? t.icon,
              shelf: shelf.name,
              tint: shelf.tint,
            };
          })()}
          resume={
            d.items.length && d.tool && facts
              ? {
                  name: d.batch ? `${d.items.length} files` : facts.name,
                  detail:
                    [
                      edits
                        ? `${edits} ${edits === 1 ? "edit" : "edits"}`
                        : null,
                      d.results.some((r) => r.out) ? "ready to download" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "no edits yet",
                  onResume: d.resume,
                  onDiscard: d.newFile,
                }
              : null
          }
        />
      );
      break;
    }
    case "opening":
      header = <DeskHeader page="desk" onHome={d.toDesk} />;
      body = facts && (
        <section
          aria-label="The mat"
          className="mat flex min-h-[320px] flex-1 flex-col items-center justify-center gap-4 p-8 text-center lg:min-h-0"
        >
          {d.entering ? (
            <p
              role="status"
              className="m-0 font-hand text-[30px] font-bold text-accent"
            >
              opening {d.batch ? `${d.items.length} files` : facts.name}…
            </p>
          ) : (
            <>
              <p
                role="alert"
                className="m-0 font-hand text-[30px] font-bold text-accent"
              >
                no tool takes this file yet
              </p>
              <button
                type="button"
                onClick={d.newFile}
                className="min-h-tap rounded-button border-2 border-ill-line bg-accent px-5 text-base font-extrabold text-on-accent"
              >
                Pick another file
              </button>
            </>
          )}
        </section>
      );
      break;
    case "edit": {
      if (!facts || !tool || !d.file) break;
      const shelf = getShelf(tool.shelf);
      const Mat = facts.engine === "video" ? VideoEditMat : AudioEditMat;
      header = (
        <DeskHeader
          page="desk"
          onHome={d.toDesk}
          crumbs={{
            shelf: shelf.name,
            tool: tool.name,
            tint: shelf.tint,
            onDesk: d.toDesk,
          }}
          phone={
            <PhoneBar
              onBack={d.toDesk}
              title={
                d.batch ? (
                  <p className="m-0 truncate font-display text-[19px] font-extrabold tracking-[-0.02em]">
                    {d.items.length} files
                  </p>
                ) : (
                  <h1 className="m-0 truncate font-display text-[19px] font-extrabold tracking-[-0.02em]">
                    {facts.name}
                  </h1>
                )
              }
              detail={
                d.batch
                  ? formatSize(d.items.reduce((n, it) => n + it.file.size, 0))
                  : [
                      facts.ext.toUpperCase(),
                      facts.duration != null ? clock(facts.duration) : null,
                      formatSize(facts.size),
                    ]
                      .filter(Boolean)
                      .join(" · ")
              }
              pill={{ text: tool.name, tint: shelf.tint }}
            />
          }
        />
      );
      body = (
        <>
          <ToolStrip
            files={d.items.map((it) => it.facts)}
            current={tool}
            onPick={(k) => d.pickTool(k)}
            isOn={d.editOn}
          />
          {d.batch ? (
            <BatchMat
              items={d.items}
              ranges={d.ranges}
              tool={tool}
              onAdd={(f) => d.openFiles(f, "add")}
              onRemove={d.removeItem}
              onRange={d.setItemRange}
              onMove={d.merge ? d.moveItem : undefined}
            />
          ) : (
            <Mat
              file={d.file}
              url={d.sourceUrl}
              facts={facts}
              range={d.range}
              onRange={d.setRange}
              onFiles={(f) => d.openFiles(f)}
              fades={
                d.recipe.fadeIn > 0 || d.recipe.fadeOut > 0
                  ? { in: d.recipe.fadeIn, out: d.recipe.fadeOut }
                  : undefined
              }
              view={{
                rotate: d.recipe.rotate,
                flip: d.recipe.flip,
                frame:
                  d.recipe.frame === "crop" ||
                  (tool.id === "crop" && d.recipe.frame === "none")
                    ? {
                        aspect: ASPECT_RATIO[d.recipe.aspect],
                        pos: d.recipe.cropPos,
                      }
                    : d.recipe.frame === "social" && d.recipe.fill === "crop"
                      ? {
                          aspect:
                            PLATFORMS[d.recipe.platform].width /
                            PLATFORMS[d.recipe.platform].height,
                          pos: 0.5,
                        }
                      : undefined,
                captions:
                  d.output === "video" &&
                  d.recipe.videoFormat !== "gif" &&
                  (tool.id === "captions" ||
                    (d.recipe.captions && d.captionLines?.length))
                    ? {
                        look: {
                          style: d.recipe.captionStyle,
                          color: d.recipe.captionColor,
                          size: d.recipe.captionSize,
                          pos: d.recipe.captionPos,
                        },
                        lines: d.captionLines?.length ? d.captionLines : null,
                        aspect:
                          d.recipe.frame === "social"
                            ? PLATFORMS[d.recipe.platform].width /
                              PLATFORMS[d.recipe.platform].height
                            : null,
                      }
                    : undefined,
              }}
            />
          )}
          <RecipeCard
            tool={tool}
            output={d.output}
            recipe={d.recipe}
            set={d.setRecipe}
            facts={facts}
            estimate={d.estimate}
            error={d.error}
            onBrew={d.brew}
            before={totalBytes}
            note={memo}
            brewSeconds={d.brewSeconds}
            brewLabel={d.merge ? "Merge" : d.batch ? "Brew all" : "Brew it"}
            history={{
              canUndo: d.canUndo,
              canRedo: d.canRedo,
              undo: d.undo,
              redo: d.redo,
            }}
            extras={{
              music: d.music,
              setMusic: d.setMusic,
              logo: d.logo,
              setLogo: d.setLogo,
              file: d.file,
              range: d.range,
              setRange: d.setRange,
              ...(d.batch
                ? {}
                : {
                    captions: {
                      draft: d.captionDraft,
                      lines: d.captionLines,
                      check: d.captionCheck,
                      onCheck: d.checkCaptions,
                      onStop: d.stopCheck,
                      onLine: d.setCaptionLine,
                      onImport: d.importCaptions,
                      onTranslate: d.translateCaptions,
                      onRestore: d.restoreCaptions,
                      onToggleCut: d.toggleCut,
                      onClearCuts: d.clearCuts,
                    },
                    preview: facts.duration ? d.previewAB : undefined,
                  }),
            }}
            edit={
              EDITS[toolKey(tool)]
                ? {
                    on: d.editOn(toolKey(tool)),
                    toggle: (on) => d.setEdit(toolKey(tool), on),
                    own: EDITS[toolKey(tool)].own ?? [],
                    enable: toggle(toolKey(tool), true, d.recipe),
                    switchable: !!EDITS[toolKey(tool)].enable,
                  }
                : null
            }
            edits={d.edits}
            onOpen={(k) => d.pickTool(k)}
            onRemove={(k) => d.setEdit(k, false)}
          />
        </>
      );
      break;
    }
    case "brewing":
      header = <DeskHeader page="desk" quiet />;
      body = facts && tool && (
        <BrewingMat
          job={d.job}
          tool={tool}
          recipe={d.recipe}
          facts={facts}
          range={d.job.unit === "short" ? null : d.range}
          onStop={d.stop}
          items={d.merge ? [] : d.items}
          output={d.output}
          edits={d.edits}
        />
      );
      break;
    case "result":
      header = (
        <DeskHeader
          page="desk"
          onHome={d.toDesk}
          phone={
            <PhoneBar
              onBack={d.tweak}
              end={<LampToggle />}
              title={
                <p
                  aria-hidden="true"
                  className="m-0 flex items-center gap-2 font-display text-[34px] font-extrabold tracking-[-0.04em]"
                >
                  <Sparkle size={26} color="var(--accent)" />
                  Ready
                </p>
              }
            />
          }
        />
      );
      body =
        facts &&
        tool &&
        d.result &&
        ((d.batch || d.results.length > 1) && !d.merge ? (
          <BatchResultMat
            results={d.results}
            onDownload={d.download}
            onDownloadAll={d.downloadAll}
            onTweak={d.tweak}
            onNew={d.newFile}
            error={d.error}
            notice={d.notice}
          />
        ) : (
          <ResultMat
            result={d.result}
            output={d.output}
            recipe={d.recipe}
            facts={d.merge ? { ...facts, size: totalBytes } : facts}
            onDownload={() => d.download()}
            onTweak={d.tweak}
            onNew={d.newFile}
            error={d.error}
            notice={d.notice}
            shorts={
              !d.batch && d.output === "video"
                ? {
                    lengths: lengthsFor(facts.duration).filter(
                      (l) => facts.duration! >= l * 2,
                    ),
                    vertical:
                      d.recipe.frame === "social" ||
                      (d.recipe.frame === "crop" && d.recipe.aspect === "9:16"),
                    onMake: d.makeShorts,
                  }
                : undefined
            }
          />
        ));
      break;
  }

  const fit = d.stage === "desk" || d.stage === "opening";
  return (
    <div
      className={cn(
        fit && "lg:flex lg:h-[calc(100dvh-48px)] lg:min-h-[540px] lg:flex-col",
      )}
    >
      {header}
      <p className="sr-only" role="status" aria-live="polite">
        {prevStage.current ? STAGE_NAME[d.stage] : ""}
      </p>
      <main
        ref={mainRef}
        id="main"
        tabIndex={-1}
        aria-label={STAGE_NAME[d.stage]}
        className={cn(
          "relative mx-auto mt-[30px] flex max-w-desk flex-wrap gap-6 outline-none max-sm:mt-3.5 max-sm:gap-3.5",
          d.stage === "edit" ? "items-start sm:mt-[26px]" : "items-stretch",
          fit &&
            "lg:mt-[clamp(14px,2.6vh,30px)] lg:min-h-0 lg:w-full lg:flex-1 lg:flex-nowrap",
        )}
      >
        {(d.stage === "opening" || d.stage === "brewing") && (
          <h1 className="sr-only">{STAGE_NAME[d.stage]}</h1>
        )}
        {body}
      </main>
      {d.stage === "desk" && <DeskFooter />}
      <ShortcutsDialog open={keysOpen} onClose={() => setKeysOpen(false)} />
    </div>
  );
}
