import { Flame } from "lucide-react";

export function TickerMarquee({ items }: { items: string[] }) {
  const loop = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-border/60 bg-surface/40">
      <div className="flex w-max animate-[xmarquee_38s_linear_infinite] gap-10 py-3 pl-10">
        {loop.map((t, i) => (
          <span key={i} className="inline-flex shrink-0 items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            <Flame className="h-3 w-3 text-magenta" />
            <span className="text-foreground/80">{t}</span>
          </span>
        ))}
      </div>
      <style>{`@keyframes xmarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </div>
  );
}