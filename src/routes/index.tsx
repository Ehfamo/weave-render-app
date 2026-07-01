import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Flame, Heart, MessageCircle, Play, Share2 } from "lucide-react";
import { CATEGORIES, COLLECTIONS, CREATORS, PROMPTS, ROWS } from "@/lib/prompts";
import { CORE_SECTIONS, EXPLORE_SECTIONS } from "@/lib/explore-sections";
import { Header } from "@/components/xeomx/Header";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";
import { Row } from "@/components/xeomx/Row";
import { PromptCard } from "@/components/xeomx/PromptCard";
import { CollectionCard } from "@/components/xeomx/CollectionCard";
import { CreatorCard } from "@/components/xeomx/CreatorCard";
import { TickerMarquee } from "@/components/xeomx/Marquee";
import { SignalBadge } from "@/components/xeomx/Signal";
import { ConnectSection } from "@/components/xeomx/ConnectSection";
import heroImg from "@/assets/hero.jpg";
import cover1 from "@/assets/cover-1.jpg";

const CATEGORY_LABELS: Record<string, () => string> = {
  All: () => m.cat_all(),
  Portrait: () => m.cat_portrait(),
  Fashion: () => m.cat_fashion(),
  Atmosphere: () => m.cat_atmosphere(),
  "Sci-Fi": () => m.cat_scifi(),
  Texture: () => m.cat_texture(),
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "XeomX — Cinematic AI Prompt Marketplace" },
      { name: "description", content: "Discover, remix and own the world's most cinematic AI prompts. Netflix-style discovery, viral feed, premium drops." },
      { property: "og:title", content: "XeomX — Cinematic AI Prompt Marketplace" },
      { property: "og:description", content: "Discover, remix and own the world's most cinematic AI prompts." },
    ],
  }),
  component: Index,
});

