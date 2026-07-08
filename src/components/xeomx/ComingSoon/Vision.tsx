import { type ExploreSection } from "@/lib/explore-sections";
import { getIcon } from "@/lib/icon-map";
import { BackToExplore, NotifyForm } from "./shared";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export function Vision({ section }: { section: ExploreSection }) {
  const Icon = getIcon(section.icon);
  return (
    <div className="relative min-h-svh overflow-hidden bg-background">
      {/* abstract geometric decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-1/4 h-96 w-96 rotate-12 rounded-[3rem] opacity-20 blur-3xl" style={{ background: "var(--gradient-magenta)" }} />
        <div className="absolute right-0 top-0 h-72 w-72 -rotate-12 rounded-full opacity-20 blur-3xl" style={{ background: "var(--gradient-gold)" }} />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full opacity-10 blur-3xl" style={{ background: "var(--gradient-magenta)" }} />
      </div>

      <div className="relative mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 sm:px-8 sm:py-20">
        <BackToExplore />

        <div>
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-surface/40 backdrop-blur">
            <Icon className="h-7 w-7 text-amber-200" />
          </span>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {m.vision_badge()}
          </div>
          <h1 className="mt-4 font-display text-5xl font-bold italic leading-[1.05] tracking-tight sm:text-7xl">
            <span className="text-gradient-gold">{section.name}</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg italic text-muted-foreground">{section.tagline}</p>
        </div>

        <p className="max-w-2xl text-lg leading-relaxed text-foreground/90">
          {section.vision ?? section.description}
        </p>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{m.vision_concept_preview()}</div>
          <div className="relative mt-3 aspect-[16/9] overflow-hidden rounded-3xl border border-white/10">
            <div className="absolute inset-0 blur-2xl" style={{ background: "conic-gradient(from 90deg at 50% 50%, oklch(0.81 0.13 80 / 0.35), oklch(0.68 0.28 0 / 0.35), oklch(0.81 0.13 80 / 0.35))" }} />
            <div className="absolute inset-0 backdrop-blur-2xl" />
            <div className="relative grid h-full place-items-center">
              <div className="font-display text-2xl italic text-foreground/60">{m.vision_glimpse()}</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-surface/40 p-6 backdrop-blur">
          <h3 className="font-display text-xl font-bold">{m.vision_future_title()}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{m.vision_future_desc({ name: section.name })}</p>
          <div className="mt-4"><NotifyForm sectionSlug={section.slug} /></div>
        </div>
      </div>
    </div>
  );
}