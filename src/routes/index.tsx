import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Flame, Heart, MessageCircle, Play, Share2 } from "lucide-react";
import { CATEGORIES, PROMPTS, ROWS } from "@/lib/prompts";
import { Header } from "@/components/xeomx/Header";
import { Row } from "@/components/xeomx/Row";
import { PromptCard } from "@/components/xeomx/PromptCard";
import heroImg from "@/assets/hero.jpg";
import cover1 from "@/assets/cover-1.jpg";

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
              <Flame className="h-3 w-3" /> Featured drop · 048
            </span>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              The cinema of <span className="text-gradient-gold italic">prompts</span>,
              <br />
              streamed like <span className="text-gradient-magenta">Netflix</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              {featured.title} — a {featured.category.toLowerCase()} prompt by {featured.author}. Open it, copy it, render it. Or scroll the viral feed below.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/prompt/$id"
                params={{ id: featured.id }}
                className="group inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white transition hover:opacity-95"
                style={{ background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)" }}
              >
                <Play className="h-4 w-4 fill-white" /> Watch the prompt
              </Link>
              <button className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-5 py-3 text-sm font-medium text-foreground backdrop-blur transition hover:border-gold/40">
                Browse library <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-border/60 pt-6 text-left">
              {[
                ["12,480", "Prompts"],
                ["1.4M", "Renders/mo"],
                ["Tier 01", "Live drop"],
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

            {/* VIRAL FEED */}
            <section className="px-4 sm:px-8">
              <div className="mb-6 flex items-end justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-magenta/80">For you · vertical feed</p>
                  <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                    Viral <span className="text-gradient-magenta">prompts</span>
                  </h2>
                </div>
                <a href="#" className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:inline">
                  Open full feed →
                </a>
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

      <footer className="mt-12 border-t border-border/60 px-4 py-10 text-center text-xs text-muted-foreground sm:px-8">
        <p>© 2026 XeomX — The cinema of prompts.</p>
      </footer>
    </div>
  );
}
