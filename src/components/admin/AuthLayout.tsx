/** Split-screen frame for the sign-in and first-run pages. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-[#f4f4f1] lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[#0b0b0c] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] animate-[pulse_8s_ease-in-out_infinite] rounded-full bg-accent/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 right-[-120px] h-[460px] w-[460px] rounded-full bg-[#2a78d6]/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent font-display text-xl text-ink">N</span>
          <span className="text-xs font-medium uppercase tracking-[0.25em] text-white/50">Commerce admin</span>
        </div>
        <div className="relative">
          <p className="font-display text-[clamp(4rem,7vw,7rem)] uppercase leading-[0.85]">Never<br />Settle</p>
          <p className="mt-6 max-w-sm text-white/55">Orders, inventory, invoices and profit for your store, in one place.</p>
        </div>
        <p className="relative text-xs text-white/30">© {new Date().getFullYear()} NEVER SETTLE</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink font-display text-xl text-accent">N</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-ink/55">{subtitle}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
