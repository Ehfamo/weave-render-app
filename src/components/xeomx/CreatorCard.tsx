import { Crown, Sparkles, TrendingUp, Check } from "lucide-react";
import type { Creator } from "@/lib/prompts";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

const tierMap = {
  Founder: { Icon: Crown, cls: "text-gold border-gold/40 bg-gold/10" },
  Elite: { Icon: Sparkles, cls: "text-magenta border-magenta/40 bg-magenta/10" },
  Rising: { Icon: TrendingUp, cls: "text-foreground border-border bg-surface-2" },
} as const;

export function CreatorCard({
  c,
  onFollow,
  following,
  disabled,
}: {
  c: Creator;
  onFollow?: () => void;
  following?: boolean;
  disabled?: boolean;
}) {
  const t = tierMap[c.tier];
  const Icon = t.Icon;
  return (
    <div
      className="group surface-raised relative w-[260px] shrink-0 overflow-hidden rounded-3xl transition-transform hover:scale-[1.02] hover:border-magenta/40"
      style={{
        transitionDuration: "var(--motion-duration-fast)",
        transitionTimingFunction: "var(--motion-ease)",
      }}
    >
      <div className="relative aspect-[5/4] overflow-hidden">
        <img src={c.cover} alt={c.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <span className={`absolute start-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] backdrop-blur ${t.cls}`}>
          <Icon className="h-3 w-3" /> {c.tier}
        </span>
      </div>
      <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <div>
          <h3
            className="font-display font-semibold tracking-tight"
            style={{ fontSize: "var(--font-size-h3)" }}
          >
            {c.name}
          </h3>
          <p style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>{c.handle}</p>
        </div>
        <p
          className="line-clamp-2"
          style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
        >
          {c.bio}
        </p>
        <div
          className="flex items-center justify-between"
          style={{
            borderTop: "1px solid var(--border-subtle)",
            paddingTop: "var(--space-2)",
            fontSize: "var(--font-size-caption)",
            color: "var(--text-muted)",
          }}
        >
          <span>{m.creator_followers({ count: String(c.followers) })}</span>
          <span>{m.creator_copies({ count: String(c.copies) })}</span>
        </div>
        <button
          type="button"
          onClick={onFollow}
          disabled={disabled}
          className="inline-flex w-full items-center justify-center text-sm font-medium text-white transition hover:opacity-95"
          style={{
            marginTop: "var(--space-2)",
            backgroundColor: following ? "var(--surface-secondary)" : "var(--action-secondary)",
            borderRadius: "var(--radius-sm)",
            paddingInline: "var(--space-4)",
            paddingBlock: "var(--space-2)",
            transitionDuration: "var(--motion-duration-fast)",
            transitionTimingFunction: "var(--motion-ease)",
          }}
        >
          {following ? (<><Check className="mr-1 h-3.5 w-3.5" /> Following</>) : "Follow"}
        </button>
      </div>
    </div>
  );
}