import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Bookmark, Check, Copy, Crown, Heart, Lock, Share2, Shuffle, Sparkles, Trash2, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Prompt } from "@/lib/prompts";
import { getPrompt as getLocalPrompt, PROMPTS } from "@/lib/prompts";
import { toast } from "sonner";
import { ComingSoonModal } from "@/components/xeomx/status/ComingSoonModal";
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
    // Prefer real DB row. If not yet imported to DB, fall back to the local
    // curated catalog so known slugs render as PREVIEW instead of 404.
    try {
      const res = await fetchPromptBySlug(params.id);
      if (res) return { prompt: res.prompt, promptId: res.row.id, source: "db" as const };
    } catch {
      /* fall through to local */
    }
    const local = getLocalPrompt(params.id);
    if (local) return { prompt: local, promptId: null, source: "local" as const };
    throw notFound();
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Prompt not found — XeomX" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { prompt } = loaderData;
    const absoluteCover = prompt.cover.startsWith("http")
      ? prompt.cover
      : `${SITE_URL}${prompt.cover}`;
    const url = pageUrl(`/prompt/${params.id}`);
    const isPreview = loaderData.source === "local";
    const meta = [
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
    ];
    if (isPreview) meta.push({ name: "robots", content: "noindex" });
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-4xl">{m.prompt_not_found()}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {m.root_404_desc?.() ?? ""}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/explore" className="rounded-full bg-magenta px-5 py-2 text-sm font-medium text-white">
            {m.root_404_cta_explore?.() ?? "Discover"}
          </Link>
          <Link to="/" className="rounded-full border border-border px-5 py-2 text-sm">
            {m.nav_back_discovery()}
          </Link>
        </div>
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
  const { prompt, promptId, source } = Route.useLoaderData();
  const params = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const locked = prompt.state === "soon";
  const isPreview = source === "local";
  const [saveComingSoon, setSaveComingSoon] = useState(false);

  // Record a view once per mount (DB-backed prompts only)
  useEffect(() => {
    if (!promptId) return;
    recordPromptView(promptId).catch(() => {});
  }, [promptId]);

  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then((r) => setUid(r.data.user?.id ?? null));
  }, []);

  const { data: engagement } = useQuery({
    queryKey: ["engagement", promptId, uid],
    queryFn: () => fetchViewerEngagement(promptId as string),
    enabled: !!uid && !!promptId,
  });

  const requireAuth = () => {
    if (!uid) {
      navigate({ to: "/auth", search: { next: undefined } });
      return false;
    }
    return true;
  };

  const likeMut = useMutation({
    mutationFn: (on: boolean) => togglePromptLike(promptId as string, on),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engagement", promptId, uid] });
      queryClient.invalidateQueries({ queryKey: ["prompt", params.id] });
    },
    onError: () => toast.error("Couldn't update like — try again."),
  });
  const saveMut = useMutation({
    mutationFn: (on: boolean) => togglePromptSave(promptId as string, on),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engagement", promptId, uid] });
    },
    onError: () => toast.error("Couldn't save prompt — try again."),
  });

  const { data: related = [] } = useQuery<Prompt[]>({
    queryKey: ["related", promptId],
    queryFn: async () => {
      if (!promptId) {
        // Local preview: derive related from local catalog via slug + category.
        const rel = (prompt.related ?? [])
          .map((slug) => PROMPTS.find((p) => p.id === slug))
          .filter((p): p is Prompt => !!p)
          .slice(0, 4);
        if (rel.length) return rel;
        return PROMPTS.filter((p) => p.id !== prompt.id && p.category === prompt.category).slice(0, 4);
      }
      const res = await fetchPromptBySlug(params.id);
      if (!res) return [];
      return fetchRelatedPrompts(res.row, 4);
    },
  });

  const onCopy = async () => {
    if (locked) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(prompt.prompt);
      setCopied(true);
      toast.success(m.prompt_copied_button());
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy — select the text manually.");
    }
  };

  const onSaveClick = () => {
    if (isPreview) {
      setSaveComingSoon(true);
      return;
    }
    if (requireAuth()) saveMut.mutate(!engagement?.saved);
  };
  const onLikeClick = () => {
    if (isPreview) {
      setSaveComingSoon(true);
      return;
    }
    if (requireAuth()) likeMut.mutate(!engagement?.liked);
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
                    <button
                      type="button"
                      onClick={() => { if (requireAuth()) saveMut.mutate(!engagement?.saved); }}
                      aria-pressed={!!engagement?.saved}
                      className={`grid h-9 w-9 place-items-center rounded-full border transition ${engagement?.saved ? "border-magenta/60 bg-magenta/15 text-magenta" : "border-border bg-surface/60 hover:border-magenta/40"}`}
                    >
                      <Bookmark className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (requireAuth()) likeMut.mutate(!engagement?.liked); }}
                      aria-pressed={!!engagement?.liked}
                      className={`grid h-9 w-9 place-items-center rounded-full border transition ${engagement?.liked ? "border-magenta/60 bg-magenta/15 text-magenta" : "border-border bg-surface/60 hover:border-magenta/40"}`}
                    >
                      <Heart className={`h-4 w-4 ${engagement?.liked ? "fill-current" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={onShare}
                      className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface/60 transition hover:border-magenta/40"
                    >
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

              {prompt.breakdown.length > 0 && (
                <div
                  className="grid sm:grid-cols-2"
                  style={{ marginTop: "var(--space-6)", gap: "var(--space-3)" }}
                >
                  {prompt.breakdown.map((b: { label: string; value: string }) => (
                    <div key={b.label} className="surface-raised rounded-2xl p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{b.label}</p>
                      <p className="mt-1 font-display text-lg">{b.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {engine ? null : null}

      <CommentsSection promptId={promptId} viewerId={uid} onAuthRequired={() => navigate({ to: "/auth", search: { next: undefined } })} />

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

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function CommentsSection({ promptId, viewerId, onAuthRequired }: { promptId: string; viewerId: string | null; onAuthRequired: () => void }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["comments", promptId],
    queryFn: () => fetchComments(promptId),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`comments:${promptId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `prompt_id=eq.${promptId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["comments", promptId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [promptId, queryClient]);

  const post = useMutation({
    mutationFn: () => postComment(promptId, text),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["comments", promptId] });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comments", promptId] }),
  });

  return (
    <section className="mx-auto max-w-[900px] px-4 pb-16 sm:px-8">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-magenta/80">Discussion</p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Comments ({comments.length})</h2>
        </div>
      </div>

      {viewerId ? (
        <form
          onSubmit={(e) => { e.preventDefault(); if (text.trim()) post.mutate(); }}
          className="mb-6 rounded-2xl border border-border bg-surface/50 p-4"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share your thoughts…"
            rows={3}
            maxLength={2000}
            className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{text.length}/2000</span>
            <button
              type="submit"
              disabled={!text.trim() || post.isPending}
              className="rounded-full bg-magenta px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--action-primary)" }}
            >
              {post.isPending ? "Posting…" : "Post"}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={onAuthRequired}
          className="mb-6 w-full rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground transition hover:border-magenta/40 hover:text-foreground"
        >
          Sign in to join the discussion →
        </button>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Be the first to comment.</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => {
            const handle = c.author?.username ? `@${c.author.username}` : "anonymous";
            const name = c.author?.display_name || c.author?.username || "Anonymous";
            const mine = viewerId === c.author_id;
            return (
              <li key={c.id} className="rounded-2xl border border-border/60 bg-surface/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {c.author?.avatar_url ? (
                      <img src={c.author.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-magenta/20" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{name}</p>
                      <p className="text-[11px] text-muted-foreground">{handle} · {timeAgo(c.created_at)}</p>
                    </div>
                  </div>
                  {mine && (
                    <button
                      type="button"
                      onClick={() => del.mutate(c.id)}
                      className="text-muted-foreground transition hover:text-destructive"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{c.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
