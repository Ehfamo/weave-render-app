import { Flame } from "lucide-react";

export function TickerMarquee({ items }: { items: string[] }) {
  const loop = [...items, ...items];
  return (
    <div
      className="xeomx-marquee relative overflow-hidden border-y border-border/60 bg-surface/40"
      role="marquee"
      aria-label="Live activity ticker"
    >
      <div className="xeomx-marquee-track flex w-max gap-10 py-3 ps-10">
        {loop.map((t, i) => (
          <span key={i} aria-hidden={i >= items.length} className="inline-flex shrink-0 items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            <Flame className="h-3 w-3 text-magenta" />
            <span className="text-foreground/80">{t}</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes xmarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .xeomx-marquee-track{animation:xmarquee 38s linear infinite}
        .xeomx-marquee:hover .xeomx-marquee-track,
        .xeomx-marquee:focus-within .xeomx-marquee-track{animation-play-state:paused}
        @media (prefers-reduced-motion: reduce){
          .xeomx-marquee-track{animation:none;transform:none}
        }
      `}</style>
    </div>
  );
}