import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ExploreCard } from "./ExploreCard";
import { type ExploreSection } from "@/lib/explore-sections";

export function ExploreRow({ title, sections, rowIndex = 0 }: { title: string; sections: ExploreSection[]; rowIndex?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  if (sections.length === 0) return null;

  return (
    <section
      className="animate-fade-in"
      style={{ animationDelay: `${rowIndex * 80}ms`, animationFillMode: 'both' }}
    >
      <div className="mb-4 flex items-end justify-between gap-4 px-4 sm:px-8">
        <h2 className="font-display text-xl font-bold tracking-tight text-gradient-gold sm:text-3xl">{title}</h2>
        <div className="hidden gap-2 lg:flex">
          <button onClick={() => scroll(-1)} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface/60 text-foreground transition hover:border-amber-300/40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => scroll(1)} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface/60 text-foreground transition hover:border-amber-300/40">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div ref={ref} className="scrollbar-hidden mask-fade-x flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:gap-4 sm:px-8">
        {sections.map((s, i) => (
          <div key={s.slug} className="snap-start">
            <ExploreCard section={s} index={i} />
          </div>
        ))}
      </div>
    </section>
  );
}