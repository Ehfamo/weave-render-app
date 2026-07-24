import { Link } from "@tanstack/react-router";
import { Layers, ArrowUpRight } from "lucide-react";
import type { Collection } from "@/lib/prompts";
import { FeatureStatusBadge } from "@/components/xeomx/status/FeatureStatusBadge";

export function CollectionCard({ c, status = "live" }: { c: Collection; status?: "live" | "preview" }) {
  return (
    <Link
      to="/collections/$id"
      params={{ id: c.id }}
      className="surface-raised group relative block overflow-hidden rounded-3xl hover:scale-[1.02]"
      style={{
        transitionProperty: "transform, box-shadow, border-color",
        transitionDuration: "var(--motion-duration-fast)",
        transitionTimingFunction: "var(--motion-ease)",
      }}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img src={c.cover} alt={c.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute start-4 top-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.22em]" style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.02 60)" }}>
            {c.badge}
          </span>
          {status === "preview" ? <FeatureStatusBadge status="preview" size="xs" /> : null}
        </div>
        <span
          className="absolute end-4 top-4 inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2 py-1 uppercase tracking-[0.2em] text-muted-foreground backdrop-blur"
          style={{ fontSize: "var(--font-size-caption)" }}
        >
          <Layers className="h-3 w-3" /> {c.count} prompts
        </span>
      </div>
      <div className="space-y-2" style={{ padding: "var(--space-5)" }}>
        <div className="flex items-start justify-between gap-3">
          <h3
            className="font-display font-semibold leading-tight tracking-tight"
            style={{ fontSize: "var(--font-size-h3)" }}
          >
            {c.title}
          </h3>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-gold" />
        </div>
        <p style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>{c.subtitle}</p>
      </div>
    </Link>
  );
}