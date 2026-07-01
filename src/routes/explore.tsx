import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, ArrowLeft } from "lucide-react";
import { Header } from "@/components/xeomx/Header";
import { ExploreCard } from "@/components/xeomx/ExploreCard";
import { ExploreRow } from "@/components/xeomx/ExploreRow";
import { CORE_SECTIONS, EXPLORE_CATEGORIES, EXPLORE_SECTIONS } from "@/lib/explore-sections";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore — The XeomX Universe" },
      { name: "description", content: "Every tool. Every studio. Every superpower. Browse all sections of the XeomX platform." },
      { property: "og:title", content: "Explore — The XeomX Universe" },
      { property: "og:description", content: "Every tool. Every studio. Every superpower." },
    ],
  }),
  component: ExplorePage,
});

function ExplorePage() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!query) return EXPLORE_SECTIONS;
    return EXPLORE_SECTIONS.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.tagline.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query)
    );
  }, [query]);

  const filteredCore = useMemo(() => {
    if (!query) return CORE_SECTIONS;
    return CORE_SECTIONS.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.tagline.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query)
    );
  }, [query]);

  return (
    <div className="min-h-svh bg-background">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0" style={{ background: "var(--gradient-spotlight)" }} />
        <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: "var(--gradient-gold)" }} />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full opacity-20 blur-3xl" style={{ background: "var(--gradient-magenta)" }} />

        <div className="relative mx-auto max-w-[1400px] px-4 py-16 sm:px-8 sm:py-24">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to discover
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Platform map · {SECTION_COUNT} sections
          </div>
          <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
            <span className="text-gradient-gold animate-fade-in">The XeomX</span>
            <br />
            <span className="text-foreground">Universe</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Every tool. Every studio. Every superpower. One cinematic platform for the AI era.
          </p>

          <label className="mt-8 flex max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-surface/40 px-4 py-3 backdrop-blur-xl transition focus-within:border-amber-300/40">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the universe — studios, agents, intelligence…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {q && (
              <button onClick={() => setQ("")} className="text-xs text-muted-foreground hover:text-foreground">clear</button>
            )}
          </label>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />3 Live</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" />28 Launching Q1</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />21 In Development</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-white/20" />12 Vision</span>
          </div>
        </div>
      </section>

      {/* Core sections */}
      {filteredCore.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-4 pt-12 sm:px-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200">Live now</div>
              <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Core platform</h2>
            </div>
          </div>
          <div className="scrollbar-hidden flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 sm:grid sm:snap-none sm:grid-cols-3 sm:overflow-visible sm:[&>*]:w-auto">
            {filteredCore.map((s, i) => (
              <div key={s.slug} className="snap-start sm:w-full">
                <ExploreCard section={s} index={i} core />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Category rows */}
      <div className="mx-auto max-w-[1400px] space-y-10 py-14 sm:space-y-14">
        {EXPLORE_CATEGORIES.map((cat, rowIndex) => {
          const items = filtered.filter((s) => s.category === cat);
          return <ExploreRow key={cat} title={cat} sections={items} rowIndex={rowIndex} />;
        })}
        {query && filtered.length === 0 && filteredCore.length === 0 && (
          <div className="px-8 py-20 text-center text-muted-foreground">No sections match "{q}".</div>
        )}
      </div>

      <footer className="mt-20 border-t border-border/60 bg-surface/30">
        <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: "var(--gradient-magenta)" }}>
                  <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                </span>
                <span className="font-display text-base font-bold">XeomX</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">The cinematic AI super-platform. Built for creators who move fast.</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Platform</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/" className="transition hover:text-foreground">Discover</Link></li>
                <li><Link to="/feed" className="transition hover:text-foreground">Viral Feed</Link></li>
                <li><Link to="/collections" className="transition hover:text-foreground">Collections</Link></li>
                <li><Link to="/creators" className="transition hover:text-foreground">Creators</Link></li>
                <li><Link to="/explore" className="transition hover:text-foreground">Explore Universe</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Coming Soon</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/explore_/$slug" params={{ slug: "studio-canvas" }} className="transition hover:text-foreground">Studio Canvas</Link></li>
                <li><Link to="/explore_/$slug" params={{ slug: "agent-store" }} className="transition hover:text-foreground">Agent Store</Link></li>
                <li><Link to="/explore_/$slug" params={{ slug: "ai-compare" }} className="transition hover:text-foreground">AI Compare Arena</Link></li>
                <li><Link to="/explore_/$slug" params={{ slug: "academy" }} className="transition hover:text-foreground">Academy</Link></li>
                <li><Link to="/explore_/$slug" params={{ slug: "founders" }} className="transition hover:text-foreground">Founders Access</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Legal</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><span className="cursor-not-allowed opacity-50">Terms of Service</span></li>
                <li><span className="cursor-not-allowed opacity-50">Privacy Policy</span></li>
                <li><span className="cursor-not-allowed opacity-50">Cookie Policy</span></li>
                <li><span className="cursor-not-allowed opacity-50">Refund Policy</span></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 sm:flex-row">
            <p className="text-xs text-muted-foreground">© 2026 XeomX. All rights reserved.</p>
            <p className="text-xs text-muted-foreground">Built for the AI era · <span className="text-gradient-gold">{SECTION_COUNT} sections</span> · Powered by intelligence</p>
          </div>
        </div>
      </footer>
    </div>
  );
}