import type { Config } from "tailwindcss";

// Every color is a CSS variable from src/styles/tokens.css. The default Tailwind
// palette is replaced (not extended), so a stray `bg-red-500` cannot slip in.
const v = (name: string) => `var(--${name})`;
const tokens = [
  "bg", "surface", "paper", "primary", "on-primary", "primary-soft", "accent", "on-accent",
  "wood", "wood-dark", "ink", "ink-soft", "edge", "mat", "on-mat", "pill", "tint-audio", "tint-video",
  "tint-rose", "tint-stone", "wave-off", "line", "icon-well", "track", "recipe-bg", "card-on-mat",
  "on-card-on-mat", "mat-edge", "mat-chip", "mat-border", "on-mat-soft", "on-mat-muted", "selection",
  "film", "film-dim", "overlay", "sheet-grab", "lamp-bg", "lamp-ink", "sign", "ruler", "note", "on-primary-accent",
  "ill-line", "ill-cream", "ill-forest", "ill-oat", "ill-paper",
];

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      ...Object.fromEntries(tokens.map((t) => [t, v(t)])),
    },
    extend: {
      fontFamily: {
        display: ["var(--font-display)"],
        ui: ["var(--font-ui)"],
        hand: ["var(--font-hand)"],
        // The font burned into captions (public/fonts), so the preview matches the export.
        caption: ['"Atkinson Hyperlegible"', "var(--font-ui)"],
      },
      borderRadius: {
        sticker: "var(--r-sticker)",
        button: "var(--r-button)",
        panel: "var(--r-panel)",
        mat: "var(--r-mat)",
        card: "var(--r-card)",
        blob: "var(--r-blob)",
      },
      boxShadow: {
        sticker: "var(--shadow-sticker)",
        card: "var(--shadow-card)",
        mat: "var(--shadow-mat)",
        "on-mat": "3px 4px 0 var(--mat-edge)",
        "on-mat-lg": "5px 6px 0 var(--mat-edge)",
        lamp: "2px 3px 0 var(--edge), var(--lamp-halo)",
      },
      maxWidth: { desk: "var(--max-w)" },
      minHeight: { tap: "var(--tap)" },
      minWidth: { tap: "var(--tap)" },
      transitionTimingFunction: { spring: "var(--spring)" },
    },
  },
  plugins: [],
};
export default config;
