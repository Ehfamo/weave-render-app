import { Link } from "@tanstack/react-router";
import { Bookmark, Copy, Crown, Lock, Play, Share2, Shuffle, Sparkles } from "lucide-react";
import { useState } from "react";
import type { Prompt } from "@/lib/prompts";
import { SignalBadge } from "./Signal";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

const stateChip = {
  free: { labelKey: "common_free" as const, className: "bg-foreground/10 text-foreground border border-foreground/15", icon: Sparkles },
  premium: { labelKey: "common_premium" as const, className: "bg-[var(--gradient-gold)] text-[oklch(0.18_0.02_60)] border border-gold/40", icon: Crown },
  soon: { labelKey: "common_coming_soon" as const, className: "bg-magenta/15 text-magenta border border-magenta/30", icon: Lock },
} as const;

export function PromptCard({ prompt, size = "md" }: { prompt: Prompt; size?: "sm" | "md" | "lg" }) {
  const [copied, setCopied] = useState(false);
  const chip = stateChip[prompt.state];
  const Icon = chip.icon;

  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (prompt.state === "soon") return;
    await navigator.clipboard.writeText(prompt.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const fmt = (n?: number) => {
    if (!n) return "—";
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
    return String(n);
  };

  const widths = {
    sm: "w-[200px] sm:w-[220px]",
    md: "w-[260px] sm:w-[300px]",
    lg: "w-[320px] sm:w-[380px]",
  } as const;

  return (
    <Link
      to="/prompt/$id"
      params={{ id: prompt.id }}
      className={`group surface-raised relative shrink-0 ${widths[size]} overflow-hidden rounded-2xl border border-[var(--border-default)] transition-transform hover:scale-[1.02] hover:border-magenta/40`}
      style={{
        transitionDuration: "var(--motion-duration-fast)",
        transitionTimingFunction: "var(--motion-ease)",
      }}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          src={prompt.cover}
          alt={prompt.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        {/* depth blur sheen on hover */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: "radial-gradient(60% 50% at 50% 40%, oklch(0.68 0.28 0 / 0.18), transparent 70%)" }}
        />

        {/* top row chips */}
        <div className="absolute start-3 end-3 top-3 flex items-start justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide ${
              prompt.state === "premium"
                ? "text-gold-foreground"
                : prompt.state === "soon"
                ? "text-magenta"
                : "text-foreground"
            } ${chip.className}`}
            style={prompt.state === "premium" ? { background: "var(--gradient-gold)" } : undefined}
          >
            <Icon className="h-3 w-3" />
            {m[chip.labelKey]()}
          </span>
          <div className="flex flex-col items-end gap-1.5">
            <span className="rounded-full border border-border/60 bg-background/60 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
              {prompt.category}
            </span>
            <SignalBadge signal={prompt.signal ?? null} score={prompt.viralScore} />
          </div>
        </div>

        {/* hover quick actions */}
        <div className="absolute inset-x-3 bottom-3 flex translate-y-2 items-center justify-between gap-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-foreground/30 bg-background/40 backdrop-blur">
            <Play className="h-4 w-4 fill-foreground text-foreground" />
          </span>
          <div className="flex items-center gap-1.5">
            {[
              { Icon: Copy, onClick: onCopy, key: "copy" },
              { Icon: Bookmark, onClick: stop, key: "save" },
              { Icon: Share2, onClick: stop, key: "share" },
              { Icon: Shuffle, onClick: stop, key: "remix" },
            ].map(({ Icon: I, onClick, key }) => (
              <button
                key={key}
                onClick={onClick}
                className="grid h-9 w-9 place-items-center rounded-full border border-foreground/20 bg-background/50 text-foreground backdrop-blur transition hover:border-magenta/60 hover:bg-magenta/15"
                aria-label={key}
              >
                <I className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* premium lock veil */}
        {prompt.state === "premium" ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 hidden items-center justify-center rounded-2xl border border-gold/30 bg-background/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-gold backdrop-blur group-hover:hidden md:flex" />
        ) : null}
      </div>

      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <h3 className="font-display text-lg font-semibold leading-tight tracking-tight text-foreground">
            {prompt.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {prompt.author} · {prompt.views} {m.prompt_views()}
          </p>
          <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Copy className="h-3 w-3" /> {fmt(prompt.copies)}</span>
            <span className="inline-flex items-center gap-1"><Bookmark className="h-3 w-3" /> {fmt(prompt.saves)}</span>
            <span className="inline-flex items-center gap-1"><Shuffle className="h-3 w-3" /> {fmt(prompt.remixes)}</span>
          </div>
        </div>
        <button
          onClick={onCopy}
          disabled={prompt.state === "soon"}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-2 text-xs font-medium text-foreground transition hover:border-magenta/40 hover:bg-magenta/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Copy className="h-3.5 w-3.5" />
          {prompt.state === "soon" ? m.common_locked() : copied ? m.common_copied() : m.prompt_copy_button()}
        </button>
      </div>
    </Link>
  );
}