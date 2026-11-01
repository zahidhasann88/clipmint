"use client";
import { useEffect, useRef } from "react";
import { Sticker } from "./shelves";
import {
  TOOLS,
  accepts,
  toolKey,
  type FileFacts,
  type Tool,
} from "@/lib/registry";

export function ToolStrip({
  files,
  current,
  onPick,
  isOn,
}: {
  files: FileFacts[];
  current: Tool;
  onPick: (key: string) => void;
  isOn: (key: string) => boolean;
}) {
  const tools = TOOLS.filter(
    (t) =>
      !t.soon &&
      (!t.multi || files.length > 1) &&
      files.every((f) => accepts(t, f)),
  );
  const listRef = useRef<HTMLDivElement>(null);
  const key = toolKey(current);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [key]);

  if (tools.length < 2) return null;
  return (
    <nav aria-label="Tools for this file" className="w-full">
      <div
        ref={listRef}
        className="flex flex-wrap gap-2.5 max-sm:-mx-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-4 max-sm:pb-1.5 max-sm:pt-0.5 max-sm:[scrollbar-width:none]"
      >
        {tools.map((t) => (
          <Sticker
            key={toolKey(t)}
            tool={t}
            pressed={toolKey(t) === key}
            on={isOn(toolKey(t))}
            onClick={() => toolKey(t) !== key && onPick(toolKey(t))}
          />
        ))}
      </div>
    </nav>
  );
}
