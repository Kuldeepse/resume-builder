import { Heart, PenLine } from 'lucide-react';

export default function SiteFooter() {
  return (
    <>
      <style>{`
        main > footer.mt-12.w-full.border-t.border-dashed {
          display: none !important;
        }
      `}</style>

      <footer className="mx-3 mb-4 mt-10 rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] px-5 py-5 text-[var(--foreground)] shadow-[var(--shadow-xl)] backdrop-blur-2xl md:mx-8 md:mb-6 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ink-soft)] sm:justify-start">
            <span>Crafted with</span>
            <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" aria-hidden="true" />
            <span aria-hidden="true">•</span>
            <span>Developed by</span>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-2.5 shadow-sm">
            <PenLine className="h-5 w-5 shrink-0 text-[var(--highlight)]" aria-hidden="true" />
            <div aria-label="Developer signature: Kuldeep Sharma">
              <span className="block font-[var(--font-cognitwist-editorial-body)] text-2xl font-semibold italic leading-none tracking-[0.02em] text-[var(--accent-strong)]">
                Kuldeep Sharma
              </span>
              <span className="mt-1 block text-[8px] font-black uppercase tracking-[0.22em] text-[var(--ink-soft)]">
                Product Creator &amp; Developer
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
