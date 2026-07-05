import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Share2, Bookmark, Clock } from "lucide-react";
import { Header } from "@/components/xeomx/Header";
import { ARTICLES } from "./magazine";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/magazine/$slug")({
  loader: ({ params }) => {
    const article = ARTICLES.find((a) => a.slug === params.slug);
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.article.title} — XeomX Magazine` },
          { name: "description", content: loaderData.article.dek },
          { property: "og:title", content: loaderData.article.title },
          { property: "og:description", content: loaderData.article.dek },
        ]
      : [{ title: m.magazine_not_found_title() }, { name: "robots", content: "noindex" }],
  }),
  component: ArticlePage,
  notFoundComponent: () => (
    <div className="min-h-svh" style={{ background: "var(--surface-primary)" }}>
      <Header />
      <div
        className="mx-auto text-center"
        style={{ maxWidth: 640, paddingInline: "var(--space-5)", paddingBlock: "var(--space-9)" }}
      >
        <h1 className="font-display" style={{ fontSize: "var(--font-size-h1)", color: "var(--text-primary)" }}>
          {m.magazine_not_found_title()}
        </h1>
        <Link
          to="/magazine"
          className="mt-6 inline-flex items-center gap-2 rounded-full"
          style={{
            marginTop: "var(--space-5)",
            paddingInline: "var(--space-4)",
            paddingBlock: "var(--space-2)",
            background: "var(--surface-tertiary)",
            color: "var(--text-secondary)",
            fontSize: "var(--font-size-caption)",
          }}
        >
          <ArrowLeft className="h-4 w-4" /> {m.magazine_back()}
        </Link>
      </div>
    </div>
  ),
});

const CAT_COLOR = {
  spotlight: "var(--color-gold-500)",
  tutorial: "var(--color-orange-500)",
  news: "var(--color-magenta-500)",
} as const;

const CAT_GRADIENT = {
  spotlight: "linear-gradient(135deg, #3a2410 0%, #8a5f1a 55%, #ffc14d 100%)",
  tutorial: "linear-gradient(135deg, #1b1b1b 0%, #c74608 55%, #ffa15a 100%)",
  news: "linear-gradient(135deg, #1b0a1a 0%, #b40f5b 55%, #ff7ab8 100%)",
} as const;

function catLabel(c: "spotlight" | "tutorial" | "news") {
  return c === "spotlight" ? m.magazine_cat_spotlight() : c === "tutorial" ? m.magazine_cat_tutorial() : m.magazine_cat_news();
}

const BODY: { heading: string; paragraphs: string[] }[] = [
  {
    heading: "The prompt as a room, not a sentence",
    paragraphs: [
      "The prompts that endure treat the frame like architecture. Before the subject, before the lighting, there is a decision about the room the image lives in — its ceiling, its air, the temperature of its shadows.",
      "That is the discipline behind the Nocturne look: every prompt is a small blueprint. Nothing is left to the model's default sense of taste, because the default is always the mean of the internet.",
    ],
  },
  {
    heading: "Chiaroscuro, in tokens",
    paragraphs: [
      "Chiaroscuro is not a filter. It is the deliberate loss of information, and models are, by nature, information-maximisers. To coax one into painting like Caravaggio you have to give it permission to hide most of the frame.",
      "The recipe is small: a warm key at a shallow angle, no fill, a distant catch-light, and — critically — a background that reads as depth rather than backdrop. Everything else is subject.",
    ],
  },
  {
    heading: "Why this generation matters",
    paragraphs: [
      "There is a version of this story where AI images are the end of taste. The Nocturne wave is the counter-argument: a small collective of creators showing that a strong point of view still travels further than any model release.",
      "The lesson for the next twelve months is not about tools. It is about the vocabulary you build around them.",
    ],
  },
];

function ArticlePage() {
  const { article } = Route.useLoaderData();
  const related = ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 3);
  const cat = article.category as keyof typeof CAT_COLOR;
  const color = CAT_COLOR[cat];
  const gradient = CAT_GRADIENT[cat];

  return (
    <div className="min-h-svh" style={{ background: "var(--surface-primary)" }}>
      <Header />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto"
        style={{ maxWidth: 1200, paddingInline: "var(--space-5)", paddingBlock: "var(--space-7)" }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-6)" }}>
          <Link
            to="/magazine"
            className="inline-flex items-center gap-2 transition hover:text-white"
            style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
          >
            <ArrowLeft className="h-4 w-4" /> {m.magazine_back()}
          </Link>
          <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
            <IconAction label={m.magazine_share()}>
              <Share2 className="h-4 w-4" />
            </IconAction>
            <IconAction label={m.magazine_save()}>
              <Bookmark className="h-4 w-4" />
            </IconAction>
          </div>
        </div>

        {/* Header block */}
        <header className="mx-auto text-center" style={{ maxWidth: 820 }}>
          <span
            style={{
              fontSize: "var(--font-size-micro)",
              color,
              textTransform: "uppercase",
              letterSpacing: "0.24em",
              fontWeight: 600,
            }}
          >
            {catLabel(cat)}
          </span>
          <h1
            className="font-display font-bold"
            style={{
              marginTop: "var(--space-4)",
              fontSize: "clamp(2rem, 4.4vw, var(--font-size-display))",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            {article.title}
          </h1>
          <p
            style={{
              marginTop: "var(--space-4)",
              fontSize: "var(--font-size-body-lg)",
              lineHeight: 1.6,
              color: "var(--text-secondary)",
            }}
          >
            {article.dek}
          </p>
          <div
            className="flex flex-wrap items-center justify-center"
            style={{
              marginTop: "var(--space-5)",
              gap: "var(--space-3)",
              fontSize: "var(--font-size-caption)",
              color: "var(--text-muted)",
            }}
          >
            <span className="inline-flex items-center" style={{ gap: "var(--space-2)" }}>
              <span
                aria-hidden
                className="grid place-items-center rounded-full font-semibold"
                style={{ width: 28, height: 28, background: gradient, color: "#fff", fontSize: 12 }}
              >
                {article.author.replace("@", "").slice(0, 1).toUpperCase()}
              </span>
              <span style={{ color: "var(--text-secondary)" }}>{article.author}</span>
            </span>
            <span aria-hidden>·</span>
            <span>Jul 4, 2026</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center" style={{ gap: "var(--space-2)" }}>
              <Clock className="h-3.5 w-3.5" /> {article.readTime} {m.magazine_read_time()}
            </span>
          </div>
        </header>

        {/* Hero image */}
        <div
          aria-hidden
          className="overflow-hidden rounded-3xl"
          style={{
            marginTop: "var(--space-7)",
            aspectRatio: "16/9",
            background: gradient,
            boxShadow: "var(--elevation-elevated)",
          }}
        />

        {/* Body + sidebar */}
        <div
          className="grid gap-8"
          style={{ marginTop: "var(--space-7)", gridTemplateColumns: "minmax(0, 1fr)" }}
        >
          <div
            className="grid gap-8 lg:[grid-template-columns:minmax(0,1fr)_280px]"
          >
            <article
              className="mx-auto"
              style={{ maxWidth: 700, width: "100%" }}
            >
              {BODY.map((section, i) => (
                <section key={section.heading} style={{ marginBottom: "var(--space-7)" }}>
                  <h2
                    id={`section-${i}`}
                    className="font-display font-semibold"
                    style={{
                      fontSize: "var(--font-size-h2)",
                      color: "var(--text-primary)",
                      letterSpacing: "-0.01em",
                      marginBottom: "var(--space-4)",
                    }}
                  >
                    {section.heading}
                  </h2>
                  {section.paragraphs.map((p, j) => (
                    <p
                      key={j}
                      style={{
                        fontSize: "var(--font-size-body-lg)",
                        lineHeight: 1.75,
                        color: "var(--text-secondary)",
                        marginBottom: "var(--space-4)",
                      }}
                    >
                      {p}
                    </p>
                  ))}
                  {i === 1 && (
                    <blockquote
                      style={{
                        marginBlock: "var(--space-6)",
                        paddingInlineStart: "var(--space-5)",
                        borderInlineStart: `3px solid var(--color-orange-400)`,
                        fontStyle: "italic",
                        fontSize: "var(--font-size-h3)",
                        lineHeight: 1.5,
                        color: "var(--color-orange-400)",
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      "A prompt is a small blueprint. Nothing is left to the model's default sense of taste — because the default is always the mean of the internet."
                    </blockquote>
                  )}
                </section>
              ))}
            </article>

            {/* Sidebar */}
            <aside className="hidden lg:block">
              <div className="sticky" style={{ top: "var(--space-7)", display: "grid", gap: "var(--space-4)" }}>
                <TocCard sections={BODY.map((b) => b.heading)} />
                <AuthorCard author={article.author} gradient={gradient} />
                <FeaturedCollectionCard tone={article.category} />
              </div>
            </aside>
          </div>
        </div>

        {/* Related */}
        <section style={{ marginTop: "var(--space-9)" }}>
          <h2
            className="font-display font-semibold"
            style={{ fontSize: "var(--font-size-h2)", color: "var(--text-primary)", marginBottom: "var(--space-5)" }}
          >
            {m.magazine_related()}
          </h2>
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
          >
            {related.map((a) => (
              <Link
                key={a.slug}
                to="/magazine/$slug"
                params={{ slug: a.slug }}
                className="surface-raised group overflow-hidden rounded-2xl transition hover:scale-[1.02]"
                style={{ transitionDuration: "var(--motion-duration-base)" }}
              >
                <div aria-hidden style={{ aspectRatio: "16/10", background: CAT_GRADIENT[a.category] }} />
                <div style={{ padding: "var(--space-4)" }}>
                  <div
                    style={{
                      fontSize: "var(--font-size-micro)",
                      color: CAT_COLOR[a.category],
                      textTransform: "uppercase",
                      letterSpacing: "0.2em",
                      fontWeight: 600,
                    }}
                  >
                    {catLabel(a.category)}
                  </div>
                  <div
                    className="font-display"
                    style={{ marginTop: "var(--space-2)", fontSize: "var(--font-size-body-lg)", color: "var(--text-primary)", lineHeight: 1.3 }}
                  >
                    {a.title}
                  </div>
                  <div style={{ marginTop: "var(--space-3)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>
                    {a.author} · {a.readTime} {m.magazine_read_time()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </motion.div>
    </div>
  );
}

function IconAction({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      aria-label={label}
      className="rounded-full transition hover:text-white"
      style={{
        padding: "var(--space-2)",
        color: "var(--text-tertiary)",
        background: "var(--surface-tertiary)",
        border: "1px solid var(--border-default)",
      }}
    >
      {children}
    </button>
  );
}

function TocCard({ sections }: { sections: string[] }) {
  return (
    <div className="surface-raised rounded-2xl" style={{ padding: "var(--space-4)" }}>
      <div
        style={{
          fontSize: "var(--font-size-micro)",
          textTransform: "uppercase",
          letterSpacing: "0.22em",
          color: "var(--text-muted)",
          marginBottom: "var(--space-3)",
        }}
      >
        {m.magazine_toc()}
      </div>
      <ol style={{ display: "grid", gap: "var(--space-2)" }}>
        {sections.map((s, i) => (
          <li key={s}>
            <a
              href={`#section-${i}`}
              className="block transition hover:text-white"
              style={{
                fontSize: "var(--font-size-caption)",
                color: i === 0 ? "var(--action-primary)" : "var(--text-secondary)",
                paddingInlineStart: "var(--space-3)",
                borderInlineStart: `2px solid ${i === 0 ? "var(--action-primary)" : "transparent"}`,
                paddingBlock: "var(--space-1)",
              }}
            >
              {s}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AuthorCard({ author, gradient }: { author: string; gradient: string }) {
  return (
    <div className="surface-raised rounded-2xl" style={{ padding: "var(--space-4)" }}>
      <div
        style={{
          fontSize: "var(--font-size-micro)",
          textTransform: "uppercase",
          letterSpacing: "0.22em",
          color: "var(--text-muted)",
          marginBottom: "var(--space-3)",
        }}
      >
        {m.magazine_about_author()}
      </div>
      <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
        <span
          aria-hidden
          className="grid place-items-center rounded-full font-semibold"
          style={{ width: 40, height: 40, background: gradient, color: "#fff" }}
        >
          {author.replace("@", "").slice(0, 1).toUpperCase()}
        </span>
        <div>
          <div style={{ fontSize: "var(--font-size-body)", color: "var(--text-primary)" }}>{author}</div>
          <div style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>Nocturne collective · 12 stories</div>
        </div>
      </div>
      <p
        style={{
          marginTop: "var(--space-3)",
          fontSize: "var(--font-size-caption)",
          lineHeight: 1.6,
          color: "var(--text-tertiary)",
        }}
      >
        Cinematographer of prompts. Working in the space between baroque portraiture and near-future cinema.
      </p>
    </div>
  );
}

function FeaturedCollectionCard({ tone }: { tone: "spotlight" | "tutorial" | "news" }) {
  return (
    <Link
      to="/collections"
      className="surface-raised group block overflow-hidden rounded-2xl transition hover:scale-[1.02]"
      style={{ transitionDuration: "var(--motion-duration-base)" }}
    >
      <div aria-hidden style={{ aspectRatio: "16/9", background: CAT_GRADIENT[tone] }} />
      <div style={{ padding: "var(--space-4)" }}>
        <div
          style={{
            fontSize: "var(--font-size-micro)",
            textTransform: "uppercase",
            letterSpacing: "0.22em",
            color: "var(--text-muted)",
          }}
        >
          {m.magazine_featured_collection()}
        </div>
        <div
          className="font-display"
          style={{ marginTop: "var(--space-2)", fontSize: "var(--font-size-body-lg)", color: "var(--text-primary)" }}
        >
          Nocturne Portraits
        </div>
        <div style={{ marginTop: "var(--space-2)", fontSize: "var(--font-size-caption)", color: "var(--action-primary)" }}>
          {m.magazine_view_collection()} →
        </div>
      </div>
    </Link>
  );
}