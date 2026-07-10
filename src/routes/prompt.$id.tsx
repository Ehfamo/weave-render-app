import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Bookmark, Check, Copy, Crown, Heart, Lock, Share2, Shuffle, Sparkles, Trash2, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Prompt } from "@/lib/prompts";
import {
  fetchPromptBySlug,
  fetchRelatedPrompts,
  recordPromptView,
  togglePromptLike,
  togglePromptSave,
  fetchViewerEngagement,
  fetchComments,
  postComment,
  deleteComment,
} from "@/lib/marketplace";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/xeomx/Header";
import { PromptCard } from "@/components/xeomx/PromptCard";
import { SignalBadge } from "@/components/xeomx/Signal";
import { pageUrl, SITE_URL } from "@/lib/seo";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/prompt/$id")({
  loader: async ({ params }) => {
    const res = await fetchPromptBySlug(params.id);
    if (!res) throw notFound();
    return { prompt: res.prompt, promptId: res.row.id };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ name: "robots", content: "noindex" }] };
    const { prompt } = loaderData;
    const absoluteCover = prompt.cover.startsWith("http")
      ? prompt.cover
      : `${SITE_URL}${prompt.cover}`;
    const url = pageUrl(`/prompt/${params.id}`);
    return {
      meta: [
        { title: `${prompt.title} — XeomX` },
        { name: "description", content: prompt.prompt.slice(0, 150) },
        { property: "og:title", content: `${prompt.title} — XeomX` },
        { property: "og:description", content: prompt.prompt.slice(0, 150) },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:image", content: absoluteCover },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:site", content: "@xeomxai" },
        { name: "twitter:title", content: `${prompt.title} — XeomX` },
        { name: "twitter:description", content: prompt.prompt.slice(0, 150) },
        { name: "twitter:image", content: absoluteCover },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <h1 className="font-display text-4xl">{m.prompt_not_found()}</h1>
        <Link to="/" className="mt-4 inline-block text-magenta">{m.nav_back_discovery()}</Link>
      </div>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <h1 className="font-display text-2xl">{m.prompt_something_glitched()}</h1>
        <button onClick={reset} className="mt-4 rounded-full border border-border px-4 py-2 text-sm">{m.common_retry()}</button>
      </div>
    </div>
  ),
  component: Detail,
});

