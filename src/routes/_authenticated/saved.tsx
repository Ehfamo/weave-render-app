import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/xeomx/Header";
import { PromptCard } from "@/components/xeomx/PromptCard";
import { fetchSavedPromptsForUser } from "@/lib/marketplace";
import { useAuth } from "@/hooks/use-auth";
import { pageUrl } from "@/lib/seo";
import { Bookmark } from "lucide-react";

export const Route = createFileRoute("/_authenticated/saved")({
  ssr: false,
  component: SavedLibrary,
  head: () => ({
    meta: [
      { title: "Saved — XeomX" },
      { name: "description", content: "Your saved prompts, ready to remix." },
      { property: "og:title", content: "Saved — XeomX" },
      { property: "og:description", content: "Your saved prompts, ready to remix." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl("/saved") },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: pageUrl("/saved") }],
  }),
});

function SavedLibrary() {
  const { user } = useAuth();
  const { data = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["saved-library", user?.id],
    enabled: !!user,
    queryFn: () => fetchSavedPromptsForUser(user!.id),
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <section
        className="mx-auto max-w-[1400px]"
        style={{ paddingInline: "var(--space-4)", paddingBlock: "var(--space-6)" }}
      >
        <p className="uppercase tracking-[0.28em] text-magenta/80" style={{ fontSize: "var(--font-size-micro)" }}>
          Your library
        </p>
        <h1
          className="font-display font-bold tracking-tight"
          style={{ marginTop: "var(--space-2)", fontSize: "clamp(2rem, 5vw, var(--font-size-h1))" }}
        >
          Saved <span className="text-gradient-magenta italic">prompts</span>
        </h1>
        <p
          className="max-w-xl"
          style={{ marginTop: "var(--space-3)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
        >
          Everything you've bookmarked, synced across devices.
        </p>

        {isLoading ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl border border-border/60 bg-surface/40" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-10 rounded-3xl border border-dashed border-border/60 p-10 text-center">
            <h2 className="font-display text-2xl">Couldn't load your library</h2>
            <p className="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p>
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="mt-4 rounded-full border border-border px-5 py-2 text-sm disabled:opacity-60"
            >
              {isRefetching ? "Retrying…" : "Retry"}
            </button>
          </div>
        ) : data.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-border/60 p-10 text-center">
            <Bookmark className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 font-display text-2xl">Nothing saved yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tap the bookmark icon on any prompt to keep it here for later.
            </p>
            <Link
              to="/explore"
              className="mt-5 inline-flex rounded-full bg-magenta px-5 py-2 text-sm font-medium text-white"
            >
              Discover prompts
            </Link>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
            style={{ marginTop: "var(--space-6)" }}
          >
            {data.map((p) => (
              <PromptCard key={p.id} prompt={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}