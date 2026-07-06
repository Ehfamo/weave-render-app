import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { ArrowRight, Search, Clock } from "lucide-react";
import { Header } from "@/components/xeomx/Header";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/magazine")({
  head: () => ({
    meta: [
      { title: m.magazine_head_title() },
      { name: "description", content: m.magazine_head_desc() },
      { property: "og:title", content: m.magazine_head_title() },
      { property: "og:description", content: m.magazine_head_desc() },
    ],
  }),
  component: MagazinePage,
});

type Category = "spotlight" | "tutorial" | "news";

const CAT_COLOR: Record<Category, string> = {
  spotlight: "var(--color-gold-500)",
  tutorial: "var(--color-orange-500)",
  news: "var(--color-magenta-500)",
};

const CAT_GRADIENT: Record<Category, string> = {
  spotlight: "linear-gradient(135deg, #3a2410 0%, #8a5f1a 55%, #ffc14d 100%)",
  tutorial: "linear-gradient(135deg, #1b1b1b 0%, #c74608 55%, #ffa15a 100%)",
  news: "linear-gradient(135deg, #1b0a1a 0%, #b40f5b 55%, #ff7ab8 100%)",
};

function catLabel(c: Category) {
  return c === "spotlight" ? m.magazine_cat_spotlight() : c === "tutorial" ? m.magazine_cat_tutorial() : m.magazine_cat_news();
}

type Article = {
  slug: string;
  category: Category;
  title: string;
  dek: string;
  author: string;
  readTime: number;
};

export const ARTICLES: Article[] = [
  {
    slug: "nocturne-baroque-muse",
    category: "spotlight",
    title: "Nocturne's Baroque Muse: engineering divinity, one prompt at a time",
    dek: "How @nocturne turned candlelight, chiaroscuro and a single 47-token prompt into a defining aesthetic of the cinematic AI wave.",
    author: "@nocturne",
    readTime: 9,
  },
  {
    slug: "cyber-noir-lighting-recipe",
    category: "tutorial",
    title: "The Cyber Noir lighting recipe — from prompt to final grade",
    dek: "A step-by-step tutorial on shaping neon rim-light and rain-slick surfaces, with the exact modifiers that make it read as cinema.",
    author: "Studio Editorial",
    readTime: 12,
  },
  {
    slug: "gen-6-changed-the-frame",
    category: "news",
    title: "How Gen-6 quietly changed the frame for indie filmmakers",
    dek: "The new generation model landed without a headline event, yet it is already re-drawing what solo directors can ship in a weekend.",
    author: "XeomX Newsroom",
    readTime: 6,
  },
  {
    slug: "portrait-of-a-generation",
    category: "spotlight",
    title: "Portrait of a Generation: five creators shaping the Nocturne look",
    dek: "A conversation with the collective that turned baroque portraiture into the year's most-copied prompt lineage.",
    author: "Isla Vermeer",
    readTime: 11,
  },
  {
    slug: "prompt-composition-101",
    category: "tutorial",
    title: "Prompt composition 101 — the four-line structure that always renders",
    dek: "Subject, atmosphere, lighting, lens. A disciplined structure that survives model changes and unlocks reliably cinematic frames.",
    author: "Studio Editorial",
    readTime: 8,
  },
];

const COLLECTIONS = [
  { slug: "cyber-noir-series", title: "Cyber Noir Series", count: 24, tone: "news" as Category },
  { slug: "future-of-ai-cinema", title: "The Future of AI Cinema", count: 18, tone: "tutorial" as Category },
  { slug: "nocturne-portraits", title: "Nocturne Portraits", count: 32, tone: "spotlight" as Category },
  { slug: "editorial-picks", title: "Editorial Picks · 2026", count: 12, tone: "tutorial" as Category },
];

const FILTERS: { id: "all" | Category; label: () => string }[] = [
  { id: "all", label: () => m.magazine_filter_all() },
  { id: "spotlight", label: () => m.magazine_cat_spotlight() },
  { id: "tutorial", label: () => m.magazine_cat_tutorial() },
  { id: "news", label: () => m.magazine_cat_news() },
];

