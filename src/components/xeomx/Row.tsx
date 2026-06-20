import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PROMPTS } from "@/lib/prompts";
import { PromptCard } from "./PromptCard";

export function Row({ title, tag, ids }: { title: string; tag: string; ids: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const items = ids.map((id) => PROMPTS.find((p) => p.id === id)!).filter(Boolean);

  const scroll = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * 600, behavior: "smooth" });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4 px-4 sm:px-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-magenta/80">{tag}</p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <button
            onClick={() => scroll(-1)}
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface/60 text-foreground/80 transition hover:border-magenta/40 hover:text-foreground"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll(1)}
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface/60 text-foreground/80 transition hover:border-magenta/40 hover:text-foreground"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mask-fade-x">
        <div
          ref={ref}
          className="scrollbar-hidden flex gap-4 overflow-x-auto scroll-smooth px-4 pb-4 sm:gap-6 sm:px-8"
        >
          {items.map((p) => (
            <PromptCard key={p.id} prompt={p} />
          ))}
        </div>
      </div>
    </section>
  );
}