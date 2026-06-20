import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Bookmark, Check, Copy, Crown, Heart, Lock, Share2, Sparkles } from "lucide-react";
import { getPrompt, PROMPTS, type Prompt } from "@/lib/prompts";
import { Header } from "@/components/xeomx/Header";
import { PromptCard } from "@/components/xeomx/PromptCard";

export const Route = createFileRoute("/prompt/$id")({
  loader: ({ params }) => {
    const prompt = getPrompt(params.id);
    if (!prompt) throw notFound();
    return { prompt };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.prompt.title} — XeomX` },
          { name: "description", content: loaderData.prompt.prompt.slice(0, 150) },
          { property: "og:title", content: `${loaderData.prompt.title} — XeomX` },
          { property: "og:description", content: loaderData.prompt.prompt.slice(0, 150) },
          { property: "og:image", content: loaderData.prompt.cover },
          { name: "twitter:image", content: loaderData.prompt.cover },
        ]
      : [],
  }),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <h1 className="font-display text-4xl">Prompt not found</h1>
        <Link to="/" className="mt-4 inline-block text-magenta">Back to discovery</Link>
      </div>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <h1 className="font-display text-2xl">Something glitched.</h1>
        <button onClick={reset} className="mt-4 rounded-full border border-border px-4 py-2 text-sm">Retry</button>
      </div>
    </div>
  ),
  component: Detail,
});

function Detail() {
  const { prompt } = Route.useLoaderData() as { prompt: Prompt };
  const [copied, setCopied] = useState(false);
  const locked = prompt.state === "soon";

  const onCopy = async () => {
    if (locked) return;
    await navigator.clipboard.writeText(prompt.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const related = PROMPTS.filter((p) => p.id !== prompt.id).slice(0, 4);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Cinematic backdrop */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={prompt.cover} alt="" className="h-full w-full object-cover opacity-40 blur-2xl scale-110" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/85 to-background" />
        </div>

        <div className="relative mx-auto max-w-[1200px] px-4 pb-12 pt-10 sm:px-8 sm:pt-16">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to library
          </Link>

          <div className="mt-8 grid gap-10 lg:grid-cols-[420px_minmax(0,1fr)] lg:gap-14">
            {/* Poster */}
            <div className="relative overflow-hidden rounded-3xl border border-border shadow-[var(--shadow-card)]">
              <img src={prompt.cover} alt={prompt.title} className="aspect-[4/5] w-full object-cover" />
              <div className="absolute left-4 top-4 flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                  style={
                    prompt.state === "premium"
                      ? { background: "var(--gradient-gold)", color: "oklch(0.18 0.02 60)" }
                      : prompt.state === "soon"
                      ? { background: "color-mix(in oklab, var(--magenta) 18%, transparent)", color: "var(--magenta)", border: "1px solid color-mix(in oklab, var(--magenta) 40%, transparent)" }
                      : { background: "color-mix(in oklab, var(--foreground) 12%, transparent)", color: "var(--foreground)" }
                  }
                >
                  {prompt.state === "premium" ? <Crown className="h-3 w-3" /> : prompt.state === "soon" ? <Lock className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                  {prompt.state === "premium" ? "Premium" : prompt.state === "soon" ? "Coming soon" : "Free"}
                </span>
              </div>
            </div>

            {/* Detail */}
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-magenta/80">{prompt.category} · {prompt.author}</p>
              <h1 className="mt-3 font-display text-4xl font-semibold leading-[0.98] tracking-tight sm:text-5xl lg:text-6xl">
                {prompt.title}
              </h1>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>▶ {prompt.views} views</span>
                <span>·</span>
                <span>❤ {prompt.likes}</span>
                <span>·</span>
                <span>Updated this week</span>
              </div>

              {/* Prompt focus box */}
              <div className="glass mt-8 rounded-2xl p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">The prompt</span>
                  <div className="flex gap-2">
                    <button className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface/60 transition hover:border-magenta/40">
                      <Bookmark className="h-4 w-4" />
                    </button>
                    <button className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface/60 transition hover:border-magenta/40">
                      <Heart className="h-4 w-4" />
                    </button>
                    <button className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface/60 transition hover:border-magenta/40">
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="font-display text-lg leading-relaxed text-foreground/90 sm:text-xl">
                  {locked ? "🔒 This prompt unlocks when the Founders drop goes live. Reserve a slot to be first in line." : prompt.prompt}
                </p>

                <button
                  onClick={onCopy}
                  disabled={locked}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)" }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {locked ? "Locked — coming soon" : copied ? "Copied to clipboard" : "Copy prompt"}
                </button>
              </div>

              {/* Breakdown */}
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {prompt.breakdown.map((b) => (
                  <div key={b.label} className="rounded-2xl border border-border bg-surface/50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{b.label}</p>
                    <p className="mt-1 font-display text-lg">{b.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related */}
      <section className="mx-auto max-w-[1400px] px-4 pb-20 sm:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-magenta/80">If you liked this</p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">More from the library</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {related.map((p) => (
            <PromptCard key={p.id} prompt={p} />
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 px-4 py-10 text-center text-xs text-muted-foreground sm:px-8">
        © 2026 XeomX — The cinema of prompts.
      </footer>
    </div>
  );
}