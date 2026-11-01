
const c = (t: string) => `var(--${t})`;
const LINE = c("ill-line");

export function DropArt({ className, width = 210 }: { className?: string; width?: number }) {
  return (
    <svg className={className} width={width} height={(width * 150) / 210} viewBox="0 0 210 150" aria-hidden="true" focusable="false">
      <g transform="rotate(-10 70 60)">
        <rect x="34" y="18" width="74" height="86" rx="12" fill={c("ill-mustard")} stroke={LINE} strokeWidth="2.4" />
        <path d="M62 74V44l26-5v29M62 74a6 6 0 1 1 -12 0a6 6 0 1 1 12 0M88 68a6 6 0 1 1 -12 0a6 6 0 1 1 12 0" fill="none" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
      </g>
      <g transform="rotate(9 140 60)">
        <rect x="104" y="14" width="78" height="90" rx="12" fill={c("ill-wood")} stroke={LINE} strokeWidth="2.4" />
        <rect x="118" y="34" width="50" height="40" rx="5" fill={c("ill-cream")} stroke={LINE} strokeWidth="2.4" />
        <path d="M112 26h6M112 84h6M168 26h6M168 84h6M112 40h4M112 70h4" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
        <path d="M138 46v16l12-8z" fill={LINE} />
      </g>
      <path d="M16 86h178l-14 56H30z" fill={c("ill-beige")} stroke={LINE} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M78 112c8 7 46 7 54 0" fill="none" stroke={LINE} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function MatMug({ className }: { className?: string }) {
  return (
    <svg className={className} width="112" height="112" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <path className="anim-steam" d="M50 34c-7-6 7-11 0-20" fill="none" stroke={c("ill-wood")} strokeWidth="3" strokeLinecap="round" />
      <path className="anim-steam delay-b" d="M66 34c-7-6 7-11 0-20" fill="none" stroke={c("ill-wood")} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="60" cy="104" rx="38" ry="6" fill={c("shadow-drop")} />
      <path d="M28 44h58v34a22 22 0 0 1 -22 22H50a22 22 0 0 1 -22 -22z" fill={c("ill-mustard")} transform="translate(4 4)" />
      <path d="M86 52h6a12 12 0 0 1 0 24h-7" fill="none" stroke={LINE} strokeWidth="3" />
      <path d="M28 44h58v34a22 22 0 0 1 -22 22H50a22 22 0 0 1 -22 -22z" fill="none" stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      <path d="M48 78c0-9 7-15 16-15 0 9-7 15-16 15z" fill={c("ill-sage")} stroke={LINE} strokeWidth="2" />
    </svg>
  );
}

export function BrewMug({ level }: { level: number | null }) {
  const top = 236 - (level ?? 0.12) * 132;
  return (
    <svg width="300" height="300" viewBox="0 0 300 300" aria-hidden="true" focusable="false" className="h-auto max-w-full max-sm:w-[220px]">
      <defs><clipPath id="cup-in"><path d="M74 96h152v96a50 50 0 0 1 -50 50h-52a50 50 0 0 1 -50 -50z" /></clipPath></defs>
      {[118, 150, 182].map((x, i) => (
        <path key={x} className={`anim-steam-tall ${["", "delay-b", "delay-c"][i]}`} d={`M${x} 82c-12-10 12-18 0-34s12-20 0-30`} fill="none" stroke={c("ill-cream")} strokeWidth="4" strokeLinecap="round" opacity=".85" />
      ))}
      <ellipse cx="150" cy="268" rx="104" ry="12" fill={c("ill-shade")} opacity=".45" />
      <path d="M66 92h168v100a58 58 0 0 1 -58 58h-52a58 58 0 0 1 -58 -58z" fill={c("ill-mustard")} transform="translate(7 7)" />
      <path d="M66 92h168v100a58 58 0 0 1 -58 58h-52a58 58 0 0 1 -58 -58z" fill={c("ill-paper")} stroke={LINE} strokeWidth="4" strokeLinejoin="round" />
      <g clipPath="url(#cup-in)">
        <g style={{ transform: `translateY(${top - 150}px)`, transition: "transform .6s ease" }}>
          <g className="anim-slosh"><path d="M40 150c20-8 40-8 60 0s40 8 60 0 40-8 60 0 40 8 60 0V400H40z" fill={c("ill-sage-light")} /></g>
          <path d="M60 200h180v200H60z" fill={c("ill-sage")} opacity=".35" />
        </g>
      </g>
      <g style={{ transform: `translateY(${Math.min(70, top - 150)}px)`, transition: "transform .6s ease" }}>
        <path className="anim-leaf" d="M138 150c0-14 10-22 24-22 0 14-10 22-24 22z" fill={c("ill-forest")} stroke={LINE} strokeWidth="2.4" />
      </g>
      <path d="M234 112h14a30 30 0 0 1 0 60h-16" fill="none" stroke={LINE} strokeWidth="4" strokeLinecap="round" />
      <path d="M66 92h168" stroke={LINE} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Books({ className }: { className?: string }) {
  return (
    <svg className={className} width="160" height="80" viewBox="0 0 160 80" aria-hidden="true" focusable="false">
      <rect x="18" y="56" width="128" height="18" rx="4" fill={c("ill-forest")} stroke={LINE} strokeWidth="2.4" />
      <rect x="28" y="38" width="112" height="18" rx="4" fill={c("ill-mustard")} stroke={LINE} strokeWidth="2.4" />
      <rect x="12" y="20" width="120" height="18" rx="4" fill={c("ill-wood")} stroke={LINE} strokeWidth="2.4" />
      <path d="M30 29h40M44 47h50M34 65h30" stroke={LINE} strokeWidth="2" strokeLinecap="round" opacity=".5" />
    </svg>
  );
}

export function FallingLeaves() {
  const L = (x: number, y: number, s: number, fill: string, cls: string, op = 1) => (
    <path className={`anim-fall ${cls}`} d={`M${x} ${y}c0-${s * 0.6} ${s * 0.45}-${s} ${s * 1.05}-${s} 0 ${s * 0.6}-${s * 0.45} ${s}-${s * 1.05} ${s}z`} fill={fill} opacity={op} />
  );
  return (
    <svg aria-hidden="true" focusable="false" width="100%" height="100%" viewBox="0 0 1200 680" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 max-sm:hidden">
      {L(120, 90, 19, c("ill-sage-light"), "")}
      {L(1040, 120, 19, c("ill-mustard"), "delay-b")}
      {L(980, 560, 19, c("ill-sage-light"), "delay-c")}
      {L(180, 590, 16, c("ill-clay"), "delay-b")}
      {L(620, 60, 16, c("ill-cream"), "", 0.7)}
    </svg>
  );
}

export function Envelope() {
  return (
    <svg width="230" height="120" viewBox="0 0 230 120" aria-hidden="true" focusable="false" className="relative -mb-[26px] max-w-[60vw]">
      <path d="M14 40l101 58 101-58v74H14z" fill={c("ill-wood")} transform="translate(5 4)" />
      <path d="M14 40l101 58 101-58v74H14z" fill={c("ill-beige")} stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      <path d="M14 40L115 6l101 34" fill={c("ill-paper")} stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="115" cy="62" r="18" fill={c("ill-forest")} stroke={LINE} strokeWidth="3" />
      <path d="M107 66c0-8 6-13 14-13 0 8-6 13-14 13z" fill={c("ill-sage-light")} />
    </svg>
  );
}

export function EveningDesk() {
  const E = c("edge");
  const leaf = "M0 0c0-16 11-26 27-26 0 16-11 26-27 26z";
  const leafS = "M0 0c0-14 10-22 24-22 0 14-10 22-24 22z";
  return (
    <svg viewBox="0 0 560 440" role="img" aria-label="A desk: lamp, laptop with a waveform, mint plant, mug and books" className="h-auto min-w-0 max-w-[620px] flex-[1_1_420px]">
      <g opacity=".12"><ellipse className="anim-glow" cx="300" cy="230" rx="260" ry="190" fill={c("accent")} /></g>
      <path d="M20 360h520" stroke={c("wood")} strokeWidth="18" strokeLinecap="round" />
      <path d="M20 372h520" stroke={c("wood-dark")} strokeWidth="6" strokeLinecap="round" />
      <path d="M420 351V150l-60-40" fill="none" stroke={c("ink")} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M300 100l60-28 30 52z" fill={c("ill-mustard")} stroke={E} strokeWidth="3" strokeLinejoin="round" />
      <g style={{ opacity: "calc(0.06 + 0.12 * var(--lamp-rays))" }}><path className="anim-glow" d="M318 118L230 300h180l-34-170z" fill={c("ill-mustard")} /></g>
      <rect x="396" y="344" width="48" height="10" rx="4" fill={c("ink")} />
      <rect x="150" y="196" width="210" height="140" rx="14" fill={c("surface")} stroke={E} strokeWidth="4" />
      <rect x="164" y="210" width="182" height="112" rx="8" fill={c("mat")} />
      <path d="M176 266h8M188 254v24M196 244v44M204 258v16M212 236v60M220 250v32M228 262v8M236 246v40M244 240v52M252 256v20M260 248v36M268 260v12M276 242v48M284 252v28M292 264v4M300 250v32M308 244v44M316 258v16M324 252v28M332 262v8" stroke={c("ill-mustard")} strokeWidth="4" strokeLinecap="round" />
      <path d="M120 336h270l-20 18H140z" fill={c("ink-soft")} stroke={E} strokeWidth="3" strokeLinejoin="round" />
      <path d="M58 246h70l-8 104H66z" fill={c("wood")} stroke={E} strokeWidth="3" strokeLinejoin="round" />
      <rect x="52" y="236" width="82" height="14" rx="5" fill={c("ill-clay-deep")} stroke={E} strokeWidth="3" />
      <path d="M93 236c-4-30-18-50-34-62M93 236c2-36 14-62 32-78M93 236c0-40 0-70 2-96" fill="none" stroke={c("ill-sage")} strokeWidth="4" strokeLinecap="round" />
      <path d={leaf} transform="translate(54 178) rotate(-130)" fill={c("ill-sage-light")} stroke={E} strokeWidth="2.4" />
      <path d={leaf} transform="translate(118 162) rotate(10)" fill={c("ill-sage")} stroke={E} strokeWidth="2.4" />
      <path d={leaf} transform="translate(70 206) rotate(-60)" fill={c("ill-sage")} stroke={E} strokeWidth="2.4" />
      <path d={leafS} transform="translate(90 140) rotate(-80)" fill={c("ill-sage-light")} stroke={E} strokeWidth="2.4" />
      <path d={leafS} transform="translate(98 132) rotate(20)" fill={c("ill-sage")} stroke={E} strokeWidth="2.4" />
      <path d="M462 300h50v32a18 18 0 0 1 -18 18h-14a18 18 0 0 1 -18 -18z" fill={c("ill-mustard")} stroke={E} strokeWidth="3" />
      <path d="M512 308h6a10 10 0 0 1 0 20h-6" fill="none" stroke={E} strokeWidth="3" />
      <path className="anim-steam" d="M478 290c-6-6 6-10 0-18" fill="none" stroke={c("ink-soft")} strokeWidth="3" strokeLinecap="round" />
      <path className="anim-steam delay-b" d="M494 290c-6-6 6-10 0-18" fill="none" stroke={c("ink-soft")} strokeWidth="3" strokeLinecap="round" />
      <rect x="444" y="228" width="92" height="20" rx="4" fill={c("ill-forest")} stroke={E} strokeWidth="3" />
      <rect x="452" y="248" width="80" height="20" rx="4" fill={c("wood")} stroke={E} strokeWidth="3" />
      <rect x="440" y="268" width="96" height="20" rx="4" fill={c("ink")} stroke={E} strokeWidth="3" />
    </svg>
  );
}

export function ClipHead({ size = 36, variant = "wave" }: { size?: number; variant?: "wave" | "film" }) {
  const body = variant === "film" ? c("ill-mustard") : c("clip-body");
  const stripe = variant === "film" ? c("ill-night-line") : c("clip-stripe");
  const wire = variant === "film" ? c("ill-oat") : c("clip-wire");
  return (
    <svg width={size} height={(size * 32) / 36} viewBox="0 0 36 32" aria-hidden="true" focusable="false">
      <path d="M11 14V6a4 4 0 0 1 4 -4h6a4 4 0 0 1 4 4v8" fill="none" stroke={wire} strokeWidth="2.6" />
      <path d="M5 13h26l-4 17H9z" fill={body} stroke={variant === "film" ? c("ill-night-line") : "none"} strokeWidth="2" />
      <path d="M10 18h16" stroke={stripe} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
