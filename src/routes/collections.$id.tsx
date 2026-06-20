import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Layers } from "lucide-react";
import { getCollection, PROMPTS, type Collection } from "@/lib/prompts";
import { Header } from "@/components/xeomx/Header";
import { PromptCard } from "@/components/xeomx/PromptCard";

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
        <h1 className="font-display text-4xl">Collection not found</h1>
        <Link to="/collections" className="mt-4 inline-block text-magenta">All collections</Link>
      </div>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <button onClick={reset} className="rounded-full border border-border px-4 py-2">Retry</button>
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
        <div className="relative mx-auto max-w-[1200px] px-4 pb-12 pt-10 sm:px-8 sm:pt-16">
          <Link to="/collections" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All collections
          </Link>
          <div className="mt-8 grid gap-10 lg:grid-cols-[420px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-3xl border border-border">
              <img src={collection.cover} alt={collection.title} className="aspect-[16/10] w-full object-cover" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.22em]" style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.02 60)" }}>
                {collection.badge}
              </span>
              <h1 className="mt-4 font-display text-4xl font-semibold leading-[0.98] tracking-tight sm:text-6xl">
                {collection.title}
              </h1>
              <p className="mt-4 max-w-xl text-base text-muted-foreground">{collection.subtitle}</p>
              <p className="mt-3 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                <Layers className="h-3 w-3" /> {collection.count} prompts in this pack
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1400px] px-4 pb-20 sm:px-8">
        <h2 className="mb-6 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Inside the pack</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {prompts.map((p) => (
            <PromptCard key={p.id} prompt={p} />
          ))}
        </div>
      </section>
    </div>
  );
}