function MagazinePage() {
  const [filter, setFilter] = useState<"all" | Category>("all");
  const hero = ARTICLES[0];
  const curation = ARTICLES.slice(1, 4);
  const flow = filter === "all" ? ARTICLES : ARTICLES.filter((a) => a.category === filter);

  return (
    <div className="min-h-svh" style={{ background: "var(--surface-primary)" }}>
      <Header />
      <MagazineSubnav />

      {/* HERO */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto"
        style={{ maxWidth: 1400, paddingInline: "var(--space-5)", paddingBlock: "var(--space-7)" }}
      >
        <HeroFeature article={hero} />
      </motion.section>

      {/* CURATION */}
      <section className="mx-auto" style={{ maxWidth: 1400, paddingInline: "var(--space-5)", paddingBottom: "var(--space-8)" }}>
        <SectionHeader title={m.magazine_editors_curation()} />
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: "var(--space-5)" }}
        >
          {curation.map((a, i) => (
            <motion.div
              key={a.slug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            >
              <ArticleCard article={a} size="md" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* EDITORIAL FLOW */}
      <section className="mx-auto" style={{ maxWidth: 1400, paddingInline: "var(--space-5)", paddingBottom: "var(--space-8)" }}>
        <div className="flex flex-wrap items-center justify-between" style={{ gap: "var(--space-4)" }}>
          <SectionHeader title={m.magazine_editorial_flow()} />
          <div className="flex flex-wrap" style={{ gap: "var(--space-2)" }}>
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className="rounded-full transition"
                  style={{
                    paddingInline: "var(--space-4)",
                    paddingBlock: "var(--space-2)",
                    fontSize: "var(--font-size-caption)",
                    background: active ? "var(--action-primary)" : "var(--surface-tertiary)",
                    color: active ? "#fff" : "var(--text-secondary)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  {f.label()}
                </button>
              );
            })}
          </div>
        </div>
        <div
          className="scrollbar-hidden overflow-x-auto"
          style={{ marginTop: "var(--space-5)" }}
        >
          <div className="flex" style={{ gap: "var(--space-4)", paddingBottom: "var(--space-3)" }}>
            {flow.map((a, i) => (
              <motion.div
                key={a.slug}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                style={{ flex: "0 0 320px" }}
              >
                <ArticleCard article={a} size="sm" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* COLLECTIONS */}
      <section className="mx-auto" style={{ maxWidth: 1400, paddingInline: "var(--space-5)", paddingBottom: "var(--space-9)" }}>
        <SectionHeader title={m.magazine_collections_row()} />
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: "var(--space-5)" }}
        >
          {COLLECTIONS.map((c) => (
            <Link
              key={c.slug}
              to="/collections"
              className="surface-raised group block overflow-hidden rounded-2xl transition hover:scale-[1.02]"
              style={{ transitionDuration: "var(--motion-duration-base)" }}
            >
              <div
                aria-hidden
                style={{ aspectRatio: "16/10", background: CAT_GRADIENT[c.tone] }}
              />
              <div style={{ padding: "var(--space-4)" }}>
                <div
                  style={{
                    fontSize: "var(--font-size-micro)",
                    color: CAT_COLOR[c.tone],
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                  }}
                >
                  {catLabel(c.tone)}
                </div>
                <div
                  className="font-display"
                  style={{ marginTop: "var(--space-2)", fontSize: "var(--font-size-h3)", color: "var(--text-primary)" }}
                >
                  {c.title}
                </div>
                <div style={{ marginTop: "var(--space-2)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>
                  {c.count} prompts
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function MagazineSubnav() {
  return (
    <div
      className="border-b"
      style={{ borderColor: "var(--border-subtle)", background: "var(--surface-secondary)" }}
    >
      <div
        className="mx-auto flex items-center justify-between"
        style={{ maxWidth: 1400, paddingInline: "var(--space-5)", paddingBlock: "var(--space-4)" }}
      >
        <div className="flex items-center" style={{ gap: "var(--space-6)" }}>
          <span
            className="font-display font-bold"
            style={{ fontSize: "var(--font-size-h3)", color: "var(--text-primary)", letterSpacing: "-0.01em" }}
          >
            {m.magazine_title()}
          </span>
          <nav className="hidden items-center md:flex" style={{ gap: "var(--space-5)" }}>
            {[
              m.magazine_nav_stories(),
              m.magazine_nav_tutorials(),
              m.magazine_nav_news(),
              m.magazine_nav_collections(),
              m.magazine_nav_about(),
            ].map((label) => (
              <button
                key={label}
                className="transition hover:text-white"
                style={{ fontSize: "var(--font-size-caption)", color: "var(--text-tertiary)" }}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
        <button
          aria-label="Search magazine"
          className="rounded-full transition"
          style={{
            padding: "var(--space-2)",
            color: "var(--text-tertiary)",
            background: "var(--surface-tertiary)",
            border: "1px solid var(--border-default)",
          }}
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2
      className="font-display font-semibold"
      style={{ fontSize: "var(--font-size-h2)", color: "var(--text-primary)", letterSpacing: "-0.01em" }}
    >
      {title}
    </h2>
  );
}

function HeroFeature({ article }: { article: Article }) {
  return (
    <Link
      to="/magazine/$slug"
      params={{ slug: article.slug }}
      className="surface-raised group grid gap-0 overflow-hidden rounded-3xl md:grid-cols-[1.2fr_1fr]"
      style={{ transitionDuration: "var(--motion-duration-base)" }}
    >
      <div
        aria-hidden
        className="relative"
        style={{
          aspectRatio: "5/4",
          background: CAT_GRADIENT[article.category],
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 100%, rgba(0,0,0,0.55), transparent 70%)",
          }}
        />
      </div>
      <div
        className="flex flex-col justify-center"
        style={{ padding: "var(--space-7)", gap: "var(--space-4)" }}
      >
        <span
          style={{
            fontSize: "var(--font-size-micro)",
            color: CAT_COLOR[article.category],
            textTransform: "uppercase",
            letterSpacing: "0.24em",
            fontWeight: 600,
          }}
        >
          {catLabel(article.category)}
        </span>
        <h1
          className="font-display font-bold"
          style={{
            fontSize: "clamp(2rem, 4.4vw, var(--font-size-display))",
            lineHeight: 1.05,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          {article.title}
        </h1>
        <p style={{ fontSize: "var(--font-size-body-lg)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {article.dek}
        </p>
        <MetaRow author={article.author} readTime={article.readTime} />
        <span
          className="inline-flex w-fit items-center gap-2 rounded-full font-medium transition"
          style={{
            marginTop: "var(--space-3)",
            paddingInline: "var(--space-5)",
            paddingBlock: "var(--space-3)",
            fontSize: "var(--font-size-body)",
            background: "var(--action-primary)",
            color: "#fff",
            boxShadow: "var(--elevation-elevated)",
          }}
        >
          {m.magazine_read_story()} <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

function ArticleCard({ article, size }: { article: Article; size: "md" | "sm" }) {
  const titleSize = size === "md" ? "var(--font-size-h3)" : "var(--font-size-body-lg)";
  return (
    <Link
      to="/magazine/$slug"
      params={{ slug: article.slug }}
      className="surface-raised group block h-full overflow-hidden rounded-2xl transition hover:scale-[1.02]"
      style={{ transitionDuration: "var(--motion-duration-base)" }}
    >
      <div aria-hidden style={{ aspectRatio: "16/10", background: CAT_GRADIENT[article.category] }} />
      <div className="flex flex-col" style={{ padding: "var(--space-4)", gap: "var(--space-3)" }}>
        <span
          style={{
            fontSize: "var(--font-size-micro)",
            color: CAT_COLOR[article.category],
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            fontWeight: 600,
          }}
        >
          {catLabel(article.category)}
        </span>
        <h3
          className="font-display font-semibold"
          style={{ fontSize: titleSize, color: "var(--text-primary)", lineHeight: 1.25, letterSpacing: "-0.01em" }}
        >
          {article.title}
        </h3>
        <MetaRow author={article.author} readTime={article.readTime} compact />
      </div>
    </Link>
  );
}

function MetaRow({ author, readTime, compact = false }: { author: string; readTime: number; compact?: boolean }) {
  return (
    <div
      className="flex items-center"
      style={{
        gap: "var(--space-3)",
        fontSize: "var(--font-size-caption)",
        color: "var(--text-muted)",
      }}
    >
      <span style={{ color: "var(--text-secondary)" }}>
        {compact ? "" : `${m.magazine_by()} `}
        {author}
      </span>
      <span aria-hidden>·</span>
      <span className="inline-flex items-center" style={{ gap: "var(--space-2)" }}>
        <Clock className="h-3.5 w-3.5" /> {readTime} {m.magazine_read_time()}
      </span>
    </div>
  );
}