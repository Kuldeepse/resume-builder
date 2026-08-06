import { ExternalLink, Heart, Linkedin, PenLine } from 'lucide-react';

const linkedInProfile = 'https://www.linkedin.com/in/kuldeep-sharma-4561b716/';

export default function SiteFooter() {
  return (
    <>
      <style>{`
        main > footer.mt-12.w-full.border-t.border-dashed {
          display: none !important;
        }
      `}</style>

      <footer className="mx-3 mb-4 mt-10 rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] px-5 py-6 text-[var(--foreground)] shadow-[var(--shadow-xl)] backdrop-blur-2xl md:mx-8 md:mb-6 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 text-center">
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ink-soft)]">
            <span>Crafted with</span>
            <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" aria-hidden="true" />
            <span aria-hidden="true">•</span>
            <span>Developed by</span>
          </div>

          <a
            href={linkedInProfile}
            target="_blank"
            rel="noopener noreferrer"
            className="group mx-auto flex items-center justify-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-5 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            aria-label="Open Kuldeep Sharma's LinkedIn profile in a new tab"
          >
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-white">
              <Linkedin className="h-5 w-5" aria-hidden="true" />
              <PenLine className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-[var(--surface-strong)] p-0.5 text-[var(--highlight)]" aria-hidden="true" />
            </span>

            <span className="text-center">
              <span className="block font-[var(--font-cognitwist-editorial-body)] text-2xl font-semibold italic leading-none tracking-[0.02em] text-[var(--accent-strong)] md:text-3xl">
                Kuldeep Sharma
              </span>
              <span className="mt-1.5 flex items-center justify-center gap-1.5 text-[8px] font-black uppercase tracking-[0.22em] text-[var(--ink-soft)]">
                Product Creator &amp; Developer
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </span>
            </span>
          </a>
        </div>
      </footer>
    </>
  );
}