function Index() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");

  const filtered = useMemo(() => {
    return PROMPTS.filter((p) => {
      if (cat !== "All" && p.category !== cat) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q)
      );
    });
  }, [query, cat]);

  const featured = PROMPTS[0];
  const isFiltering = query.length > 0 || cat !== "All";

  const tickerItems = [
    "🔥 ai-sigil · 18.4k copies today",
    "⚡ neon-splash · rising fast",
    "🏆 baroque-muse · top 1%",
    "🚀 void-astronaut · viral score 95",
    "💎 magenta-cathedral · 1,820 watching",
    "✨ visor-oracle · 7.1k copies",
    "🎬 monolith-corridor · 2.1k remixes",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header query={query} onSearch={setQuery} />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={cover1}
            alt=""
            width={1280}
            height={1600}
            className="h-full w-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
        </div>

        <div className="relative mx-auto flex max-w-[1400px] flex-col gap-8 px-4 pb-20 pt-16 sm:px-8 sm:pt-24 lg:flex-row lg:items-end lg:gap-16 lg:pb-32 lg:pt-32">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-gold">
              <Flame className="h-3 w-3" /> {m.hero_eyebrow()}
            </span>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              {m.hero_title_line_1()}
              <br />
              {m.hero_title_line_2()}
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              {featured.title} — a {featured.category.toLowerCase()} prompt by {featured.author}. Open it, copy it, render it. Or scroll the viral feed below.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/feed"
                className="group inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white transition hover:opacity-95"
                style={{ background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)" }}
              >
                <Play className="h-4 w-4 fill-white" /> {m.hero_cta_feed()}
              </Link>
              <Link
                to="/collections"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-5 py-3 text-sm font-medium text-foreground backdrop-blur transition hover:border-gold/40"
              >
                {m.hero_cta_collections()} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-border/60 pt-6 text-left">
              {[
                ["12,480", m.hero_stat_prompts()],
                ["1.4M", m.hero_stat_renders()],
                ["Tier 01", m.hero_stat_drop()],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="font-display text-2xl font-semibold tracking-tight">{v}</dt>
                  <dd className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Featured poster */}
          <Link
            to="/prompt/$id"
            params={{ id: featured.id }}
            className="group relative ml-auto hidden w-[340px] shrink-0 overflow-hidden rounded-3xl border border-border shadow-[var(--shadow-card)] lg:block"
          >
            <img src={featured.cover} alt={featured.title} className="aspect-[3/4] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.02 60)" }}>
                Premium
              </span>
              <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight">{featured.title}</h3>
              <p className="text-xs text-muted-foreground">{featured.author} · {featured.views} views</p>
            </div>
          </Link>
        </div>
      </section>

      {/* LIVE TICKER */}
      <TickerMarquee items={tickerItems} />

      {/* CATEGORY FILTER */}
      <div className="sticky top-[57px] z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="scrollbar-hidden mx-auto flex max-w-[1400px] gap-2 overflow-x-auto px-4 py-3 sm:px-8">
          {CATEGORIES.map((c) => {
            const active = cat === c;
            return (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide transition ${
                  active
                    ? "border-transparent text-white"
                    : "border-border bg-surface/40 text-muted-foreground hover:border-magenta/40 hover:text-foreground"
                }`}
                style={active ? { background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)" } : undefined}
              >
                {c}
              </button>
            );
          })}
          <span className="ml-auto hidden shrink-0 self-center text-[11px] uppercase tracking-[0.22em] text-muted-foreground sm:inline">
            {filtered.length} of {PROMPTS.length} prompts
          </span>
        </div>
      </div>

      <main className="mx-auto max-w-[1400px] space-y-16 py-12">
        {isFiltering ? (
          <section className="space-y-6 px-4 sm:px-8">
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">
              Results <span className="text-muted-foreground">({filtered.length})</span>
            </h2>
            {filtered.length === 0 ? (
              <p className="text-muted-foreground">No prompts match — try another keyword.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
                {filtered.map((p) => (
                  <div key={p.id} className="contents">
                    <PromptCard prompt={p} />
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {ROWS.map((row) => (
              <Row key={row.title} title={row.title} tag={row.tag} ids={row.ids} />
            ))}

            {/* COLLECTIONS RAIL */}
            <section className="px-4 sm:px-8">
              <div className="mb-6 flex items-end justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-gold/80">Curated · structured paths</p>
                  <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                    Prompt <span className="text-gradient-gold italic">collections</span>
                  </h2>
                </div>
                <Link to="/collections" className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:inline">
                  See all →
                </Link>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {COLLECTIONS.slice(0, 4).map((c) => (
                  <CollectionCard key={c.id} c={c} />
                ))}
              </div>
            </section>

            {/* CREATORS RAIL */}
            <section className="px-4 sm:px-8">
              <div className="mb-6 flex items-end justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-magenta/80">Creator economy</p>
                  <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                    Elite <span className="text-gradient-magenta">prompt engineers</span>
                  </h2>
                </div>
                <Link to="/creators" className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:inline">
                  See all →
                </Link>
              </div>
              <div className="scrollbar-hidden -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8">
                {CREATORS.map((c) => (
                  <CreatorCard key={c.handle} c={c} />
                ))}
              </div>
            </section>

            {/* VIRAL FEED */}
            <section className="px-4 sm:px-8">
              <div className="mb-6 flex items-end justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-magenta/80">For you · vertical feed</p>
                  <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                    Viral <span className="text-gradient-magenta">prompts</span>
                  </h2>
                </div>
                <Link to="/feed" className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:inline">
                  Open full feed →
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {PROMPTS.slice(0, 3).map((p) => (
                  <Link
                    to="/prompt/$id"
                    params={{ id: p.id }}
                    key={"viral-" + p.id}
                    className="group relative overflow-hidden rounded-3xl border border-border bg-surface"
                  >
                    <div className="relative aspect-[9/14] overflow-hidden">
                      <img src={p.cover} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                      <div className="absolute left-3 top-3"><SignalBadge signal={p.signal ?? null} score={p.viralScore} /></div>
                      <div className="absolute right-3 top-3 flex flex-col gap-2">
                        {[Heart, MessageCircle, Share2].map((Icon, i) => (
                          <span key={i} className="grid h-10 w-10 place-items-center rounded-full border border-foreground/20 bg-background/40 backdrop-blur transition hover:border-magenta/60">
                            <Icon className="h-4 w-4" />
                          </span>
                        ))}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 space-y-2 p-5">
                        <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
                          {p.category}
                        </span>
                        <h3 className="font-display text-2xl font-semibold leading-tight">{p.title}</h3>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{p.prompt}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.author} · ❤ {p.likes} · ▶ {p.views}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* RANKING ENGINE BLOCK */}
            <section className="mx-4 overflow-hidden rounded-3xl border border-border bg-surface/40 p-8 sm:mx-8 sm:p-12">
              <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-gold/80">Ranking engine</p>
                  <h2 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                    Algorithmic discovery, not endless lists.
                  </h2>
                  <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
                    Every prompt is ranked live: views ×1, copies ×5, saves ×4, shares ×6, remixes ×7. The best work surfaces. Creators get paid.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    ["12,480", "Prompts indexed"],
                    ["1.4M", "Renders / month"],
                    ["98", "Top viral score"],
                    ["284k", "Active creators"],
                    ["$0", "Cost to copy"],
                    ["70%", "Creator share"],
                  ].map(([v, l]) => (
                    <div key={l} className="rounded-2xl border border-border bg-background/40 p-4">
                      <p className="font-display text-2xl font-semibold tracking-tight">{v}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* COMING SOON BANNER */}
            <section className="relative mx-4 overflow-hidden rounded-3xl border border-border sm:mx-8">
              <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(120deg, oklch(0.13 0.012 40 / 0.9), oklch(0.13 0.012 40 / 0.4))" }} />
              <div className="relative grid gap-6 p-8 sm:p-14 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="max-w-xl">
                  <span className="inline-flex items-center gap-2 rounded-full border border-magenta/30 bg-magenta/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-magenta">
                    Founders drop · Tier 01
                  </span>
                  <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                    500 numbered prompts.
                    <br /> <span className="text-gradient-gold italic">Once gone, gone.</span>
                  </h2>
                  <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                    Hand-curated by XeomX directors. Each prompt ships with style sheet, render presets, and a numbered certificate.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button className="rounded-full px-5 py-3 text-sm font-medium text-white" style={{ background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)" }}>
                    Reserve your slot
                  </button>
                  <button className="rounded-full border border-border bg-surface/60 px-5 py-3 text-sm text-foreground backdrop-blur">
                    See timeline
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {!isFiltering && <ConnectSection />}

      <footer className="mt-16 border-t border-border/60 bg-surface/30">
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
              <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{m.footer_platform()}</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/" className="transition hover:text-foreground">{m.nav_discover()}</Link></li>
                <li><Link to="/feed" className="transition hover:text-foreground">{m.nav_feed()}</Link></li>
                <li><Link to="/collections" className="transition hover:text-foreground">{m.nav_collections()}</Link></li>
                <li><Link to="/creators" className="transition hover:text-foreground">{m.nav_creators()}</Link></li>
                <li><Link to="/explore" className="transition hover:text-foreground">{m.nav_explore()}</Link></li>
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
            <p className="text-xs text-muted-foreground">{m.footer_rights()}</p>
            <p className="text-xs text-muted-foreground">Built for the AI era · <span className="text-gradient-gold">64 sections</span> · Powered by intelligence</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
