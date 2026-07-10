import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchCollections } from "@/lib/marketplace";
import { Header } from "@/components/xeomx/Header";
import { CollectionCard } from "@/components/xeomx/CollectionCard";
import { motion } from "motion/react";
import { pageUrl } from "@/lib/seo";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/collections")({
  head: () => ({
    meta: [
      { title: "Collections — XeomX" },
      { name: "description", content: "Curated prompt packs. Build a SaaS in 10 prompts. Master AI automation." },
      { property: "og:title", content: "Collections — XeomX" },
      { property: "og:description", content: "Curated prompt packs. Structured learning paths." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl("/collections") },
    ],
    links: [{ rel: "canonical", href: pageUrl("/collections") }],
  }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const { data: collections = [], isLoading, error } = useQuery({
    queryKey: ["collections", "public"],
    queryFn: () => fetchCollections(48),
    staleTime: 60_000,
  });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <section
        className="mx-auto max-w-[1400px]"
        style={{
          paddingInline: "var(--space-4)",
          paddingBlock: "var(--space-12)",
        }}
      >
        <p
          className="uppercase tracking-[0.28em] text-gold/80"
          style={{ fontSize: "var(--font-size-caption)" }}
        >
          {m.collections_eyebrow()}
        </p>
        <h1
          className="font-display font-semibold tracking-tight"
          style={{
            marginTop: "var(--space-2)",
            fontSize: "clamp(2.25rem, 5vw, var(--font-size-h1))",
          }}
        >
          {m.collections_title_1()} <span className="text-gradient-gold italic">{m.collections_title_2()}</span>
        </h1>
        <p
          className="max-w-xl"
          style={{
            marginTop: "var(--space-3)",
            fontSize: "var(--font-size-body)",
            color: "var(--text-muted)",
          }}
        >
          {m.collections_subtitle()}
        </p>

        {isLoading ? (
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-3xl border border-border/60 bg-surface/40" />
            ))}
          </div>
        ) : error ? (
          <p className="mt-10 text-sm text-destructive">Failed to load collections.</p>
        ) : collections.length === 0 ? (
          <div className="mt-16 rounded-3xl border border-dashed border-border/60 p-10 text-center">
            <h2 className="font-display text-2xl">No public collections yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Curators are building the first packs. Check back soon.</p>
          </div>
        ) : (
        <motion.div
          className="grid lg:grid-cols-2"
          style={{ marginTop: "var(--space-10)", gap: "var(--space-6)" }}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{ show: { transition: { staggerChildren: 0.04 } } }}
        >
          {collections.map((c) => (
            <motion.div
              key={c.id}
              variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <CollectionCard c={c} />
            </motion.div>
          ))}
        </motion.div>
        )}
      </section>
    </div>
  );
}