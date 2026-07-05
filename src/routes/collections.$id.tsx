import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Layers } from "lucide-react";
import { getCollection, PROMPTS, type Collection } from "@/lib/prompts";
import { Header } from "@/components/xeomx/Header";
import { PromptCard } from "@/components/xeomx/PromptCard";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/collections/$id")({
  loader: ({ params }) => {
    const c = getCollection(params.id);
    if (!c) throw notFound();
    return { collection: c };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.collection.title} — XeomX Collection` },
          { name: "description", content: loaderData.collection.subtitle },
          { property: "og:title", content: `${loaderData.collection.title} — XeomX` },
          { property: "og:description", content: loaderData.collection.subtitle },
          { property: "og:image", content: loaderData.collection.cover },
        ]
      : [],
  }),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <h1 className="font-display text-4xl">{m.collections_not_found()}</h1>
        <Link to="/collections" className="mt-4 inline-block text-magenta">{m.nav_back_all_collections()}</Link>
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
  const { collection } = Route.useLoaderData() as { collection: Collection };
  const prompts = collection.ids.map((id) => PROMPTS.find((p) => p.id === id)).filter(Boolean) as typeof PROMPTS;

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
                <Layers className="h-3 w-3" /> {m.collections_prompts_in_pack({ count: String(collection.count) })}
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
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
          style={{ gap: "var(--space-6)" }}
        >
          {prompts.map((p) => (
            <PromptCard key={p.id} prompt={p} />
          ))}
        </div>
      </section>
    </div>
  );
}