import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/xeomx/Header";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: m.refund_head_title() },
      { name: "description", content: m.refund_head_desc() },
      { property: "og:title", content: m.refund_head_title() },
      { property: "og:description", content: m.refund_head_desc() },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <div className="min-h-svh bg-background">
      <Header />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8 sm:py-24">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {m.explore_hero_back()}
        </Link>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{m.refund_title()}</h1>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">{m.legal_updated()}</p>
        <div className="mt-8 whitespace-pre-line text-sm leading-relaxed text-muted-foreground sm:text-base">
          {m.refund_body()}
        </div>
      </div>
    </div>
  );
}