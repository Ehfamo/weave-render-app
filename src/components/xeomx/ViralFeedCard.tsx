import { Link } from "@tanstack/react-router";
import { Bookmark, Copy, Heart, MessageCircle, Share2, Shuffle } from "lucide-react";
import { useState } from "react";
import type { Prompt } from "@/lib/prompts";
import { SignalBadge } from "./Signal";

export function ViralFeedCard({ p }: { p: Prompt }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (p.state === "soon") return;
    await navigator.clipboard.writeText(p.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <article className="relative h-[100svh] w-full snap-start overflow-hidden">
      <img src={p.cover} alt={p.title} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-background/30" />

      <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-3 sm:right-5">
        {[
          { Icon: Heart, label: p.likes },
          { Icon: MessageCircle, label: "412" },
          { Icon: Bookmark, label: String(p.saves ?? "—") },
          { Icon: Share2, label: String(p.shares ?? "—") },
          { Icon: Shuffle, label: String(p.remixes ?? "—") },
        ].map(({ Icon, label }, i) => (
          <button key={i} className="group flex flex-col items-center gap-1">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-foreground/25 bg-background/40 backdrop-blur transition group-hover:border-magenta/60 group-hover:bg-magenta/15">
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </button>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 mx-auto max-w-[760px] space-y-4 p-5 sm:p-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground backdrop-blur">
            {p.category}
          </span>
          <SignalBadge signal={p.signal ?? null} score={p.viralScore} />
        </div>
        <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">{p.title}</h2>
        <p className="line-clamp-3 max-w-xl text-sm text-foreground/80 sm:text-base">{p.prompt}</p>
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {p.author} · {p.views} views · {p.likes} likes
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            onClick={onCopy}
            disabled={p.state === "soon"}
            className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white transition disabled:opacity-40"
            style={{ background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)" }}
          >
            <Copy className="h-4 w-4" />
            {p.state === "soon" ? "Locked" : copied ? "Copied ✓" : "Copy prompt"}
          </button>
          <Link
            to="/prompt/$id"
            params={{ id: p.id }}
            className="rounded-full border border-border bg-surface/60 px-5 py-3 text-sm text-foreground backdrop-blur transition hover:border-gold/40"
          >
            Open studio →
          </Link>
        </div>
      </div>
    </article>
  );
}