function Detail() {
  const { prompt, promptId } = Route.useLoaderData();
  const params = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const locked = prompt.state === "soon";

  // Record a view once per mount
  useEffect(() => {
    recordPromptView(promptId).catch(() => {});
  }, [promptId]);

  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then((r) => setUid(r.data.user?.id ?? null));
  }, []);

  const { data: engagement } = useQuery({
    queryKey: ["engagement", promptId, uid],
    queryFn: () => fetchViewerEngagement(promptId),
    enabled: !!uid,
  });

  const requireAuth = () => {
    if (!uid) {
      navigate({ to: "/auth" });
      return false;
    }
    return true;
  };

  const likeMut = useMutation({
    mutationFn: (on: boolean) => togglePromptLike(promptId, on),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engagement", promptId, uid] });
      queryClient.invalidateQueries({ queryKey: ["prompt", params.id] });
    },
  });
  const saveMut = useMutation({
    mutationFn: (on: boolean) => togglePromptSave(promptId, on),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engagement", promptId, uid] });
    },
  });

  const { data: related = [] } = useQuery<Prompt[]>({
    queryKey: ["related", promptId],
    queryFn: async () => {
      const res = await fetchPromptBySlug(params.id);
      if (!res) return [];
      return fetchRelatedPrompts(res.row, 4);
    },
  });

  const onCopy = async () => {
    if (locked) return;
    await navigator.clipboard.writeText(prompt.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const engine = null;
  const fmt = (n?: number) => (n ? (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n)) : "—");

  const onShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && (navigator as unknown as { share?: (d: { url: string; title?: string }) => Promise<void> }).share) {
        await (navigator as unknown as { share: (d: { url: string; title?: string }) => Promise<void> }).share({ url, title: prompt.title });
      } else if (typeof navigator !== "undefined") {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={prompt.cover} alt="" className="h-full w-full object-cover opacity-40 blur-2xl scale-110" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/85 to-background" />
        </div>

        <div className="relative mx-auto max-w-[1200px] px-4 pb-12 pt-10 sm:px-8 sm:pt-16">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {m.nav_back_library()}
          </Link>

          <div
            className="grid lg:grid-cols-[420px_minmax(0,1fr)]"
            style={{ marginTop: "var(--space-6)", gap: "var(--space-6)" }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="surface-elevated relative overflow-hidden rounded-3xl"
            >
              <img src={prompt.cover} alt={prompt.title} className="aspect-[4/5] w-full object-cover" />
              <div className="absolute start-4 top-4 flex items-center gap-2">
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
                  {prompt.state === "premium" ? m.common_premium() : prompt.state === "soon" ? m.common_coming_soon() : m.common_free()}
                </span>
              </div>
            </motion.div>

            <div>
              <p
                className="uppercase tracking-[0.28em] text-magenta/80"
                style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
              >
                {prompt.category} · {prompt.author}
              </p>
              <h1
                className="font-display font-bold leading-[0.98] tracking-tight"
                style={{ marginTop: "var(--space-3)", fontSize: "clamp(2rem, 5vw, var(--font-size-h1))" }}
              >
                {prompt.title}
              </h1>
              <div
                className="flex flex-wrap items-center"
                style={{
                  marginTop: "var(--space-4)",
                  gap: "var(--space-3)",
                  fontSize: "var(--font-size-caption)",
                  color: "var(--text-muted)",
                }}
              >
                <span>▶ {prompt.views} {m.prompt_views()}</span>
                <span>·</span>
                <span>❤ {prompt.likes}</span>
                <span>·</span>
                <span>{m.prompt_updated_week()}</span>
                <SignalBadge signal={prompt.signal ?? null} score={prompt.viralScore} />
              </div>

              <div
                className="grid grid-cols-4"
                style={{ marginTop: "var(--space-5)", gap: "var(--space-2)" }}
              >
                {[
                  { label: m.prompt_stat_copies(), value: fmt(prompt.copies), Icon: Copy },
                  { label: m.prompt_stat_saves(), value: fmt(prompt.saves), Icon: Bookmark },
                  { label: m.prompt_stat_shares(), value: fmt(prompt.shares), Icon: Share2 },
                  { label: m.prompt_stat_remixes(), value: fmt(prompt.remixes), Icon: Shuffle },
                ].map(({ label, value, Icon }) => (
                  <div
                    key={label}
                    className="surface-raised rounded-xl p-3"
                  >
                    <Icon className="h-3.5 w-3.5 text-magenta" />
                    <p className="mt-1.5 font-display text-lg leading-none">{value}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              <div
                className="rounded-2xl"
                style={{
                  marginTop: "var(--space-6)",
                  padding: "var(--space-5)",
                  backgroundColor: "var(--surface-secondary)",
                }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{m.prompt_the_prompt()}</span>
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
                  {locked ? m.prompt_locked_message() : prompt.prompt}
                </p>

                <div
                  className="flex flex-wrap"
                  style={{ marginTop: "var(--space-5)", gap: "var(--space-3)" }}
                >
                  <button
                    onClick={onCopy}
                    disabled={locked}
                    className="inline-flex flex-1 items-center justify-center gap-2 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--action-primary)",
                      borderRadius: "var(--radius-sm)",
                      paddingInline: "var(--space-5)",
                      paddingBlock: "var(--space-3)",
                      transitionDuration: "var(--motion-duration-fast)",
                      transitionTimingFunction: "var(--motion-ease)",
                    }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {locked ? m.prompt_locked_button() : copied ? m.prompt_copied_button() : m.prompt_copy_button()}
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium text-foreground transition hover:border-magenta/40"
                    style={{
                      border: "1px solid var(--border-default)",
                      backgroundColor: "var(--surface-glass)",
                      borderRadius: "var(--radius-sm)",
                      paddingInline: "var(--space-5)",
                      paddingBlock: "var(--space-3)",
                      transitionDuration: "var(--motion-duration-fast)",
                      transitionTimingFunction: "var(--motion-ease)",
                    }}
                  >
                    <Shuffle className="h-4 w-4" /> {m.prompt_stat_remixes()}
                  </button>
                </div>
              </div>

              <div
                className="grid sm:grid-cols-2"
                style={{ marginTop: "var(--space-6)", gap: "var(--space-3)" }}
              >
                {prompt.breakdown.map((b) => (
                  <div key={b.label} className="surface-raised rounded-2xl p-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{b.label}</p>
                    <p className="mt-1 font-display text-lg">{b.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {engine ? (
        <section className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-8">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-gold/80">{m.prompt_engine_eyebrow()}</p>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{m.prompt_engine_title()}</h2>
            </div>
            <span className="hidden text-[11px] uppercase tracking-[0.22em] text-muted-foreground sm:inline">{m.prompt_engine_framework()}</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-5">
            {([
              [m.prompt_engine_role(), engine.role],
              [m.prompt_engine_context(), engine.context],
              [m.prompt_engine_instructions(), engine.instructions],
              [m.prompt_engine_output(), engine.output],
              [m.prompt_engine_constraints(), engine.constraints],
            ] as const).map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-border bg-surface/50 p-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-magenta">{k}</p>
                <p className="mt-3 text-sm leading-relaxed text-foreground/90">{v}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-magenta/80">{m.prompt_sample_eyebrow()}</p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{m.prompt_sample_title()}</h2>
          </div>
          <span className="hidden text-[11px] uppercase tracking-[0.22em] text-muted-foreground sm:inline">{m.prompt_sample_meta()}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => {
            const variant = related[i] ?? prompt;
            return (
              <div key={i} className="group relative overflow-hidden rounded-2xl border border-border">
                <img src={variant.cover} alt="" className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
                  <span className="rounded-full border border-border/60 bg-background/60 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
                    {m.prompt_variant()} {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-gold backdrop-blur">
                    {m.prompt_render_chip()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pb-20 sm:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-magenta/80">{m.prompt_related_eyebrow()}</p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{m.prompt_related_title()}</h2>
          </div>
          <span className="hidden items-center gap-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground sm:inline-flex">
            <TrendingUp className="h-3 w-3" /> {m.prompt_algo_ranked()}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {related.map((p) => (
            <PromptCard key={p.id} prompt={p} />
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 px-4 py-10 text-center text-xs text-muted-foreground sm:px-8">
        {m.prompt_footer()}
      </footer>
    </div>
  );
}
