import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Layers } from "lucide-react";
import { fetchCollectionBySlug } from "@/lib/marketplace";
import type { Prompt } from "@/lib/prompts";
import { COLLECTIONS as LOCAL_COLLECTIONS, PROMPTS as LOCAL_PROMPTS } from "@/lib/prompts";
import { Header } from "@/components/xeomx/Header";
import { PromptCard } from "@/components/xeomx/PromptCard";
import { PreviewNotice } from "@/components/xeomx/status/PreviewNotice";
import { pageUrl, SITE_URL } from "@/lib/seo";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/collections/$id")({
  loader: async ({ params }) => {
    // Prefer real Supabase-backed data. Fall back to the local curated
    // catalog so known planned collections render as PREVIEW rather than 404.
    try {
      const res = await fetchCollectionBySlug(params.id);
      if (res) return { collection: res.collection, prompts: res.prompts, source: "db" as const };
    } catch {
      /* fall through */
    }
    const local = LOCAL_COLLECTIONS.find((c) => c.id === params.id);
    if (local) {
      const prompts = local.ids
        .map((pid) => LOCAL_PROMPTS.find((p) => p.id === pid))
        .filter((p): p is Prompt => !!p);
      // Real count == validly linked prompts, never fabricated.
      const collection = { ...local, count: prompts.length };
      return { collection, prompts, source: "local" as const };
    }
    throw notFound();
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ name: "robots", content: "noindex" }] };
    const url = pageUrl(`/collections/${params.id}`);
    const cover = loaderData.collection.cover;
    const absCover = /^https?:\/\//.test(cover) ? cover : `${SITE_URL}${cover.startsWith("/") ? "" : "/"}${cover}`;
    const isPreview = loaderData.source === "local";
    return {
      meta: [
        { title: `${loaderData.collection.title} — XeomX Collection` },
        { name: "description", content: loaderData.collection.subtitle },
        { property: "og:title", content: `${loaderData.collection.title} — XeomX` },
        { property: "og:description", content: loaderData.collection.subtitle },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: absCover },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: absCover },
        ...(isPreview ? [{ name: "robots", content: "noindex" }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <h1 className="font-display text-4xl">{m.collections_not_found()}</h1>
        <div className="mt-6 flex items-center justify-center gap-4">
          <Link to="/collections" className="rounded-full border border-border px-4 py-2 text-sm text-foreground">{m.nav_back_all_collections()}</Link>
          <Link to="/explore" className="rounded-full bg-magenta px-4 py-2 text-sm text-white">Discover prompts</Link>
        </div>
      </div>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <button onClick={reset} className="rounded-full border border-border px-4 py-2">{m.common_retry()}</button>
    </div>
  ),
  component: CollectionDetail,
});

function CollectionDetail() {
  const { collection, prompts, source } = Route.useLoaderData();
  const isPreview = source === "local";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={collection.cover} alt="" className="h-full w-full object-cover opacity-40 blur-2xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
        </div>
        <div
          className="relative mx-auto max-w-[1200px]"
          style={{
            paddingInline: "var(--space-4)",
            paddingTop: "var(--space-10)",
            paddingBottom: "var(--space-12)",
          }}
        >
          <Link
            to="/collections"
            className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-foreground"
            style={{ fontSize: "var(--font-size-caption)" }}
          >
            <ArrowLeft className="h-4 w-4" /> {m.nav_back_all_collections()}
          </Link>
          {isPreview ? (
            <div style={{ marginTop: "var(--space-6)" }}>
              <PreviewNotice status="preview" />
            </div>
          ) : null}
          <div
            className="grid lg:grid-cols-[420px_minmax(0,1fr)]"
            style={{ marginTop: "var(--space-8)", gap: "var(--space-10)" }}
          >
            <div className="overflow-hidden rounded-3xl border border-border">
              <img src={collection.cover} alt={collection.title} className="aspect-[16/10] w-full object-cover" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.22em]" style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.02 60)" }}>
                {collection.badge}
              </span>
              <h1
                className="font-display font-semibold leading-[0.98] tracking-tight"
                style={{
                  marginTop: "var(--space-4)",
                  fontSize: "clamp(2.25rem, 5vw, var(--font-size-h1))",
                }}
              >
                {collection.title}
              </h1>
              <p
                className="max-w-xl"
                style={{
                  marginTop: "var(--space-4)",
                  fontSize: "var(--font-size-body-lg)",
                  color: "var(--text-muted)",
                }}
              >
                {collection.subtitle}
              </p>
              <p
                className="inline-flex items-center gap-2 uppercase tracking-[0.22em]"
                style={{
                  marginTop: "var(--space-3)",
                  fontSize: "var(--font-size-caption)",
                  color: "var(--text-muted)",
                }}
              >
                <Layers className="h-3 w-3" /> {m.collections_prompts_in_pack({ count: String(prompts.length) })}
              </p>
            </div>
          </div>
        </div>
      </section>
      <section
        className="mx-auto max-w-[1400px]"
        style={{
          paddingInline: "var(--space-4)",
          paddingBottom: "var(--space-20)",
        }}
      >
        <h2
          className="font-display font-semibold tracking-tight"
          style={{ marginBottom: "var(--space-6)", fontSize: "var(--font-size-h2)" }}
        >
          {m.collections_inside_pack()}
        </h2>
        {prompts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/60 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              This collection is still being curated. Check back soon.
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            style={{ gap: "var(--space-6)" }}
          >
            {prompts.map((p: Prompt) => (
              <PromptCard key={p.id} prompt={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}