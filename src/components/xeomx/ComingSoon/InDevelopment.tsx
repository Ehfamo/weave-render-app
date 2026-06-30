import * as Icons from "lucide-react";
import { type ExploreSection } from "@/lib/explore-sections";
import { BackToExplore, NotifyForm } from "./shared";

export function InDevelopment({ section }: { section: ExploreSection }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[section.icon] ?? Icons.Sparkles;
  return (
    <div className="relative min-h-svh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 animate-pulse" style={{ background: "radial-gradient(50% 50% at 20% 0%, oklch(0.68 0.28 0 / 0.18), transparent 70%), radial-gradient(40% 40% at 90% 30%, oklch(0.81 0.13 80 / 0.12), transparent 70%)" }} />

      <div className="relative mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 sm:px-8 sm:py-16">
        <BackToExplore />

        <div>
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10">
            <Icon className="h-7 w-7 text-fuchsia-200" />
          </span>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-fuchsia-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-300" /> In development · Q2 2026
          </div>
          <h1 className="mt-4 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">{section.name}</h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">{section.tagline}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-surface/40 p-6 backdrop-blur">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Why it matters</div>
          <p className="mt-3 text-base leading-relaxed text-foreground">
            {section.whyItMatters ?? section.description}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-surface/40 p-1 backdrop-blur">
          <div className="grid aspect-[16/9] place-items-center rounded-[1.4rem] bg-gradient-to-br from-fuchsia-500/10 via-amber-300/5 to-transparent">
            <div className="text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Feature preview</div>
              <div className="mt-2 font-display text-xl text-muted-foreground/70">Coming into focus…</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-surface/40 p-6 backdrop-blur">
          <h3 className="font-display text-xl font-bold">Get notified at launch</h3>
          <p className="mt-1 text-sm text-muted-foreground">We'll let you know the moment {section.name} ships.</p>
          <div className="mt-4"><NotifyForm /></div>
        </div>
      </div>
    </div>
  );
}