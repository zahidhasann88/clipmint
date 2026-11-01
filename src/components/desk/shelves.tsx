"use client";
import { Icon } from "./icons";
import { getShelf, type Tool } from "@/lib/registry";
import { cn } from "@/lib/utils";

export function Sticker({
  tool,
  onClick,
  pressed,
  disabled,
  variant = "shelf",
  className,
  on,
}: {
  tool: Tool;
  onClick?: () => void;
  pressed?: boolean;
  disabled?: boolean;
  variant?: "shelf" | "alt";
  className?: string;
  on?: boolean;
}) {
  const shelf = getShelf(tool.shelf);
  const alt = variant === "alt";
  if (tool.soon) {
    return (
      <span className="inline-flex min-h-tap items-center gap-2 rounded-sticker border-2 border-dashed border-edge py-[5px] pl-[5px] pr-3.5 text-[15px] font-extrabold text-ink-soft">
        <span
          aria-hidden="true"
          className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-icon-well"
        >
          <Icon name={tool.icon} size={18} strokeWidth={2.1} />
        </span>
        {tool.name}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      disabled={disabled}
      className={cn(
        "sticker inline-flex flex-none items-center gap-2 whitespace-nowrap border-2 border-edge font-extrabold text-ink",
        alt
          ? "min-h-12 rounded-[15px_18px_15px_13px] bg-card-on-mat py-[5px] pl-1.5 pr-4 text-[15px] text-on-card-on-mat shadow-on-mat"
          : "min-h-tap rounded-sticker py-[5px] pl-[5px] pr-3.5 text-[15px] shadow-sticker max-sm:pl-1 max-sm:pr-3 max-sm:text-sm",
        pressed &&
          "!translate-x-[2px] !translate-y-[3px] !shadow-none outline outline-[3px] outline-offset-2 outline-primary",
        disabled && "opacity-50",
        className,
      )}
      style={alt ? undefined : { background: shelf.tint }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid place-items-center",
          alt
            ? "h-[34px] w-[34px] rounded-[11px]"
            : "h-[30px] w-[30px] rounded-[10px] bg-icon-well max-sm:h-7 max-sm:w-7",
        )}
        style={
          alt ? { background: shelf.tint, color: "var(--ink)" } : undefined
        }
      >
        <Icon name={tool.icon} size={alt ? 19 : 18} strokeWidth={2.1} />
      </span>
      {tool.name}
      {on && (
        <span className="-mr-1.5 grid h-5 w-5 place-items-center rounded-full border-2 border-edge bg-primary text-on-primary">
          <Icon name="check" size={12} strokeWidth={3.2} />
          <span className="sr-only"> (on)</span>
        </span>
      )}
    </button>
  );
}
