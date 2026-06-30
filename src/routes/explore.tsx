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
      { name: "description", content: "Every tool. Every studio. Every superpower. Browse all 64 sections of the XeomX platform." },
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
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Platform map · 64 sections
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
          <div className="scrollbar-hidden flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 sm:grid sm:snap-none sm:grid-cols-3 sm:overflow-visible">
            {filteredCore.map((s, i) => (
              <div key={s.slug} className="snap-start sm:w-auto">
                <ExploreCard section={s} index={i} core />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Category rows */}
      <div className="mx-auto max-w-[1400px] space-y-14 py-14">
        {EXPLORE_CATEGORIES.map((cat) => {
          const items = filtered.filter((s) => s.category === cat);
          return <ExploreRow key={cat} title={cat} sections={items} />;
        })}
        {query && filtered.length === 0 && filteredCore.length === 0 && (
          <div className="px-8 py-20 text-center text-muted-foreground">No sections match "{q}".</div>
        )}
      </div>

      <footer className="border-t border-border/60 py-10 text-center text-xs text-muted-foreground">
        XeomX · Built for creators · powered by intelligence
      </footer>
    </div>
  );
}