export function Room({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-clip px-[var(--gutter)] pb-7 pt-5 max-sm:pt-3.5">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[120px] left-[8%] h-[900px] w-[70px] rotate-[32deg] blur-[22px]" style={{ background: "var(--window-light)" }} />
        <div className="absolute -top-[120px] left-[16%] h-[900px] w-[140px] rotate-[32deg] blur-[26px]" style={{ background: "var(--window-light-2)" }} />
        <div className="absolute -right-40 -top-[260px] h-[760px] w-[760px] rounded-full max-sm:-right-40 max-sm:-top-44 max-sm:h-[460px] max-sm:w-[460px]"
          style={{ background: "radial-gradient(circle, var(--lamp-glow), transparent 65%)" }} />
      </div>
      {children}
    </div>
  );
}
