export function cn(...classes: (string | false | null | undefined | Record<string, boolean>)[]) {
  return classes
    .flatMap(c => {
      if (!c) return [];
      if (typeof c === "string") return [c];
      if (typeof c === "object") return Object.entries(c).filter(([,v])=>v).map(([k])=>k);
      return [];
    })
    .join(" ");
}
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g,"_").slice(0,100) || "output";
}
export function getExt(name: string): string { return name.split(".").pop()?.toLowerCase() || ""; }
