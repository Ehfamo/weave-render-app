import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PROMPTS, TOP_PROMPT_IDS } from "@/lib/prompts";
import { ViralFeedCard } from "@/components/xeomx/ViralFeedCard";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Viral Feed — XeomX" },
      { name: "description", content: "Full-screen viral prompt feed. Scroll, copy, remix." },
    ],
  }),
  component: Feed,
});

function Feed() {
  const queue = TOP_PROMPT_IDS.map((id) => PROMPTS.find((p) => p.id === id)).filter(Boolean) as typeof PROMPTS;
  return (
    <div className="relative bg-background">
      <Link
        to="/"
        className="fixed start-4 top-4 z-30 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground backdrop-blur transition hover:border-magenta/40 sm:start-6 sm:top-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {m.nav_back_discover()}
      </Link>
      <div className="h-[100svh] snap-y snap-mandatory overflow-y-auto">
        {queue.map((p) => (
          <ViralFeedCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}