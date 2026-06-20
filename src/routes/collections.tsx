import { createFileRoute } from "@tanstack/react-router";
import { COLLECTIONS } from "@/lib/prompts";
import { Header } from "@/components/xeomx/Header";
import { CollectionCard } from "@/components/xeomx/CollectionCard";

export const Route = createFileRoute("/collections")({
  head: () => ({
    meta: [
      { title: "Collections — XeomX" },
      { name: "description", content: "Curated prompt packs. Build a SaaS in 10 prompts. Master AI automation." },
      { property: "og:title", content: "Collections — XeomX" },
      { property: "og:description", content: "Curated prompt packs. Structured learning paths." },
    ],
  }),
  component: CollectionsPage,
});

function CollectionsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <section className="mx-auto max-w-[1400px] px-4 py-12 sm:px-8">
        <p className="text-[11px] uppercase tracking-[0.28em] text-gold/80">Curated · structured paths</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-6xl">
          Prompt <span className="text-gradient-gold italic">collections</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          Hand-curated prompt packs that take you from zero to outcome. Each pack is a chained prompt system, not a list.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {COLLECTIONS.map((c) => (
            <CollectionCard key={c.id} c={c} />
          ))}
        </div>
      </section>
    </div>
  );
}