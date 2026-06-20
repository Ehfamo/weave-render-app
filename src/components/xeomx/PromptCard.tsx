import { Link } from "@tanstack/react-router";
import { Copy, Crown, Lock, Play, Sparkles } from "lucide-react";
import { useState } from "react";
import type { Prompt } from "@/lib/prompts";

const stateChip = {
  free: { label: "Free", className: "bg-foreground/10 text-foreground border border-foreground/15", icon: Sparkles },
  premium: { label: "Premium", className: "bg-[var(--gradient-gold)] text-[oklch(0.18_0.02_60)] border border-gold/40", icon: Crown },
  soon: { label: "Coming soon", className: "bg-magenta/15 text-magenta border border-magenta/30", icon: Lock },
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

  const widths = {
    sm: "w-[200px] sm:w-[220px]",
    md: "w-[260px] sm:w-[300px]",
    lg: "w-[320px] sm:w-[380px]",
  } as const;

  return (
    <Link
      to="/prompt/$id"
      params={{ id: prompt.id }}
      className={`group relative shrink-0 ${widths[size]} overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-500 hover:border-magenta/40 hover:shadow-[var(--shadow-glow)]`}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          src={prompt.cover}
          alt={prompt.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

        {/* top row chips */}
        <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
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
            {chip.label}
          </span>
          <span className="rounded-full border border-border/60 bg-background/60 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
            {prompt.category}
          </span>
        </div>

        {/* hover play */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-foreground/30 bg-background/30 backdrop-blur">
            <Play className="h-5 w-5 fill-foreground text-foreground" />
          </span>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <h3 className="font-display text-lg font-semibold leading-tight tracking-tight text-foreground">
            {prompt.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {prompt.author} · {prompt.views} views
          </p>
        </div>
        <button
          onClick={onCopy}
          disabled={prompt.state === "soon"}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-2 text-xs font-medium text-foreground transition hover:border-magenta/40 hover:bg-magenta/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Copy className="h-3.5 w-3.5" />
          {prompt.state === "soon" ? "Locked" : copied ? "Copied" : "Copy prompt"}
        </button>
      </div>
    </Link>
  );
}