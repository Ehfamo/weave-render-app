import { Crown, Sparkles, TrendingUp } from "lucide-react";
import type { Creator } from "@/lib/prompts";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

const tierMap = {
  Founder: { Icon: Crown, cls: "text-gold border-gold/40 bg-gold/10" },
  Elite: { Icon: Sparkles, cls: "text-magenta border-magenta/40 bg-magenta/10" },
  Rising: { Icon: TrendingUp, cls: "text-foreground border-border bg-surface-2" },
} as const;

export function CreatorCard({ c }: { c: Creator }) {
  const t = tierMap[c.tier];
  const Icon = t.Icon;
  return (
    <div className="group relative w-[260px] shrink-0 overflow-hidden rounded-3xl border border-border bg-surface transition hover:border-magenta/40 hover:shadow-[var(--shadow-glow)]">
      <div className="relative aspect-[5/4] overflow-hidden">
        <img src={c.cover} alt={c.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <span className={`absolute start-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] backdrop-blur ${t.cls}`}>
          <Icon className="h-3 w-3" /> {c.tier}
        </span>
      </div>
      <div className="space-y-2 p-4">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight">{c.name}</h3>
          <p className="text-xs text-muted-foreground">{c.handle}</p>
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{c.bio}</p>
        <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
          <span>{m.creator_followers({ count: String(c.followers) })}</span>
          <span>{m.creator_copies({ count: String(c.copies) })}</span>
        </div>
      </div>
    </div>
  );
}