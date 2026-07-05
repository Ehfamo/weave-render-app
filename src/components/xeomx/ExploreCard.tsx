import { Link } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { type ExploreSection, getPhaseBadge, getCoreLink } from "@/lib/explore-sections";

export function ExploreCard({ section, index = 0, core = false }: { section: ExploreSection; index?: number; core?: boolean }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[section.icon] ?? Icons.Sparkles;
  const badge = getPhaseBadge(section.phase);
  const href = section.phase === 'live' ? getCoreLink(section.slug) : `/explore/${section.slug}`;
  return (
    <Link
      to={href as string}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms`, animationFillMode: 'both' }}
      className={`group surface-raised relative flex h-full min-h-[160px] w-[72vw] max-w-[260px] shrink-0 flex-col justify-between rounded-2xl border p-5 transition-transform hover:scale-[1.02] sm:min-h-[180px] sm:w-[280px] ${core ? 'sm:w-full sm:max-w-none' : ''} ${
          core
            ? 'border-amber-300/40 hover:border-amber-300/70'
            : 'hover:border-amber-300/40'
        }`}
      // eslint-disable-next-line react/forbid-dom-props
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300/20 to-fuchsia-500/10 ring-1 ring-white/10">
          <Icon className="h-5 w-5 text-amber-200" />
        </span>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badge.className}`}>
          {badge.label}
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="font-display text-lg font-bold leading-tight text-foreground">{section.name}</h3>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{section.tagline}</p>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: 'radial-gradient(60% 60% at 50% 0%, oklch(0.81 0.13 80 / 0.12), transparent 70%)' }} />
    </Link>
  );
}