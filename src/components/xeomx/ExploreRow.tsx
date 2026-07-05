import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { ExploreCard } from "./ExploreCard";
import { type ExploreSection } from "@/lib/explore-sections";

export function ExploreRow({ title, sections, rowIndex = 0 }: { title: string; sections: ExploreSection[]; rowIndex?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  if (sections.length === 0) return null;

  return (
    <motion.section
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: 0.04, delayChildren: rowIndex * 0.06 },
        },
      }}
    >
      <div
        className="flex items-end justify-between"
        style={{
          marginBottom: "var(--space-4)",
          gap: "var(--space-4)",
          paddingInline: "var(--space-4)",
        }}
      >
        <div>
          <h2
            className="font-display font-bold tracking-tight text-gradient-gold"
            style={{ fontSize: "clamp(1.25rem, 2.6vw, var(--font-size-h2))" }}
          >
            {title}
          </h2>
        </div>
        <div className="hidden gap-2 lg:flex">
          <button
            onClick={() => scroll(-1)}
            className="grid h-9 w-9 place-items-center rounded-full text-foreground transition hover:border-amber-300/40"
            style={{
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--surface-glass)",
              transitionDuration: "var(--motion-duration-fast)",
              transitionTimingFunction: "var(--motion-ease)",
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll(1)}
            className="grid h-9 w-9 place-items-center rounded-full text-foreground transition hover:border-amber-300/40"
            style={{
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--surface-glass)",
              transitionDuration: "var(--motion-duration-fast)",
              transitionTimingFunction: "var(--motion-ease)",
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="scrollbar-hidden mask-fade-x flex snap-x snap-mandatory overflow-x-auto"
        style={{
          gap: "var(--space-3)",
          paddingInline: "var(--space-4)",
          paddingBottom: "var(--space-4)",
        }}
      >
        {sections.map((s, i) => (
          <motion.div
            key={s.slug}
            className="snap-start"
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
              },
            }}
          >
            <ExploreCard section={s} index={i} />
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}