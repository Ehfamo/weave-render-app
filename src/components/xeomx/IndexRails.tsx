import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import { COLLECTIONS, CREATORS, PROMPTS } from "@/lib/prompts";
import { CollectionCard } from "./CollectionCard";
import { CreatorCard } from "./CreatorCard";
import { SignalBadge } from "./Signal";
import heroImg from "@/assets/hero.jpg";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export function IndexRails() {
  return (
    <>
      {/* COLLECTIONS RAIL */}
      <section className="px-4 sm:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-gold/80">{m.collections_eyebrow()}</p>
            <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {m.collections_title_1()} <span className="text-gradient-gold italic">{m.collections_title_2()}</span>
            </h2>
          </div>
          <Link to="/collections" className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:inline">
            {m.see_all()}
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
            <p className="text-[11px] uppercase tracking-[0.28em] text-magenta/80">{m.creators_eyebrow()}</p>
            <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {m.creators_title_1()} <span className="text-gradient-magenta">{m.creators_title_2()}</span>
            </h2>
          </div>
          <Link to="/creators" className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:inline">
            {m.see_all()}
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
            <p className="text-[11px] uppercase tracking-[0.28em] text-magenta/80">{m.viral_eyebrow()}</p>
            <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {m.viral_title_1()} <span className="text-gradient-magenta">{m.viral_title_2()}</span>
            </h2>
          </div>
          <Link to="/feed" className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:inline">
            {m.viral_see_all()}
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
                <img src={p.cover} alt={p.title} loading="lazy" decoding="async" width={720} height={1120} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                <div className="absolute start-3 top-3"><SignalBadge signal={p.signal ?? null} score={p.viralScore} /></div>
                <div className="absolute end-3 top-3 flex flex-col gap-2">
                  {[
                    { Icon: Heart, label: "Like" },
                    { Icon: MessageCircle, label: "Comment" },
                    { Icon: Share2, label: "Share" },
                  ].map(({ Icon, label }) => (
                    <span key={label} aria-label={label} role="img" className="grid h-10 w-10 place-items-center rounded-full border border-foreground/20 bg-background/40 backdrop-blur transition hover:border-magenta/60">
                      <Icon aria-hidden="true" className="h-4 w-4" />
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
            <p className="text-[11px] uppercase tracking-[0.28em] text-gold/80">{m.ranking_eyebrow()}</p>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {m.ranking_title()}
            </h2>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              {m.ranking_subtitle()}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["12,480", m.ranking_stat_prompts()],
              ["1.4M", m.ranking_stat_renders()],
              ["98", m.ranking_stat_viral()],
              ["284k", m.ranking_stat_creators()],
              ["$0", m.ranking_stat_cost()],
              ["70%", m.ranking_stat_share()],
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
        <img src={heroImg} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(120deg, oklch(0.13 0.012 40 / 0.9), oklch(0.13 0.012 40 / 0.4))" }} />
        <div className="relative grid gap-6 p-8 sm:p-14 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-magenta/30 bg-magenta/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-magenta">
              {m.founders_badge()}
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {m.founders_title_1()}
              <br /> <span className="text-gradient-gold italic">{m.founders_title_2()}</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              {m.founders_subtitle()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-full px-5 py-3 text-sm font-medium text-white" style={{ background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)" }}>
              {m.founders_cta_reserve()}
            </button>
            <button className="rounded-full border border-border bg-surface/60 px-5 py-3 text-sm text-foreground backdrop-blur">
              {m.founders_cta_timeline()}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}