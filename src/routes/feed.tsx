import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchViralPrompts } from "@/lib/marketplace";
import { ViralFeedCard } from "@/components/xeomx/ViralFeedCard";
import { pageUrl } from "@/lib/seo";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Viral Feed — XeomX" },
      { name: "description", content: "Full-screen viral prompt feed. Scroll, copy, remix." },
      { property: "og:title", content: "Viral Feed — XeomX" },
      { property: "og:description", content: "Full-screen viral prompt feed. Scroll, copy, remix." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl("/feed") },
    ],
    links: [{ rel: "canonical", href: pageUrl("/feed") }],
  }),
  component: Feed,
});

function Feed() {
  const { data: queue = [], isLoading, error } = useQuery({
    queryKey: ["viral-feed"],
    queryFn: () => fetchViralPrompts(20),
    staleTime: 60_000,
  });
  return (
    <div className="relative bg-background">
      <Link
        to="/"
        className="fixed start-4 top-4 z-30 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground backdrop-blur transition hover:border-magenta/40 sm:start-6 sm:top-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {m.nav_back_discover()}
      </Link>
      {isLoading ? (
        <div className="grid h-[100svh] place-items-center text-sm text-muted-foreground">Loading feed…</div>
      ) : error ? (
        <div className="grid h-[100svh] place-items-center text-sm text-destructive">Failed to load feed.</div>
      ) : queue.length === 0 ? (
        <div className="grid h-[100svh] place-items-center px-6 text-center">
          <div>
            <h2 className="font-display text-2xl">No prompts yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Be the first to publish a prompt.</p>
            <Link to="/studio" className="mt-4 inline-block rounded-full border border-border px-4 py-2 text-sm">
              Open Studio
            </Link>
          </div>
        </div>
      ) : (
        <div className="h-[100svh] snap-y snap-mandatory overflow-y-auto">
          {queue.map((p) => (
            <ViralFeedCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}