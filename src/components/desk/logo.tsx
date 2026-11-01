export function LogoMark({ size = 42 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false" className="shrink-0">
      <path d="M20 3c9.5 0 17 6.5 17 16.5S29.5 37 19.5 37 3 30 3 20.5 10.5 3 20 3z" fill="var(--ill-mustard)" />
      <path d="M10 30C10 18 18 10 30 10c0 12-8 20-20 20z" fill="var(--ill-sage)" transform="translate(2 2)" />
      <path d="M10 30C10 18 18 10 30 10c0 12-8 20-20 20z" fill="none" stroke="var(--ill-line)" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M10 30l11-11" stroke="var(--ill-line)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M22.5 12.5l3 3" stroke="var(--ill-cream)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 text-primary sm:gap-2.5">
      <LogoMark size={compact ? 34 : 42} />
      <span className={compact ? "font-display text-[25px] font-extrabold tracking-[-0.035em]" : "font-display text-[25px] font-extrabold tracking-[-0.035em] sm:text-[30px]"}>clipmint</span>
    </span>
  );
}
