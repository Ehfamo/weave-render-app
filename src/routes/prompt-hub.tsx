import { createFileRoute, Link } from "@tanstack/react-router";
import { pageUrl } from "@/lib/seo";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ArrowLeft } from "lucide-react";
import { Header } from "@/components/xeomx/Header";
import { ExploreCard } from "@/components/xeomx/ExploreCard";
import { ExploreRow } from "@/components/xeomx/ExploreRow";
import { PromptCard } from "@/components/xeomx/PromptCard";
import { CORE_SECTIONS, EXPLORE_CATEGORIES, EXPLORE_SECTIONS } from "@/lib/explore-sections";
import { searchAll } from "@/lib/marketplace";
import { HeroBackground, heroPreloadLinks } from "@/components/xeomx/HeroBackground";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/prompt-hub")({
  head: () => ({
    meta: [
      { title: m.explore_head_title() },
      { name: "description", content: m.explore_head_desc() },
      { property: "og:title", content: m.explore_head_title() },
      { property: "og:description", content: m.explore_head_desc() },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl("/prompt-hub") },
    ],
    links: [
      { rel: "canonical", href: pageUrl("/prompt-hub") },
      ...heroPreloadLinks,
    ],
  }),
  component: PromptHubPage,
});

function PromptHubPage() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const debounced = q.trim();
  const { data: searchResults } = useQuery({
    queryKey: ["prompt-hub-search", debounced],
    queryFn: () => searchAll(debounced),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });
  const SECTION_COUNT = CORE_SECTIONS.length + EXPLORE_SECTIONS.length;
  const ALL_SECTIONS = [...CORE_SECTIONS, ...EXPLORE_SECTIONS];
  const countPhase = (p: string) => ALL_SECTIONS.filter((s) => s.phase === p).length;
  const liveCount = countPhase("live");
  const q1Count = countPhase("q1");
  const q2Count = countPhase("q2");
  const q3Count = countPhase("q3");

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
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <HeroBackground />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
        </div>
        <div className="pointer-events-none absolute inset-0" style={{ background: "var(--gradient-spotlight)" }} />
        <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: "var(--gradient-gold)" }} />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full opacity-20 blur-3xl" style={{ background: "var(--gradient-magenta)" }} />

        <div className="relative mx-auto max-w-[1400px] px-4 py-16 sm:px-8 sm:py-24">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 py-2 text-xs text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> {m.explore_hero_back()}
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> {m.explore_platform_map({ count: String(SECTION_COUNT) })}
          </div>
          <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
            <span className="text-gradient-gold animate-fade-in">{m.explore_universe_pre()}</span>
            <br />
            <span className="text-foreground">{m.explore_universe()}</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            {m.explore_hero_desc()}
          </p>

          <label className="mt-8 flex max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-surface/40 px-4 py-3 backdrop-blur-xl transition focus-within:border-amber-300/40">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={m.explore_search_placeholder()}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {q && (
              <button onClick={() => setQ("")} className="text-xs text-muted-foreground hover:text-foreground">{m.explore_clear()}</button>
            )}
          </label>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{m.explore_stat_live({ count: String(liveCount) })}</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" />{m.explore_stat_launching({ count: String(q1Count) })}</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />{m.explore_stat_indev({ count: String(q2Count) })}</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-white/20" />{m.explore_stat_vision({ count: String(q3Count) })}</span>
          </div>
        </div>
      </section>

      {debounced.length >= 2 && searchResults && searchResults.prompts.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-4 pt-8 sm:px-8">
          <h2 className="mb-4 font-display text-2xl font-semibold tracking-tight">Prompts matching "{debounced}"</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {searchResults.prompts.map((p) => (
              <PromptCard key={p.id} prompt={p} />
            ))}
          </div>
        </section>
      )}

      {/* Core sections */}
      {filteredCore.length > 0 && (
        <section
          className="mx-auto max-w-[1400px]"
          style={{ paddingInline: "var(--space-4)", paddingTop: "var(--space-6)" }}
        >
          <div
            className="flex items-end justify-between"
            style={{ marginBottom: "var(--space-4)", gap: "var(--space-4)" }}
          >
            <div>
              <div
                className="font-semibold uppercase tracking-[0.2em] text-amber-200"
                style={{ fontSize: "var(--font-size-micro)" }}
              >
                {m.explore_live_now()}
              </div>
              <h2
                className="font-display font-bold"
                style={{ marginTop: "var(--space-1)", fontSize: "clamp(1.5rem, 3vw, var(--font-size-h2))" }}
              >
                {m.explore_core_platform()}
              </h2>
            </div>
            <Link
              to="/"
              className="hidden text-sm font-medium sm:inline-flex"
              style={{ color: "var(--action-primary)" }}
            >
              {m.see_all()}
            </Link>
          </div>
          <div
            className="scrollbar-hidden flex snap-x snap-mandatory overflow-x-auto sm:grid sm:snap-none sm:grid-cols-3 sm:overflow-visible sm:[&>*]:w-auto"
            style={{ gap: "var(--space-4)", paddingBottom: "var(--space-4)" }}
          >
            {filteredCore.map((s, i) => (
              <div key={s.slug} className="snap-start sm:w-full">
                <ExploreCard section={s} index={i} core />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Category rows */}
      <div
        className="mx-auto max-w-[1400px]"
        style={{
          paddingBlock: "var(--space-7)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-7)",
        }}
      >
        {EXPLORE_CATEGORIES.map((cat, rowIndex) => {
          const items = filtered.filter((s) => s.category === cat);
          return <ExploreRow key={cat} title={cat} sections={items} rowIndex={rowIndex} />;
        })}
        {query && filtered.length === 0 && filteredCore.length === 0 && (
          <div className="px-8 py-20 text-center text-muted-foreground">{m.explore_no_match({ q })}</div>
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
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{m.footer_tagline()}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{m.footer_platform()}</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/" className="transition hover:text-foreground">{m.explore_footer_discover()}</Link></li>
                <li><Link to="/feed" className="transition hover:text-foreground">{m.explore_footer_viral()}</Link></li>
                <li><Link to="/collections" className="transition hover:text-foreground">{m.explore_footer_collections()}</Link></li>
                <li><Link to="/creators" className="transition hover:text-foreground">{m.explore_footer_creators()}</Link></li>
                <li><Link to="/explore" className="transition hover:text-foreground">{m.explore_footer_universe()}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{m.explore_footer_coming()}</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/explore/$slug" params={{ slug: "studio-canvas" }} className="transition hover:text-foreground">Studio Canvas</Link></li>
                <li><Link to="/explore/$slug" params={{ slug: "agent-store" }} className="transition hover:text-foreground">Agent Store</Link></li>
                <li><Link to="/explore/$slug" params={{ slug: "ai-compare" }} className="transition hover:text-foreground">AI Compare Arena</Link></li>
                <li><Link to="/explore/$slug" params={{ slug: "academy" }} className="transition hover:text-foreground">Academy</Link></li>
                <li><Link to="/explore/$slug" params={{ slug: "founders" }} className="transition hover:text-foreground">Founders Access</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{m.footer_legal()}</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/terms" className="transition hover:text-foreground">{m.footer_terms()}</Link></li>
                <li><Link to="/privacy" className="transition hover:text-foreground">{m.footer_privacy()}</Link></li>
                <li><Link to="/cookies" className="transition hover:text-foreground">{m.footer_cookie()}</Link></li>
                <li><Link to="/refund-policy" className="transition hover:text-foreground">{m.footer_refund()}</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 sm:flex-row">
            <p className="text-xs text-muted-foreground">{m.footer_rights()}</p>
            <p className="text-xs text-muted-foreground">{m.footer_built()} · <span className="text-gradient-gold">{m.footer_sections({ count: String(SECTION_COUNT) })}</span> · {m.footer_powered()}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}